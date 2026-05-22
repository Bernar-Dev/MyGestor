import { NextResponse } from "next/server";
import { loadMetaToken } from "@/lib/meta/store";
import { getAllAdAccounts } from "@/lib/meta/api";
import { requireAgency, errorResponse } from "@/lib/org";

export const dynamic = "force-dynamic";

/**
 * Lista TODAS as ad accounts visíveis pelo token Meta da agência.
 * É a "lista mestra" usada na UI de gestão de clientes (assign accounts).
 */
export async function GET() {
    try {
        const sess = await requireAgency();
        const token = await loadMetaToken(sess.orgId);
        if (!token) return NextResponse.json({ error: "Meta não conectado" }, { status: 412 });

        const accounts = await getAllAdAccounts(token.access_token);
        return NextResponse.json({ success: true, count: accounts.length, accounts });
    } catch (e: any) {
        if (e?.fb) return NextResponse.json({ success: false, error: e.message, fb_code: e.fb.code }, { status: 500 });
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}
