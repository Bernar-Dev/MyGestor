import { NextResponse } from "next/server";
import { deleteMetaToken } from "@/lib/meta/store";
import { requireAgency, errorResponse } from "@/lib/org";

export const dynamic = "force-dynamic";

export async function POST() {
    try {
        const sess = await requireAgency();
        await deleteMetaToken(sess.orgId);
        return NextResponse.json({ ok: true });
    } catch (e) {
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}
