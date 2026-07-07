import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { HttpError } from '../../common/exceptions/http-error';
import type { AuthUser } from '../../common/org/types';

@Controller('invite')
export class InvitesController {
  constructor(private readonly supabase: SupabaseService) {}

  @Public()
  @Get(':token')
  async get(@Param('token') token: string) {
    const svc = this.supabase.service();
    const { data } = await svc
      .from('client_invitations')
      .select('id, email, expires_at, accepted_at, client_id, org_id, invite_type, member_role')
      .eq('token', token)
      .maybeSingle();
    if (!data) throw new HttpError(404, 'Convite inválido');
    if (data.accepted_at) throw new HttpError(410, 'Convite já aceito');
    if (new Date(data.expires_at).getTime() < Date.now()) {
      throw new HttpError(410, 'Convite expirado');
    }

    const { data: org } = await svc
      .from('organizations')
      .select('name, logo_url, primary_color')
      .eq('id', data.org_id)
      .single();

    let userExists = false;
    let userIsGestor = false;
    const { data: usersPage } = await svc.auth.admin.listUsers({ perPage: 1000 });
    if (usersPage?.users) {
      const found = usersPage.users.find(
        (u: { email?: string | null; email_confirmed_at?: string | null }) =>
          u.email?.toLowerCase() === data.email.toLowerCase() && !!u.email_confirmed_at,
      );
      if (found) {
        userExists = true;
        const { data: profile } = await svc
          .from('profiles').select('role').eq('id', found.id).maybeSingle();
        userIsGestor = profile?.role === 'agency';
      }
    }

    let clientNames: string[] = [];
    let clientName: string | null = null;

    if (data.invite_type === 'member') {
      const { data: invClients } = await svc
        .from('invitation_member_clients')
        .select('client_id, clients(name)')
        .eq('invitation_id', data.id);
      clientNames = (invClients || []).map((r: any) => r.clients?.name).filter(Boolean);
    } else if (data.client_id) {
      const { data: client } = await svc
        .from('clients').select('name').eq('id', data.client_id).single();
      clientName = client?.name ?? null;
    }

    return {
      email: data.email,
      invite_type: data.invite_type || 'client',
      member_role: data.member_role || null,
      client_name: clientName,
      client_names: clientNames,
      org_name: org?.name,
      org_logo_url: org?.logo_url,
      org_primary_color: org?.primary_color,
      user_exists: userExists,
      user_is_gestor: userIsGestor,
    };
  }

  @Public()
  @Post(':token/signup')
  async signup(
    @Param('token') token: string,
    @Body() body: { password: string },
  ) {
    if (!body.password || body.password.length < 6) {
      throw new HttpError(400, 'Senha deve ter pelo menos 6 caracteres');
    }
    const svc = this.supabase.service();

    const { data: invite } = await svc
      .from('client_invitations')
      .select('id, email, expires_at, accepted_at, client_id, org_id, invite_type, member_role, created_by')
      .eq('token', token)
      .maybeSingle();
    if (!invite) throw new HttpError(404, 'Convite inválido');
    if (invite.accepted_at) throw new HttpError(410, 'Convite já aceito');
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      throw new HttpError(410, 'Convite expirado');
    }

    const { data: usersPage } = await svc.auth.admin.listUsers({ perPage: 1000 });
    const existing = usersPage?.users?.find(
      (u: { email?: string | null; email_confirmed_at?: string | null }) =>
        u.email?.toLowerCase() === invite.email.toLowerCase() && !!u.email_confirmed_at,
    );
    if (existing) {
      throw new HttpError(409, 'Você já tem uma conta com este email. Use sua senha para entrar.');
    }

    const pending = usersPage?.users?.find(
      (u: { email?: string | null }) =>
        u.email?.toLowerCase() === invite.email.toLowerCase(),
    );

    let userId: string;
    if (pending) {
      await svc.auth.admin.updateUserById(pending.id, { password: body.password, email_confirm: true });
      userId = pending.id;
    } else {
      const { data: created, error: createErr } = await svc.auth.admin.createUser({
        email: invite.email, password: body.password, email_confirm: true,
      });
      if (createErr) throw new HttpError(500, createErr.message);
      userId = created.user.id;
    }

    await this._acceptInvite(svc, invite, userId);
    return { ok: true, invite_type: invite.invite_type || 'client' };
  }

  @Post(':token')
  async accept(
    @CurrentUser() user: AuthUser,
    @Param('token') token: string,
  ) {
    const svc = this.supabase.service();
    const { data: invite } = await svc
      .from('client_invitations')
      .select('id, email, expires_at, accepted_at, client_id, org_id, invite_type, member_role, created_by')
      .eq('token', token)
      .maybeSingle();
    if (!invite) throw new HttpError(404, 'Convite inválido');
    if (invite.accepted_at) throw new HttpError(410, 'Convite já aceito');
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      throw new HttpError(410, 'Convite expirado');
    }

    if (invite.email.toLowerCase() !== (user.email || '').toLowerCase()) {
      throw new HttpError(403, `Este convite é para ${invite.email}. Faça login com esse email.`);
    }

    const { data: profile } = await svc
      .from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role === 'agency') {
      throw new HttpError(409, 'Contas de gestor sênior não podem aceitar convites.');
    }

    await this._acceptInvite(svc, invite, user.id);
    return {
      ok: true,
      redirect: invite.invite_type === 'member' ? '/dashboard' : '/portal',
    };
  }

  private async _acceptInvite(svc: any, invite: any, userId: string) {
    if (invite.invite_type === 'member') {
      const { error: profErr } = await svc.from('profiles').upsert(
        { id: userId, email: invite.email, role: 'member', current_org_id: null, client_id: null },
        { onConflict: 'id' },
      );
      if (profErr) throw new HttpError(500, `Erro ao configurar perfil: ${profErr.message}`);

      const { error: memErr } = await svc.from('organization_members').upsert(
        {
          org_id: invite.org_id,
          user_id: userId,
          member_role: invite.member_role || 'observador',
          invited_by: invite.created_by ?? null,
        },
        { onConflict: 'user_id,org_id' },
      );
      if (memErr) throw new HttpError(500, `Erro ao vincular organização: ${memErr.message}`);

      const { data: invClients } = await svc
        .from('invitation_member_clients')
        .select('client_id')
        .eq('invitation_id', invite.id);

      const clientIds = (invClients || []).map((r: any) => r.client_id);
      if (clientIds.length > 0) {
        await svc.from('member_client_access').delete()
          .eq('member_user_id', userId).eq('org_id', invite.org_id);
        await svc.from('member_client_access').insert(
          clientIds.map((cid: string) => ({
            member_user_id: userId,
            org_id: invite.org_id,
            client_id: cid,
          })),
        );
      }
    } else {
      // Convite de portal (cliente da agência)
      await svc.from('clients').update({
        auth_user_id: userId,
        portal_enabled: true,
        updated_at: new Date().toISOString(),
      }).eq('id', invite.client_id);

      await svc.from('profiles').upsert(
        { id: userId, role: 'client', client_id: invite.client_id, current_org_id: null },
        { onConflict: 'id' },
      );
    }

    await svc.from('client_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);
  }
}
