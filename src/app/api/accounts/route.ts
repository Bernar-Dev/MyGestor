import { NextResponse } from "next/server";
import { getCurrentUserId, loadMetaToken } from "@/lib/meta/store";
import { getAllAdAccounts } from "@/lib/meta/api";

export const dynamic = "force-dynamic";

export async function GET() {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const token = await loadMetaToken(userId);
    if (!token) return NextResponse.json({ error: "Meta não conectado" }, { status: 412 });

    try {
        const accounts = await getAllAdAccounts(token.access_token);
        return NextResponse.json({ success: true, count: accounts.length, accounts });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message, fb_code: e?.fb?.code }, { status: 500 });
    }
}
