import { Controller, Get, Param, Post } from '@nestjs/common';
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
      .select('id, email, expires_at, accepted_at, client_id, org_id')
      .eq('token', token)
      .maybeSingle();
    if (!data) throw new HttpError(404, 'Convite inválido');
    if (data.accepted_at) throw new HttpError(410, 'Convite já aceito');
    if (new Date(data.expires_at).getTime() < Date.now()) {
      throw new HttpError(410, 'Convite expirado');
    }

    const { data: client } = await svc
      .from('clients')
      .select('name')
      .eq('id', data.client_id)
      .single();
    const { data: org } = await svc
      .from('organizations')
      .select('name, logo_url, primary_color')
      .eq('id', data.org_id)
      .single();

    return {
      email: data.email,
      client_name: client?.name,
      org_name: org?.name,
      org_logo_url: org?.logo_url,
      org_primary_color: org?.primary_color,
    };
  }

  @Post(':token')
  async accept(
    @CurrentUser() user: AuthUser,
    @Param('token') token: string,
  ) {
    const svc = this.supabase.service();
    const { data: invite } = await svc
      .from('client_invitations')
      .select('id, email, expires_at, accepted_at, client_id, org_id')
      .eq('token', token)
      .maybeSingle();
    if (!invite) throw new HttpError(404, 'Convite inválido');
    if (invite.accepted_at) throw new HttpError(410, 'Convite já aceito');
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      throw new HttpError(410, 'Convite expirado');
    }

    if (invite.email.toLowerCase() !== (user.email || '').toLowerCase()) {
      throw new HttpError(
        403,
        `Este convite é para ${invite.email}. Faça login com esse email.`,
      );
    }

    // Bloqueia se o usuário já é dono de uma agência
    const { data: profile } = await svc
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role === 'agency') {
      throw new HttpError(
        409,
        'Sua conta já é uma conta de agência e não pode aceitar convites de cliente.',
      );
    }

    const { error: cErr } = await svc
      .from('clients')
      .update({
        auth_user_id: user.id,
        portal_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invite.client_id);
    if (cErr) throw new HttpError(500, cErr.message);

    const { error: pErr } = await svc
      .from('profiles')
      .update({
        role: 'client',
        client_id: invite.client_id,
        current_org_id: null,
      })
      .eq('id', user.id);
    if (pErr) throw new HttpError(500, pErr.message);

    await svc
      .from('client_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    return { ok: true, redirect: '/portal' };
  }
}
