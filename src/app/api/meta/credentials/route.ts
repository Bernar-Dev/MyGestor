import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId, saveMetaCredentials, loadMetaCredentials } from "@/lib/meta/store";
import { buildRedirectUri } from "@/lib/meta/oauth";

export const dynamic = "force-dynamic";

const Body = z.object({
    appId: z.string().regex(/^\d{10,20}$/, "App ID deve ter 10-20 digitos"),
    appSecret: z.string().min(20, "App Secret invalido"),
    appName: z.string().optional(),
});

export async function POST(req: Request) {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    let parsed;
    try { parsed = Body.parse(await req.json()); }
    catch (e: any) { return NextResponse.json({ error: e.errors?.[0]?.message || "Dados invalidos" }, { status: 400 }); }

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const redirectUri = buildRedirectUri(origin);

    try {
        await saveMetaCredentials(userId, { ...parsed, redirectUri });
        return NextResponse.json({ ok: true, redirectUri });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function GET() {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    const creds = await loadMetaCredentials(userId);
    if (!creds) return NextResponse.json({ configured: false });
    // nunca retorna o secret — só info pública
    return NextResponse.json({
        configured: true,
        appId: creds.app_id,
        appName: creds.app_name,
        redirectUri: creds.redirect_uri,
    });
}
