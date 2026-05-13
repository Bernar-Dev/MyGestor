import { NextResponse } from "next/server";
import { getCurrentUserId, deleteMetaToken } from "@/lib/meta/store";

export const dynamic = "force-dynamic";

export async function POST() {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    await deleteMetaToken(userId);
    return NextResponse.json({ ok: true });
}
