import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAgency, createOrganization, getAuthUser, errorResponse } from "@/lib/org";

export const dynamic = "force-dynamic";

/**
 * GET  /api/org → dados da org ativa
 * POST /api/org → cria nova org (signup do gestor/agência)
 * PATCH /api/org → atualiza nome, logo, cor primária
 */

export async function GET() {
    try {
        const sess = await requireAgency();
        const svc = createServiceClient();
        const { data } = await svc.from("organizations")
            .select("id, name, slug, plan, logo_url, primary_color, max_clients, max_ad_accounts, created_at")
            .eq("id", sess.orgId).maybeSingle();
        return NextResponse.json({ org: data, role: sess.orgRole });
    } catch (e) {
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}

const CreateBody = z.object({
    name: z.string().min(2, "Nome muito curto").max(80),
});

export async function POST(req: Request) {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

        let parsed;
        try { parsed = CreateBody.parse(await req.json()); }
        catch (e: any) { return NextResponse.json({ error: e.errors?.[0]?.message || "Dados invalidos" }, { status: 400 }); }

        // Já tem org?
        const svc = createServiceClient();
        const { data: existing } = await svc
            .from("organization_members")
            .select("org_id")
            .eq("user_id", user.id).limit(1).maybeSingle();
        if (existing) return NextResponse.json({ error: "Você já pertence a uma organização" }, { status: 409 });

        const org = await createOrganization({ userId: user.id, name: parsed.name });
        return NextResponse.json({ ok: true, org });
    } catch (e) {
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}

const PatchBody = z.object({
    name: z.string().min(2).max(80).optional(),
    logo_url: z.string().url().nullable().optional(),
    primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function PATCH(req: Request) {
    try {
        const sess = await requireAgency();
        if (sess.orgRole !== "owner") return NextResponse.json({ error: "Apenas owners podem editar a org" }, { status: 403 });

        let parsed;
        try { parsed = PatchBody.parse(await req.json()); }
        catch (e: any) { return NextResponse.json({ error: e.errors?.[0]?.message || "Dados invalidos" }, { status: 400 }); }

        const svc = createServiceClient();
        const { error } = await svc.from("organizations")
            .update({ ...parsed, updated_at: new Date().toISOString() })
            .eq("id", sess.orgId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    } catch (e) {
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}
