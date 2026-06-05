import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Atualiza cookies de sessão + redireciona conforme rota e estado.
 *
 * Rotas:
 *   - públicas: /, /login, /invite/*, /api/health
 *   - auth-only: /auth/*
 *   - agência:   /dashboard/**  /onboarding  /api/(meta|clients|org|accounts)
 *   - cliente:   /portal/**     /api/portal/*
 *
 * Se um cliente tentar acessar área de agência (ou vice-versa) → redireciona.
 * Decisão fina de papel acontece nas APIs via requireAgency/requireClient.
 * Aqui o middleware só faz hard-stops óbvios baseado em login + path.
 */
export async function updateSession(request: NextRequest) {
    // /test é a rota de smoke-test da Fase 2 (Next ↔ Nest). Bypassa Supabase
    // totalmente pra funcionar sem .env.local. Remover quando a Fase 2 fechar.
    if (request.nextUrl.pathname === "/test") {
        return NextResponse.next({ request });
    }

    let response = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return request.cookies.getAll(); },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
                },
            },
        },
    );

    const { data: { user } } = await supabase.auth.getUser();
    const path = request.nextUrl.pathname;

    const isPublic = path === "/" || path.startsWith("/api/health") || path.startsWith("/invite");
    const isAuth   = path.startsWith("/login") || path.startsWith("/auth");

    if (!user) {
        if (isPublic || isAuth) return response;
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("next", path);
        return NextResponse.redirect(url);
    }

    // Logado. Não redirecionamos cliente↔agência aqui pra evitar query de DB no middleware;
    // as APIs e páginas resolvem o papel correto via resolveSession() e direcionam.
    return response;
}
