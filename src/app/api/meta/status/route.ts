import { NextResponse } from "next/server";
import { loadMetaCredentials, loadMetaToken } from "@/lib/meta/store";
import { pingToken } from "@/lib/meta/api";
import { requireAgency, errorResponse } from "@/lib/org";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const sess = await requireAgency();
        const creds = await loadMetaCredentials(sess.orgId);
        const token = await loadMetaToken(sess.orgId);

        if (!creds) return NextResponse.json({ stage: "no_credentials" });
        if (!token) return NextResponse.json({ stage: "no_token", appId: creds.app_id });

        const ping = await pingToken(token.access_token);

        return NextResponse.json({
            stage: ping.ok ? "connected" : "token_invalid",
            appId: creds.app_id,
            appName: creds.app_name,
            fbUserName: token.fb_user_name,
            fbUserId: token.fb_user_id,
            expiresAt: token.expires_at,
            refreshedAt: token.refreshed_at,
            scopes: token.scopes,
            error: ping.ok ? null : ping.error,
        });
    } catch (e) {
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}
