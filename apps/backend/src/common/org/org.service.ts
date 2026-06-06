import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { HttpError } from '../exceptions/http-error';
import {
  AgencySession,
  ClientSession,
  SessionOrPending,
} from './types';

@Injectable()
export class OrgService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Resolve a sessão completa do user já autenticado.
   * Retorna null se o user não tem profile válido (caso raro).
   */
  async resolveSession(
    userId: string,
    email: string,
  ): Promise<SessionOrPending | null> {
    const svc = this.supabase.service();

    const { data: profile } = await svc
      .from('profiles')
      .select('role, current_org_id, client_id')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) {
      return { needsOnboarding: true, userId, email };
    }

    if (profile.role === 'client' && profile.client_id) {
      const { data: client } = await svc
        .from('clients')
        .select('id, org_id')
        .eq('id', profile.client_id)
        .maybeSingle();
      if (!client) return null;
      return {
        role: 'client',
        userId,
        email,
        clientId: client.id,
        orgId: client.org_id,
      };
    }

    const orgId = profile.current_org_id as string | null;
    if (!orgId) {
      const { data: anyMembership } = await svc
        .from('organization_members')
        .select('org_id, role')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (!anyMembership) {
        return { needsOnboarding: true, userId, email };
      }
      return {
        role: 'agency',
        userId,
        email,
        orgId: anyMembership.org_id,
        orgRole: anyMembership.role as 'owner' | 'manager',
      };
    }

    const { data: membership } = await svc
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .maybeSingle();
    if (!membership) {
      return { needsOnboarding: true, userId, email };
    }

    return {
      role: 'agency',
      userId,
      email,
      orgId,
      orgRole: membership.role as 'owner' | 'manager',
    };
  }

  requireAgency(session: SessionOrPending | null | undefined): AgencySession {
    if (!session) throw new HttpError(401, 'Não autenticado');
    if ('needsOnboarding' in session) throw new HttpError(409, 'Onboarding pendente');
    if (session.role !== 'agency') {
      throw new HttpError(403, 'Acesso restrito a gestores/agências');
    }
    return session;
  }

  requireClient(session: SessionOrPending | null | undefined): ClientSession {
    if (!session) throw new HttpError(401, 'Não autenticado');
    if ('needsOnboarding' in session) throw new HttpError(409, 'Onboarding pendente');
    if (session.role !== 'client') {
      throw new HttpError(403, 'Acesso restrito a clientes');
    }
    return session;
  }

  async createOrganization(opts: {
    userId: string;
    name: string;
    slug?: string;
  }): Promise<{ id: string; slug: string }> {
    const svc = this.supabase.service();
    const baseSlug =
      (opts.slug || opts.name)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || `org-${Date.now()}`;

    let finalSlug = baseSlug;
    for (let i = 2; i < 100; i++) {
      const { data: hit } = await svc
        .from('organizations')
        .select('id')
        .eq('slug', finalSlug)
        .maybeSingle();
      if (!hit) break;
      finalSlug = `${baseSlug}-${i}`;
    }

    const { data: org, error } = await svc
      .from('organizations')
      .insert({
        slug: finalSlug,
        name: opts.name,
        owner_user_id: opts.userId,
        plan: 'free',
      })
      .select('id, slug')
      .single();
    if (error || !org) {
      console.error('[createOrg] INSERT organizations failed:', JSON.stringify(error));
      throw new HttpError(500, error?.message || 'Falha ao criar organização');
    }

    const { error: memErr } = await svc.from('organization_members').insert({
      org_id: org.id,
      user_id: opts.userId,
      role: 'owner',
    });
    if (memErr) {
      console.error('[createOrg] INSERT organization_members failed:', JSON.stringify(memErr));
      throw new HttpError(500, memErr.message);
    }

    const { error: profErr } = await svc
      .from('profiles')
      .update({ current_org_id: org.id, role: 'agency' })
      .eq('id', opts.userId);
    if (profErr) {
      console.error('[createOrg] UPDATE profiles failed:', JSON.stringify(profErr));
      throw new HttpError(500, profErr.message);
    }

    return { id: org.id, slug: org.slug };
  }

  async clientCanAccessAdAccount(
    clientId: string,
    adAccountId: string,
  ): Promise<{
    allowed: boolean;
    permissions?: Record<string, boolean>;
  }> {
    const svc = this.supabase.service();
    const { data } = await svc
      .from('client_ad_accounts')
      .select('permissions')
      .eq('client_id', clientId)
      .eq('ad_account_id', adAccountId)
      .maybeSingle();
    if (!data) return { allowed: false };
    return {
      allowed: true,
      permissions: (data.permissions || {}) as Record<string, boolean>,
    };
  }
}
