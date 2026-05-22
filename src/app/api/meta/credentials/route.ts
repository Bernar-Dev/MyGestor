import { NextResponse } from "next/server";
import { z } from "zod";
import { saveMetaCredentials, loadMetaCredentials } from "@/lib/meta/store";
import { buildRedirectUri } from "@/lib/meta/oauth";
import { requireAgency, errorResponse } from "@/lib/org";

export const dynamic = "force-dynamic";

const Body = z.object({
    appId: z.string().regex(/^\d{10,20}$/, "App ID deve ter 10-20 digitos"),
    appSecret: z.string().min(20, "App Secret invalido"),
    appName: z.string().optional(),
});

export async function POST(req: Request) {
    try {
        const sess = await requireAgency();
        let parsed;
        try { parsed = Body.parse(await req.json()); }
        catch (e: any) { return NextResponse.json({ error: e.errors?.[0]?.message || "Dados invalidos" }, { status: 400 }); }

        const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
        const redirectUri = buildRedirectUri(origin);

        await saveMetaCredentials(sess.orgId, { ...parsed, redirectUri });
        return NextResponse.json({ ok: true, redirectUri });
    } catch (e) {
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}

export async function GET() {
    try {
        const sess = await requireAgency();
        const creds = await loadMetaCredentials(sess.orgId);
        if (!creds) return NextResponse.json({ configured: false });
        return NextResponse.json({
            configured: true,
            appId: creds.app_id,
            appName: creds.app_name,
            redirectUri: creds.redirect_uri,
        });
    } catch (e) {
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}
