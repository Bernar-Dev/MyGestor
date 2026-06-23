import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Request } from 'express';
import { CurrentSession } from '../../common/auth/current-session.decorator';
import { OrgService } from '../../common/org/org.service';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { HttpError } from '../../common/exceptions/http-error';
import { ClientsService } from './clients.service';
import {
  AssignAccountBody,
  CreateClientBody,
  InviteBody,
  PatchClientBody,
  PatchPermissionsBody,
} from './dto';
import type { SessionOrPending } from '../../common/org/types';

@Controller('clients')
export class ClientsController {
  constructor(
    private readonly org: OrgService,
    private readonly clients: ClientsService,
    private readonly supabase: SupabaseService,
  ) {}

  // ─── List + Create ────────────────────────────────────────────────────

  @Get()
  async list(@CurrentSession() session: SessionOrPending | null) {
    const sess = this.org.requireAgency(session);
    const svc = this.supabase.service();

    const { data, error } = await svc
      .from('clients')
      .select(
        'id, name, contact_email, contact_phone, company, status, portal_enabled, auth_user_id, created_at',
      )
      .eq('org_id', sess.orgId)
      .order('created_at', { ascending: false });
    if (error) throw new HttpError(500, error.message);

    const ids = (data ?? []).map((c) => c.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: caa } = await svc
        .from('client_ad_accounts')
        .select('client_id')
        .in('client_id', ids);
      (caa ?? []).forEach((r) => {
        counts[r.client_id] = (counts[r.client_id] ?? 0) + 1;
      });
    }

    return {
      clients: (data ?? []).map((c) => ({
        ...c,
        ad_accounts_count: counts[c.id] ?? 0,
      })),
    };
  }

  @Post()
  async create(
    @CurrentSession() session: SessionOrPending | null,
    @Body(new ZodValidationPipe(CreateClientBody)) body: CreateClientBody,
  ) {
    const sess = this.org.requireAgency(session);
    const svc = this.supabase.service();

    const { data: org } = await svc
      .from('organizations')
      .select('max_clients')
      .eq('id', sess.orgId)
      .single();
    const { count } = await svc
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', sess.orgId);
    if (org && typeof count === 'number' && count >= org.max_clients) {
      throw new HttpError(
        402,
        `Limite do plano atingido (${org.max_clients} clientes). Faça upgrade.`,
      );
    }

    const { data, error } = await svc
      .from('clients')
      .insert({
        org_id: sess.orgId,
        name: body.name,
        contact_email: body.contact_email || null,
        contact_phone: body.contact_phone || null,
        company: body.company || null,
        notes: body.notes || null,
      })
      .select('id')
      .single();
    if (error) throw new HttpError(500, error.message);

    return { ok: true, id: data.id };
  }

  // ─── Detail + Patch + Delete ──────────────────────────────────────────

  @Get(':id')
  async detail(
    @CurrentSession() session: SessionOrPending | null,
    @Param('id') id: string,
  ) {
    const sess = this.org.requireAgency(session);
    await this.clients.ensureClientOfOrg(id, sess.orgId);

    const svc = this.supabase.service();
    const { data: client } = await svc
      .from('clients')
      .select(
        'id, name, contact_email, contact_phone, company, status, portal_enabled, auth_user_id, notes, created_at',
      )
      .eq('id', id)
      .single();

    const { data: accounts } = await svc
      .from('client_ad_accounts')
      .select(
        'id, ad_account_id, ad_account_name, currency, permissions, created_at',
      )
      .eq('client_id', id);

    return { client, accounts: accounts ?? [] };
  }

  @Patch(':id')
  async update(
    @CurrentSession() session: SessionOrPending | null,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PatchClientBody)) body: PatchClientBody,
  ) {
    const sess = this.org.requireAgency(session);
    await this.clients.ensureClientOfOrg(id, sess.orgId);

    const svc = this.supabase.service();
    const { error } = await svc
      .from('clients')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new HttpError(500, error.message);
    return { ok: true };
  }

  @Delete(':id')
  async remove(
    @CurrentSession() session: SessionOrPending | null,
    @Param('id') id: string,
  ) {
    const sess = this.org.requireAgency(session);
    await this.clients.ensureClientOfOrg(id, sess.orgId);

    const svc = this.supabase.service();
    const { error } = await svc.from('clients').delete().eq('id', id);
    if (error) throw new HttpError(500, error.message);
    return { ok: true };
  }

  // ─── Sub-resource: ad accounts ────────────────────────────────────────

  @Post(':id/accounts')
  async assignAccount(
    @CurrentSession() session: SessionOrPending | null,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AssignAccountBody)) body: AssignAccountBody,
  ) {
    const sess = this.org.requireAgency(session);
    await this.clients.ensureClientOfOrg(id, sess.orgId);

    const svc = this.supabase.service();

    const { data: org } = await svc
      .from('organizations')
      .select('max_ad_accounts')
      .eq('id', sess.orgId)
      .single();
    const { count } = await svc
      .from('client_ad_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', sess.orgId);
    if (org && typeof count === 'number' && count >= org.max_ad_accounts) {
      throw new HttpError(
        402,
        `Limite do plano atingido (${org.max_ad_accounts} ad accounts). Faça upgrade.`,
      );
    }

    const { error } = await svc.from('client_ad_accounts').upsert(
      {
        client_id: id,
        org_id: sess.orgId,
        ad_account_id: body.ad_account_id,
        ad_account_name: body.ad_account_name || null,
        currency: body.currency || null,
        permissions: body.permissions ?? undefined,
      },
      { onConflict: 'client_id,ad_account_id' },
    );
    if (error) throw new HttpError(500, error.message);
    return { ok: true };
  }

  @Patch(':id/accounts')
  async updateAccountPermissions(
    @CurrentSession() session: SessionOrPending | null,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PatchPermissionsBody))
    body: PatchPermissionsBody,
  ) {
    const sess = this.org.requireAgency(session);
    await this.clients.ensureClientOfOrg(id, sess.orgId);

    const svc = this.supabase.service();
    const { error } = await svc
      .from('client_ad_accounts')
      .update({ permissions: body.permissions })
      .eq('client_id', id)
      .eq('ad_account_id', body.ad_account_id);
    if (error) throw new HttpError(500, error.message);
    return { ok: true };
  }

  @Delete(':id/accounts')
  async removeAccount(
    @CurrentSession() session: SessionOrPending | null,
    @Param('id') id: string,
    @Query('ad_account_id') adAccountId: string,
  ) {
    const sess = this.org.requireAgency(session);
    await this.clients.ensureClientOfOrg(id, sess.orgId);

    if (!adAccountId) {
      throw new HttpError(400, 'ad_account_id obrigatório');
    }

    const svc = this.supabase.service();
    const { error } = await svc
      .from('client_ad_accounts')
      .delete()
      .eq('client_id', id)
      .eq('ad_account_id', adAccountId);
    if (error) throw new HttpError(500, error.message);
    return { ok: true };
  }

  // ─── Invite ───────────────────────────────────────────────────────────

  @Post(':id/invite')
  async invite(
    @CurrentSession() session: SessionOrPending | null,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(InviteBody)) body: InviteBody,
    @Req() req: Request,
  ) {
    const sess = this.org.requireAgency(session);
    const svc = this.supabase.service();

    const { data: client } = await svc
      .from('clients')
      .select('id, name, contact_email')
      .eq('id', id)
      .eq('org_id', sess.orgId)
      .maybeSingle();
    if (!client) throw new HttpError(404, 'Cliente não encontrado');

    await svc
      .from('client_invitations')
      .delete()
      .eq('client_id', id)
      .is('accepted_at', null);

    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();

    const { error } = await svc.from('client_invitations').insert({
      client_id: id,
      org_id: sess.orgId,
      token,
      email: body.email,
      expires_at: expiresAt,
      created_by: sess.userId,
    });
    if (error) throw new HttpError(500, error.message);

    if (!client.contact_email) {
      await svc
        .from('clients')
        .update({ contact_email: body.email })
        .eq('id', id);
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.WEB_ORIGIN ??
      `${req.protocol}://${req.get('host')}`;
    const inviteUrl = `${origin}/invite/${token}`;

    // Envia email via Resend se a chave estiver configurada
    let emailSent = false;
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const { data: org } = await svc
        .from('organizations')
        .select('name, logo_url, primary_color')
        .eq('id', sess.orgId)
        .single();

      const orgName = org?.name ?? 'sua agência';
      const color = org?.primary_color ?? '#7c3aed';

      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM ?? 'noreply@meugestor.app',
            to: body.email,
            subject: `${orgName} convidou você para ver suas campanhas`,
            html: buildInviteEmail({ clientName: client.name, orgName, color, inviteUrl }),
          }),
        });
        emailSent = emailRes.ok;
      } catch { /* ignora falha de email; link ainda retorna */ }
    }

    return { ok: true, inviteUrl, expiresAt, emailSent };
  }
}

function buildInviteEmail(opts: {
  clientName: string;
  orgName: string;
  color: string;
  inviteUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0f1f;font-family:Inter,Arial,sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#161929;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:${opts.color};padding:24px 32px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#fff;">${opts.orgName}</p>
          <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.7);">Portal de relatórios de campanhas</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">Olá, ${opts.clientName}!</h2>
          <p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
            <strong>${opts.orgName}</strong> convidou você para acessar o portal de acompanhamento das suas campanhas Meta Ads.
            Você poderá visualizar seus resultados em tempo real — sem precisar entrar no Gerenciador de Anúncios.
          </p>
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="${opts.inviteUrl}" style="display:inline-block;background:${opts.color};color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:10px;">
              Criar minha conta e acessar
            </a>
          </td></tr></table>
          <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.35);">
            Este link expira em 7 dias. Se você não esperava este convite, pode ignorar este email.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);">Meu Gestor · Plataforma de analytics Meta Ads</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
