import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/org";

/**
 * Callback do Supabase Auth (Google OAuth, magic link, signup).
 * Troca o ?code= pelo cookie de sessão e roteia conforme o papel:
 *   - cliente → /portal
 *   - agência sem org → /onboarding (passo 0 cria a org)
 *   - agência com org → ?next ou /dashboard
 *
 * Se houver ?invite=<token>, vai pra /invite/<token> pra completar o aceite.
 */
export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next");
    const invite = searchParams.get("invite");

    if (code) {
        const supabase = await createClient();
        // Se for fluxo de reset de senha, desloga sessão atual antes de estabelecer
        // a sessão de recovery — evita trocar a senha do usuário logado por engano.
        if (next === "/reset-password") {
            await supabase.auth.signOut();
        }
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) return NextResponse.redirect(`${origin}/login?error=auth_callback`);
    }

    if (invite) return NextResponse.redirect(`${origin}/invite/${invite}`);

    const sess = await resolveSession();
    if (!sess) return NextResponse.redirect(`${origin}/login`);

    if ("needsOnboarding" in sess) return NextResponse.redirect(`${origin}/onboarding`);
    if (sess.role === "client") return NextResponse.redirect(`${origin}/portal`);
    return NextResponse.redirect(`${origin}${next || "/dashboard"}`);
}
