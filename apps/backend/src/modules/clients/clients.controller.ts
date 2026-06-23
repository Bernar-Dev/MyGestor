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

    // Envia convite via Supabase Auth (service_role) — sem serviço externo
    let emailSent = false;
    try {
      const { error: invErr } = await svc.auth.admin.inviteUserByEmail(body.email, {
        redirectTo: `${origin}/auth/callback?invite=${token}`,
      });
      emailSent = !invErr;
    } catch { /* ignora; link continua válido para envio manual */ }

    return { ok: true, inviteUrl, expiresAt, emailSent };
  }
}
