/**
 * Obtém o access token Meta do backend NestJS (server-side only).
 * Usa para as rotas /api/meugestor/* que precisam chamar a Meta Graph API.
 */
import { createClient } from '@/lib/supabase/server';

export async function getMetaAccessToken(): Promise<string> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Não autenticado');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${apiUrl}/api/meta/access-token`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Erro ao obter token Meta (${res.status})`);
  }

  const data = await res.json();
  return data.accessToken as string;
}
