/**
 * Persistência das credenciais Meta da ORGANIZAÇÃO.
 * Usa service_role para bypassar RLS após validação do usuário no guard.
 */
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CryptoService } from '../crypto/crypto.service';

export interface MetaCredentials {
  app_id: string;
  app_secret: string;
  app_name: string | null;
  redirect_uri: string;
}

export interface MetaTokenRow {
  access_token: string;
  fb_user_id: string | null;
  fb_user_name: string | null;
  scopes: string[] | null;
  expires_at: string | null;
  refreshed_at: string;
}

@Injectable()
export class MetaStoreService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly crypto: CryptoService,
  ) {}

  async saveCredentials(orgId: string, opts: {
    appId: string;
    appSecret: string;
    appName?: string;
    redirectUri: string;
  }): Promise<void> {
    const svc = this.supabase.service();
    const { error } = await svc.from('meta_credentials').upsert({
      org_id: orgId,
      app_id: opts.appId,
      app_secret_encrypted: this.crypto.encrypt(opts.appSecret),
      app_name: opts.appName || null,
      redirect_uri: opts.redirectUri,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id' });
    if (error) throw new Error(error.message);
  }

  async loadCredentials(orgId: string): Promise<MetaCredentials | null> {
    const svc = this.supabase.service();
    const { data, error } = await svc
      .from('meta_credentials')
      .select('app_id, app_secret_encrypted, app_name, redirect_uri')
      .eq('org_id', orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      app_id: data.app_id,
      app_secret: this.crypto.decrypt(data.app_secret_encrypted),
      app_name: data.app_name,
      redirect_uri: data.redirect_uri,
    };
  }

  async deleteCredentials(orgId: string): Promise<void> {
    const svc = this.supabase.service();
    await svc.from('meta_credentials').delete().eq('org_id', orgId);
  }

  async saveToken(orgId: string, token: {
    accessToken: string;
    fbUserId?: string;
    fbUserName?: string;
    scopes?: string[];
    expiresInSeconds?: number;
  }): Promise<void> {
    const svc = this.supabase.service();
    const expiresAt = token.expiresInSeconds && token.expiresInSeconds > 0
      ? new Date(Date.now() + token.expiresInSeconds * 1000).toISOString()
      : null;
    const { error } = await svc.from('meta_tokens').upsert({
      org_id: orgId,
      access_token_encrypted: this.crypto.encrypt(token.accessToken),
      fb_user_id: token.fbUserId || null,
      fb_user_name: token.fbUserName || null,
      scopes: token.scopes || null,
      expires_at: expiresAt,
      refreshed_at: new Date().toISOString(),
    }, { onConflict: 'org_id' });
    if (error) throw new Error(error.message);
  }

  async loadToken(orgId: string): Promise<MetaTokenRow | null> {
    const svc = this.supabase.service();
    const { data, error } = await svc
      .from('meta_tokens')
      .select('access_token_encrypted, fb_user_id, fb_user_name, scopes, expires_at, refreshed_at')
      .eq('org_id', orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      access_token: this.crypto.decrypt(data.access_token_encrypted),
      fb_user_id: data.fb_user_id,
      fb_user_name: data.fb_user_name,
      scopes: data.scopes,
      expires_at: data.expires_at,
      refreshed_at: data.refreshed_at,
    };
  }

  async deleteToken(orgId: string): Promise<void> {
    const svc = this.supabase.service();
    await svc.from('meta_tokens').delete().eq('org_id', orgId);
  }
}
