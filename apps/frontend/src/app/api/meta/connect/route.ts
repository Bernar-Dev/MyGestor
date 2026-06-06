import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { loadMetaCredentials } from "@/lib/meta/store";
import { buildAuthorizeUrl, buildRedirectUri } from "@/lib/meta/oauth";
import { resolveSession } from "@/lib/org";

export const dynamic = "force-dynamic";

/**
 * Inicia o OAuth dance com o Facebook.
 *
 * ?platform=1  → usa o App Meta da plataforma (META_PLATFORM_APP_ID/SECRET nas env vars)
 * sem parâmetro → usa o App Meta da própria agência (salvo em meta_credentials)
 *
 * Cookie `meta_oauth_state`    — nonce CSRF (httpOnly, 10min)
 * Cookie `meta_oauth_org`      — org_id para validar no callback
 * Cookie `meta_oauth_platform` — "1" se modo plataforma, "0" se per-agency
 */
export async function GET(request: Request) {
    const sess = await resolveSession();
    if (!sess) return NextResponse.redirect(new URL("/login", request.url));
    if ("needsOnboarding" in sess) return NextResponse.redirect(new URL("/onboarding", request.url));
    if (sess.role !== "agency") return NextResponse.redirect(new URL("/portal", request.url));

    const { searchParams } = new URL(request.url);
    const usePlatform = searchParams.get("platform") === "1";

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const redirectUri = buildRedirectUri(origin);

    let appId: string;

    if (usePlatform) {
        appId = process.env.META_PLATFORM_APP_ID ?? "";
        if (!appId) {
            const url = new URL("/dashboard/settings", request.url);
            url.searchParams.set("meta_error", "Conexão direta via Facebook não configurada. Fale com o suporte.");
            return NextResponse.redirect(url);
        }
    } else {
        const creds = await loadMetaCredentials(sess.orgId);
        if (!creds) return NextResponse.redirect(new URL("/onboarding", request.url));
        appId = creds.app_id;
    }

    const state = randomBytes(24).toString("base64url");
    const authorizeUrl = buildAuthorizeUrl({ appId, redirectUri, state });

    const res = NextResponse.redirect(authorizeUrl);
    res.cookies.set("meta_oauth_state", state, {
        httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600,
    });
    res.cookies.set("meta_oauth_org", sess.orgId, {
        httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600,
    });
    res.cookies.set("meta_oauth_platform", usePlatform ? "1" : "0", {
        httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600,
    });
    return res;
}
