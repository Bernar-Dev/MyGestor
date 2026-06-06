/**
 * Helpers de organização (tenant) e papel do usuário.
 *
 * Hierarquia:
 *   - profile.role = 'agency'  → opera uma organization (gestor/agência)
 *   - profile.role = 'client'  → é cliente de uma agência (portal só-leitura)
 *
 * Toda rota server deve começar com `resolveSession()` pra saber:
 *   - quem é o user
 *   - se é agency ou client
 *   - se agency: qual org ativa (orgId)
 *   - se client: qual client_id e org_id
 */
import { createClient, createServiceClient } from "@/lib/supabase/server";

export type UserRole = "agency" | "client";

export interface AgencySession {
    role: "agency";
    userId: string;
    email: string;
    orgId: string;
    orgRole: "owner" | "manager";
}

export interface ClientSession {
    role: "client";
    userId: string;
    email: string;
    clientId: string;
    orgId: string;
}

export type Session = AgencySession | ClientSession;

export async function getAuthUser(): Promise<{ id: string; email: string } | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return { id: user.id, email: user.email ?? "" };
}

/**
 * Resolve a sessão completa do usuário logado.
 * Retorna null se não estiver logado.
 * Retorna { needsOnboarding: true } se for agency sem org ainda.
 */
export async function resolveSession(): Promise<
    | Session
    | { needsOnboarding: true; userId: string; email: string }
    | null
> {
    const user = await getAuthUser();
    if (!user) return null;

    const svc = createServiceClient();

    // 1) profile
    const { data: profile } = await svc
        .from("profiles")
        .select("role, current_org_id, client_id")
        .eq("id", user.id)
        .maybeSingle();

    if (!profile) {
        // trigger handle_new_user devia ter rodado — caso raro, devolve onboarding
        return { needsOnboarding: true, userId: user.id, email: user.email };
    }

    // 2) Cliente?
    if (profile.role === "client" && profile.client_id) {
        const { data: client } = await svc
            .from("clients")
            .select("id, org_id")
            .eq("id", profile.client_id)
            .maybeSingle();
        if (!client) return null;
        return {
            role: "client",
            userId: user.id,
            email: user.email,
            clientId: client.id,
            orgId: client.org_id,
        };
    }

    // 3) Agency — precisa ter org + membership
    const orgId = profile.current_org_id;
    if (!orgId) {
        // Tenta achar uma org onde já é member (caso current_org_id não esteja setado)
        const { data: anyMembership } = await svc
            .from("organization_members")
            .select("org_id, role")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();
        if (!anyMembership) {
            return { needsOnboarding: true, userId: user.id, email: user.email };
        }
        return {
            role: "agency",
            userId: user.id,
            email: user.email,
            orgId: anyMembership.org_id,
            orgRole: anyMembership.role as "owner" | "manager",
        };
    }

    const { data: membership } = await svc
        .from("organization_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("org_id", orgId)
        .maybeSingle();
    if (!membership) {
        return { needsOnboarding: true, userId: user.id, email: user.email };
    }

    return {
        role: "agency",
        userId: user.id,
        email: user.email,
        orgId,
        orgRole: membership.role as "owner" | "manager",
    };
}

/**
 * Garante que o usuário é agency em alguma org. Lança 401/403 implícito
 * pra rota chamadora tratar.
 */
export async function requireAgency(): Promise<AgencySession> {
    const s = await resolveSession();
    if (!s) throw new HttpError(401, "Não autenticado");
    if ("needsOnboarding" in s) throw new HttpError(409, "Onboarding pendente");
    if (s.role !== "agency") throw new HttpError(403, "Acesso restrito a gestores/agências");
    return s;
}

export async function requireClient(): Promise<ClientSession> {
    const s = await resolveSession();
    if (!s) throw new HttpError(401, "Não autenticado");
    if ("needsOnboarding" in s) throw new HttpError(409, "Onboarding pendente");
    if (s.role !== "client") throw new HttpError(403, "Acesso restrito a clientes");
    return s;
}

/**
 * Cria uma org + adiciona o user como owner + seta como current_org_id.
 * Idempotente por slug.
 */
export async function createOrganization(opts: {
    userId: string;
    name: string;
    slug?: string;
}): Promise<{ id: string; slug: string }> {
    const svc = createServiceClient();
    const slug = (opts.slug || opts.name)
        .toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        .slice(0, 48) || `org-${Date.now()}`;

    // Garante unicidade do slug
    let finalSlug = slug;
    for (let i = 2; i < 100; i++) {
        const { data: hit } = await svc.from("organizations").select("id").eq("slug", finalSlug).maybeSingle();
        if (!hit) break;
        finalSlug = `${slug}-${i}`;
    }

    const { data: org, error } = await svc
        .from("organizations")
        .insert({
            slug: finalSlug,
            name: opts.name,
            owner_user_id: opts.userId,
            plan: "free",
        })
        .select("id, slug")
        .single();
    if (error || !org) throw new Error(error?.message || "Falha ao criar organização");

    // Membership
    const { error: memErr } = await svc.from("organization_members").insert({
        org_id: org.id,
        user_id: opts.userId,
        role: "owner",
    });
    if (memErr) throw new Error(memErr.message);

    // current_org_id no profile
    const { error: profErr } = await svc
        .from("profiles")
        .update({ current_org_id: org.id, role: "agency" })
        .eq("id", opts.userId);
    if (profErr) throw new Error(profErr.message);

    return { id: org.id, slug: org.slug };
}

/**
 * Verifica se um cliente da org tem acesso a uma ad_account específica.
 * Usado pelo portal.
 */
export async function clientCanAccessAdAccount(clientId: string, adAccountId: string): Promise<{
    allowed: boolean;
    permissions?: Record<string, boolean>;
}> {
    const svc = createServiceClient();
    const { data } = await svc
        .from("client_ad_accounts")
        .select("permissions")
        .eq("client_id", clientId)
        .eq("ad_account_id", adAccountId)
        .maybeSingle();
    if (!data) return { allowed: false };
    return { allowed: true, permissions: (data.permissions || {}) as Record<string, boolean> };
}

// ─── HttpError ────────────────────────────────────────────────────────
// Permite que rotas joguem `throw new HttpError(...)` e o handler converte.
export class HttpError extends Error {
    status: number;
    constructor(status: number, msg: string) {
        super(msg);
        this.status = status;
    }
}

export function errorResponse(e: unknown): { status: number; body: { error: string } } {
    if (e instanceof HttpError) return { status: e.status, body: { error: e.message } };
    const msg = e instanceof Error ? e.message : "Erro interno";
    return { status: 500, body: { error: msg } };
}
