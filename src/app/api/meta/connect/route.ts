import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { loadMetaCredentials } from "@/lib/meta/store";
import { buildAuthorizeUrl, buildRedirectUri } from "@/lib/meta/oauth";
import { resolveSession } from "@/lib/org";

export const dynamic = "force-dynamic";

/**
 * Inicia o OAuth dance com o Facebook usando o App da org.
 * Cookie `meta_oauth_state` é um nonce CSRF (httpOnly, 10min).
 */
export async function GET(request: Request) {
    const sess = await resolveSession();
    if (!sess) return NextResponse.redirect(new URL("/login", request.url));
    if ("needsOnboarding" in sess) return NextResponse.redirect(new URL("/onboarding", request.url));
    if (sess.role !== "agency") return NextResponse.redirect(new URL("/portal", request.url));

    const creds = await loadMetaCredentials(sess.orgId);
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
    res.cookies.set("meta_oauth_org", sess.orgId, {
        httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600,
    });
    return res;
}
