import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options),
                        );
                    } catch {
                        // chamado de um Server Component — pode ignorar; middleware mantém o cookie atualizado.
                    }
                },
            },
        },
    );
}

/**
 * Client com service_role — usa SOMENTE em rotas server-side para operações
 * que precisam bypassar RLS (ex: salvar tokens cifrados). NUNCA exponha pro client.
 */
export function createServiceClient() {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { cookies: { getAll: () => [], setAll: () => { } } },
    );
}
