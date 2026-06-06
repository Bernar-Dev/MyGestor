import { NextResponse, type NextRequest } from "next/server";
import { loadMetaCredentials, saveMetaToken } from "@/lib/meta/store";
import { buildRedirectUri } from "@/lib/meta/oauth";
import { exchangeCodeForToken, exchangeForLongLivedToken, getMe } from "@/lib/meta/api";
import { resolveSession } from "@/lib/org";

export const dynamic = "force-dynamic";

/**
 * Callback do Facebook após o usuário autorizar o app.
 *
 * Suporta dois modos (lido do cookie meta_oauth_platform):
 *  - platform=1 → usa META_PLATFORM_APP_ID/SECRET (env vars) — modo "Login com Facebook"
 *  - platform=0 → usa App ID/Secret da própria agência (meta_credentials) — modo legado
 *
 *  1. Valida state cookie + org cookie
 *  2. code → short-lived → long-lived (~60d)
 *  3. /me pra pegar fb_user_id + nome
 *  4. Salva token cifrado por org_id em meta_tokens
 */
export async function GET(request: NextRequest) {
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const fbError = searchParams.get("error_description") || searchParams.get("error");

    if (fbError) return redirectError(origin, fbError);
    if (!code) return redirectError(origin, "Codigo OAuth ausente");

    const cookieState = request.cookies.get("meta_oauth_state")?.value;
    const cookieOrg = request.cookies.get("meta_oauth_org")?.value;
    const isPlatform = request.cookies.get("meta_oauth_platform")?.value === "1";

    if (!cookieState || cookieState !== state) {
        return redirectError(origin, "State invalido (possivel CSRF)");
    }

    const sess = await resolveSession();
    if (!sess || "needsOnboarding" in sess || sess.role !== "agency") {
        return NextResponse.redirect(new URL("/login", request.url));
    }
    if (cookieOrg && cookieOrg !== sess.orgId) {
        return redirectError(origin, "Org cookie nao confere");
    }

    let appId: string;
    let appSecret: string;

    if (isPlatform) {
        appId = process.env.META_PLATFORM_APP_ID ?? "";
        appSecret = process.env.META_PLATFORM_APP_SECRET ?? "";
        if (!appId || !appSecret) {
            return redirectError(origin, "Plataforma nao configurada — fale com o suporte");
        }
    } else {
        const creds = await loadMetaCredentials(sess.orgId);
        if (!creds) return redirectError(origin, "Credenciais Meta nao encontradas");
        appId = creds.app_id;
        appSecret = creds.app_secret;
    }

    try {
        const redirectUri = buildRedirectUri(origin);

        const shortTok = await exchangeCodeForToken({ appId, appSecret, code, redirectUri });
        const longTok = await exchangeForLongLivedToken({
            appId, appSecret,
            shortLivedToken: shortTok.access_token,
        });
        const me = await getMe(longTok.access_token);

        await saveMetaToken(sess.orgId, {
            accessToken: longTok.access_token,
            fbUserId: me.id,
            fbUserName: me.name,
            scopes: ["ads_read", "ads_management", "business_management", "read_insights"],
            expiresInSeconds: longTok.expires_in,
        });
    } catch (e: any) {
        return redirectError(origin, e.message || "Falha ao concluir OAuth");
    }

    const res = NextResponse.redirect(`${origin}/dashboard/settings?meta=connected`);
    res.cookies.delete("meta_oauth_state");
    res.cookies.delete("meta_oauth_org");
    res.cookies.delete("meta_oauth_platform");
    return res;
}

function redirectError(origin: string, msg: string) {
    const url = new URL("/dashboard/settings", origin);
    url.searchParams.set("meta_error", msg);
    return NextResponse.redirect(url);
}
