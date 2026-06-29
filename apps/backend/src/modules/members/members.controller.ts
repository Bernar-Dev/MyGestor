import {
  Body, Controller, Delete, Get, Param, Patch, Post, Req,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentSession } from '../../common/auth/current-session.decorator';
import { OrgService } from '../../common/org/org.service';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { HttpError } from '../../common/exceptions/http-error';
import type { SessionOrPending } from '../../common/org/types';

const InviteMemberBody = z.object({
  email: z.string().email('Email inválido'),
  member_role: z.enum(['gestor', 'observador']),
  client_ids: z.array(z.string().uuid()).min(1, 'Selecione ao menos um cliente'),
});
type InviteMemberBodyType = z.infer<typeof InviteMemberBody>;

const PatchMemberBody = z.object({
  member_role: z.enum(['gestor', 'observador']).optional(),
  client_ids: z.array(z.string().uuid()).optional(),
});
type PatchMemberBodyType = z.infer<typeof PatchMemberBody>;

@Controller('members')
export class MembersController {
  constructor(
    private readonly org: OrgService,
    private readonly supabase: SupabaseService,
  ) {}

  /** Lista todos os colaboradores da organização */
  @Get()
  async list(@CurrentSession() session: SessionOrPending | null) {
    const sess = this.org.requireAgency(session);
    const svc = this.supabase.service();

    // Membros da org com member_role preenchido
    const { data: members, error } = await svc
      .from('organization_members')
      .select('user_id, member_role, invited_by, created_at')
      .eq('org_id', sess.orgId)
      .not('member_role', 'is', null);
    if (error) throw new HttpError(500, error.message);

    if (!members || members.length === 0) return { members: [] };

    const userIds = members.map((m: any) => m.user_id);

    // Busca perfis dos membros
    const { data: usersPage } = await svc.auth.admin.listUsers({ perPage: 1000 });
    const userMap: Record<string, string> = {};
    (usersPage?.users || []).forEach((u: any) => {
      if (userIds.includes(u.id)) userMap[u.id] = u.email || '';
    });

    // Busca clients associados a cada membro
    const { data: access } = await svc
      .from('member_client_access')
      .select('member_user_id, client_id, clients(id, name)')
      .eq('org_id', sess.orgId)
      .in('member_user_id', userIds);

    const accessMap: Record<string, any[]> = {};
    (access || []).forEach((a: any) => {
      if (!accessMap[a.member_user_id]) accessMap[a.member_user_id] = [];
      accessMap[a.member_user_id].push({ id: a.client_id, name: a.clients?.name });
    });

    return {
      members: members.map((m: any) => ({
        userId: m.user_id,
        email: userMap[m.user_id] || '',
        memberRole: m.member_role,
        clients: accessMap[m.user_id] || [],
        createdAt: m.created_at,
      })),
    };
  }

  /** Convida um colaborador (cria token e envia email via inviteUserByEmail) */
  @Post('invite')
  async invite(
    @CurrentSession() session: SessionOrPending | null,
    @Body(new ZodValidationPipe(InviteMemberBody)) body: InviteMemberBodyType,
    @Req() req: Request,
  ) {
    const sess = this.org.requireAgency(session);
    const svc = this.supabase.service();

    // Valida que os clients pertencem à org
    const { data: clients } = await svc
      .from('clients')
      .select('id')
      .eq('org_id', sess.orgId)
      .in('id', body.client_ids);
    if (!clients || clients.length !== body.client_ids.length) {
      throw new HttpError(400, 'Um ou mais clientes inválidos para esta organização');
    }

    // Bloqueia se email já é gestor sênior confirmado
    const { data: usersPage } = await svc.auth.admin.listUsers({ perPage: 1000 });
    const existing = (usersPage?.users || []).find(
      (u: any) => u.email?.toLowerCase() === body.email.toLowerCase() && !!u.email_confirmed_at,
    );
    if (existing) {
      const { data: existingProfile } = await svc
        .from('profiles').select('role').eq('id', existing.id).maybeSingle();
      if (existingProfile?.role === 'agency') {
        throw new HttpError(409, 'Este email já possui uma conta de gestor sênior e não pode ser convidado como colaborador.');
      }
    }

    // Invalida convites anteriores de membro para esse email na org
    const { data: oldInvites } = await svc
      .from('client_invitations')
      .select('id')
      .eq('org_id', sess.orgId)
      .eq('email', body.email)
      .eq('invite_type', 'member')
      .is('accepted_at', null);
    if (oldInvites?.length) {
      const ids = oldInvites.map((i: any) => i.id);
      await svc.from('invitation_member_clients').delete().in('invitation_id', ids);
      await svc.from('client_invitations').delete().in('id', ids);
    }

    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();

    const { data: inv, error: invErr } = await svc.from('client_invitations').insert({
      org_id: sess.orgId,
      token,
      email: body.email,
      expires_at: expiresAt,
      created_by: sess.userId,
      invite_type: 'member',
      member_role: body.member_role,
    }).select('id').single();
    if (invErr) throw new HttpError(500, invErr.message);

    // Associa clientes ao convite
    const { error: mcErr } = await svc.from('invitation_member_clients').insert(
      body.client_ids.map(cid => ({ invitation_id: inv.id, client_id: cid })),
    );
    if (mcErr) throw new HttpError(500, mcErr.message);

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.WEB_ORIGIN ??
      `${req.protocol}://${req.get('host')}`;
    const inviteUrl = `${origin}/invite/${token}`;

    let emailSent = false;
    try {
      const { error: mailErr } = await svc.auth.admin.inviteUserByEmail(body.email, {
        redirectTo: `${origin}/auth/callback?invite=${token}`,
      });
      emailSent = !mailErr;
    } catch { /* link continua válido para envio manual */ }

    return { ok: true, inviteUrl, expiresAt, emailSent };
  }

  /** Remove um colaborador da org */
  @Delete(':userId')
  async remove(
    @CurrentSession() session: SessionOrPending | null,
    @Param('userId') userId: string,
  ) {
    const sess = this.org.requireAgency(session);
    const svc = this.supabase.service();

    // Garante que é membro da mesma org
    const { data: mem } = await svc
      .from('organization_members')
      .select('id')
      .eq('user_id', userId)
      .eq('org_id', sess.orgId)
      .not('member_role', 'is', null)
      .maybeSingle();
    if (!mem) throw new HttpError(404, 'Colaborador não encontrado');

    await svc.from('member_client_access').delete()
      .eq('member_user_id', userId).eq('org_id', sess.orgId);
    await svc.from('organization_members').delete()
      .eq('user_id', userId).eq('org_id', sess.orgId).not('member_role', 'is', null);
    await svc.from('profiles').update({ role: null, current_org_id: null })
      .eq('id', userId);

    return { ok: true };
  }

  /** Atualiza role ou lista de clients de um colaborador */
  @Patch(':userId')
  async update(
    @CurrentSession() session: SessionOrPending | null,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(PatchMemberBody)) body: PatchMemberBodyType,
  ) {
    const sess = this.org.requireAgency(session);
    const svc = this.supabase.service();

    const { data: mem } = await svc
      .from('organization_members')
      .select('id')
      .eq('user_id', userId)
      .eq('org_id', sess.orgId)
      .not('member_role', 'is', null)
      .maybeSingle();
    if (!mem) throw new HttpError(404, 'Colaborador não encontrado');

    if (body.member_role) {
      await svc.from('organization_members')
        .update({ member_role: body.member_role })
        .eq('user_id', userId).eq('org_id', sess.orgId);
    }

    if (body.client_ids !== undefined) {
      // Valida clients
      const { data: valid } = await svc.from('clients')
        .select('id').eq('org_id', sess.orgId).in('id', body.client_ids);
      if (!valid || valid.length !== body.client_ids.length) {
        throw new HttpError(400, 'Um ou mais clientes inválidos');
      }
      // Substitui acesso
      await svc.from('member_client_access').delete()
        .eq('member_user_id', userId).eq('org_id', sess.orgId);
      if (body.client_ids.length > 0) {
        await svc.from('member_client_access').insert(
          body.client_ids.map(cid => ({
            member_user_id: userId,
            org_id: sess.orgId,
            client_id: cid,
          })),
        );
      }
    }

    return { ok: true };
  }
}
