import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentUserId, loadMetaCredentials } from "@/lib/meta/store";
import { buildAuthorizeUrl, buildRedirectUri } from "@/lib/meta/oauth";

export const dynamic = "force-dynamic";

/**
 * Inicia o OAuth dance com o Facebook. Lê as credenciais salvas do user,
 * monta a authorize URL com o client_id dele e redireciona o navegador.
 *
 * O `state` é um nonce gravado em cookie httpOnly pra prevenir CSRF.
 */
export async function GET(request: Request) {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.redirect(new URL("/login", request.url));

    const creds = await loadMetaCredentials(userId);
    if (!creds) return NextResponse.redirect(new URL("/onboarding", request.url));

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const redirectUri = buildRedirectUri(origin);
    const state = randomBytes(24).toString("base64url");

    const authorizeUrl = buildAuthorizeUrl({
        appId: creds.app_id,
        redirectUri,
        state,
    });

    const res = NextResponse.redirect(authorizeUrl);
    res.cookies.set("meta_oauth_state", state, {
        httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600,
    });
    return res;
}
