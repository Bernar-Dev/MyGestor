import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAgency, errorResponse } from "@/lib/org";

export const dynamic = "force-dynamic";

/**
 * GET    /api/clients/[id]  → detalhe + ad_accounts atribuídas
 * PATCH  /api/clients/[id]  → atualiza dados, status, portal_enabled
 * DELETE /api/clients/[id]  → remove
 */

type Ctx = { params: Promise<{ id: string }> };

async function ensureClientOfOrg(clientId: string, orgId: string) {
    const svc = createServiceClient();
    const { data } = await svc.from("clients").select("id").eq("id", clientId).eq("org_id", orgId).maybeSingle();
    return !!data;
}

export async function GET(_req: Request, { params }: Ctx) {
    try {
        const { id } = await params;
        const sess = await requireAgency();
        if (!(await ensureClientOfOrg(id, sess.orgId))) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

        const svc = createServiceClient();
        const { data: client } = await svc.from("clients")
            .select("id, name, contact_email, contact_phone, company, status, portal_enabled, auth_user_id, notes, created_at")
            .eq("id", id).single();

        const { data: accounts } = await svc.from("client_ad_accounts")
            .select("id, ad_account_id, ad_account_name, currency, permissions, created_at")
            .eq("client_id", id);

        return NextResponse.json({ client, accounts: accounts || [] });
    } catch (e) {
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}

const PatchBody = z.object({
    name:           z.string().min(2).max(120).optional(),
    contact_email:  z.string().email().nullable().optional(),
    contact_phone:  z.string().max(40).nullable().optional(),
    company:        z.string().max(120).nullable().optional(),
    notes:          z.string().max(2000).nullable().optional(),
    status:         z.enum(["active", "paused", "archived"]).optional(),
    portal_enabled: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
    try {
        const { id } = await params;
        const sess = await requireAgency();
        if (!(await ensureClientOfOrg(id, sess.orgId))) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

        let parsed;
        try { parsed = PatchBody.parse(await req.json()); }
        catch (e: any) { return NextResponse.json({ error: e.errors?.[0]?.message || "Dados invalidos" }, { status: 400 }); }

        const svc = createServiceClient();
        const { error } = await svc.from("clients")
            .update({ ...parsed, updated_at: new Date().toISOString() })
            .eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    } catch (e) {
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}

export async function DELETE(_req: Request, { params }: Ctx) {
    try {
        const { id } = await params;
        const sess = await requireAgency();
        if (!(await ensureClientOfOrg(id, sess.orgId))) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

        const svc = createServiceClient();
        const { error } = await svc.from("clients").delete().eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    } catch (e) {
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}
