import { NextResponse } from "next/server";
import { getCurrentUserId, loadMetaCredentials, loadMetaToken } from "@/lib/meta/store";
import { pingToken } from "@/lib/meta/api";

export const dynamic = "force-dynamic";

export async function GET() {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const creds = await loadMetaCredentials(userId);
    const token = await loadMetaToken(userId);

    if (!creds) return NextResponse.json({ stage: "no_credentials" });
    if (!token) return NextResponse.json({ stage: "no_token", appId: creds.app_id });

    // ping rapido pra ver se ta vivo
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
}
