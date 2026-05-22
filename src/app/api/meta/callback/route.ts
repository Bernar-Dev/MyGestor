import { NextResponse, type NextRequest } from "next/server";
import { loadMetaCredentials, saveMetaToken } from "@/lib/meta/store";
import { buildRedirectUri } from "@/lib/meta/oauth";
import { exchangeCodeForToken, exchangeForLongLivedToken, getMe } from "@/lib/meta/api";
import { resolveSession } from "@/lib/org";

export const dynamic = "force-dynamic";

/**
 * Callback do Facebook após autorização do owner da agência.
 *  1. valida state cookie + org cookie
 *  2. code → short-lived → long-lived (~60d)
 *  3. /me pra pegar fb_user_id
 *  4. salva token cifrado por org_id
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
    const cookieOrg = request.cookies.get("meta_oauth_org")?.value;
    if (!cookieState || cookieState !== state) {
        return redirectWithMessage(origin, "error", "State invalido (possivel CSRF)");
    }

    const sess = await resolveSession();
    if (!sess || "needsOnboarding" in sess || sess.role !== "agency") {
        return NextResponse.redirect(new URL("/login", request.url));
    }
    if (cookieOrg && cookieOrg !== sess.orgId) {
        return redirectWithMessage(origin, "error", "Org cookie nao confere");
    }

    const creds = await loadMetaCredentials(sess.orgId);
    if (!creds) return redirectWithMessage(origin, "error", "Credenciais Meta nao encontradas");

    try {
        const redirectUri = buildRedirectUri(origin);

        const shortTok = await exchangeCodeForToken({
            appId: creds.app_id, appSecret: creds.app_secret, code, redirectUri,
        });
        const longTok = await exchangeForLongLivedToken({
            appId: creds.app_id, appSecret: creds.app_secret,
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
        return redirectWithMessage(origin, "error", e.message || "Falha ao concluir OAuth");
    }

    const res = NextResponse.redirect(`${origin}/dashboard?meta=connected`);
    res.cookies.delete("meta_oauth_state");
    res.cookies.delete("meta_oauth_org");
    return res;
}

function redirectWithMessage(origin: string, kind: "error" | "info", msg: string) {
    return NextResponse.redirect(`${origin}/onboarding?${kind}=${encodeURIComponent(msg)}`);
}
