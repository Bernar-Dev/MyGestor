import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserId, loadMetaCredentials, saveMetaToken } from "@/lib/meta/store";
import { buildRedirectUri } from "@/lib/meta/oauth";
import { exchangeCodeForToken, exchangeForLongLivedToken, getMe } from "@/lib/meta/api";

export const dynamic = "force-dynamic";

/**
 * Callback do Facebook após o usuário autorizar.
 * Fluxo:
 *   1. valida state cookie
 *   2. troca ?code= por short-lived token (via App ID/Secret do user)
 *   3. troca short por long-lived (~60 dias)
 *   4. busca /me pra saber quem autorizou
 *   5. salva tudo cifrado e redireciona pro dashboard
 */
export async function GET(request: NextRequest) {
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const fbError = searchParams.get("error_description") || searchParams.get("error");

    if (fbError) return redirectWithMessage(origin, "error", fbError);
    if (!code) return redirectWithMessage(origin, "error", "Codigo OAuth ausente");

    const cookieState = request.cookies.get("meta_oauth_state")?.value;
    if (!cookieState || cookieState !== state) {
        return redirectWithMessage(origin, "error", "State invalido (possivel CSRF)");
    }

    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.redirect(new URL("/login", request.url));

    const creds = await loadMetaCredentials(userId);
    if (!creds) return redirectWithMessage(origin, "error", "Credenciais Meta nao encontradas");

    try {
        const redirectUri = buildRedirectUri(origin);

        // 1) code → short-lived token
        const shortTok = await exchangeCodeForToken({
            appId: creds.app_id, appSecret: creds.app_secret,
            code, redirectUri,
        });

        // 2) short → long-lived (~60 dias)
        const longTok = await exchangeForLongLivedToken({
            appId: creds.app_id, appSecret: creds.app_secret,
            shortLivedToken: shortTok.access_token,
        });

        // 3) quem é o user?
        const me = await getMe(longTok.access_token);

        // 4) persiste
        await saveMetaToken(userId, {
            accessToken: longTok.access_token,
            fbUserId: me.id,
            fbUserName: me.name,
            scopes: ["ads_read", "ads_management", "business_management", "read_insights"],
            expiresInSeconds: longTok.expires_in,
        });
    } catch (e: any) {
        return redirectWithMessage(origin, "error", e.message || "Falha ao concluir OAuth");
    }

    const res = NextResponse.redirect(`${origin}/dashboard?meta=connected`);
    res.cookies.delete("meta_oauth_state");
    return res;
}

function redirectWithMessage(origin: string, kind: "error" | "info", msg: string) {
    return NextResponse.redirect(`${origin}/onboarding?${kind}=${encodeURIComponent(msg)}`);
}
