import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private _service!: SupabaseClient;
  private url!: string;
  private anonKey!: string;

  onModuleInit() {
    this.url = process.env.SUPABASE_URL ?? '';
    this.anonKey = process.env.SUPABASE_ANON_KEY ?? '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

    if (!this.url || !this.anonKey || !serviceKey) {
      throw new Error(
        'Missing Supabase env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY',
      );
    }

    // Decode JWT payload to validate key role at startup (no secret needed)
    try {
      const payload = JSON.parse(
        Buffer.from(serviceKey.split('.')[1], 'base64').toString(),
      );
      console.log('[supabase] key role:', payload.role, '| url project:', this.url.split('.')[0].split('//')[1]);
    } catch {
      console.warn('[supabase] could not decode service key payload');
    }

    this._service = createClient(this.url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /** Client com service_role — bypassa RLS. Usar SÓ depois de autenticar o request. */
  service(): SupabaseClient {
    return this._service;
  }

  /** Client autenticado como o user dono do JWT (respeita RLS). */
  asUser(jwt: string): SupabaseClient {
    return createClient(this.url, this.anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /** Valida o JWT contra o Supabase Auth. Retorna o user, ou null se inválido/expirado. */
  async getUserFromToken(jwt: string): Promise<User | null> {
    const { data, error } = await this._service.auth.getUser(jwt);
    if (error || !data.user) return null;
    return data.user;
  }
}
