import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAgency, errorResponse } from "@/lib/org";

export const dynamic = "force-dynamic";

/**
 * POST   /api/clients/[id]/accounts          → atribui uma ad_account ao cliente
 * DELETE /api/clients/[id]/accounts?id=xxx   → remove atribuição
 * PATCH  /api/clients/[id]/accounts          → muda permissions de uma atribuição
 */

type Ctx = { params: Promise<{ id: string }> };

const Permissions = z.object({
    view_campaigns: z.boolean().optional(),
    view_insights:  z.boolean().optional(),
    view_creatives: z.boolean().optional(),
    view_budget:    z.boolean().optional(),
    view_audiences: z.boolean().optional(),
}).default({
    view_campaigns: true, view_insights: true, view_creatives: true, view_budget: false, view_audiences: false,
});

const AssignBody = z.object({
    ad_account_id:   z.string().regex(/^act_\d+$/, "ad_account_id deve começar com 'act_'"),
    ad_account_name: z.string().optional(),
    currency:        z.string().max(8).optional(),
    permissions:     Permissions.optional(),
});

async function getClientOrgOrThrow(clientId: string, orgId: string) {
    const svc = createServiceClient();
    const { data } = await svc.from("clients").select("id").eq("id", clientId).eq("org_id", orgId).maybeSingle();
    if (!data) throw new Error("Cliente não pertence a esta organização");
}

export async function POST(req: Request, { params }: Ctx) {
    try {
        const { id } = await params;
        const sess = await requireAgency();
        await getClientOrgOrThrow(id, sess.orgId);

        let parsed;
        try { parsed = AssignBody.parse(await req.json()); }
        catch (e: any) { return NextResponse.json({ error: e.errors?.[0]?.message || "Dados invalidos" }, { status: 400 }); }

        const svc = createServiceClient();

        // Limite de ad_accounts por org
        const { data: org } = await svc.from("organizations").select("max_ad_accounts").eq("id", sess.orgId).single();
        const { count } = await svc.from("client_ad_accounts").select("id", { count: "exact", head: true }).eq("org_id", sess.orgId);
        if (org && typeof count === "number" && count >= org.max_ad_accounts) {
            return NextResponse.json({ error: `Limite do plano atingido (${org.max_ad_accounts} ad accounts). Faça upgrade.` }, { status: 402 });
        }

        const { error } = await svc.from("client_ad_accounts").upsert({
            client_id:       id,
            org_id:          sess.orgId,
            ad_account_id:   parsed.ad_account_id,
            ad_account_name: parsed.ad_account_name || null,
            currency:        parsed.currency || null,
            permissions:     parsed.permissions || undefined,
        }, { onConflict: "client_id,ad_account_id" });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ ok: true });
    } catch (e) {
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}

const PatchBody = z.object({
    ad_account_id: z.string(),
    permissions:   Permissions,
});

export async function PATCH(req: Request, { params }: Ctx) {
    try {
        const { id } = await params;
        const sess = await requireAgency();
        await getClientOrgOrThrow(id, sess.orgId);

        let parsed;
        try { parsed = PatchBody.parse(await req.json()); }
        catch (e: any) { return NextResponse.json({ error: e.errors?.[0]?.message || "Dados invalidos" }, { status: 400 }); }

        const svc = createServiceClient();
        const { error } = await svc.from("client_ad_accounts")
            .update({ permissions: parsed.permissions })
            .eq("client_id", id)
            .eq("ad_account_id", parsed.ad_account_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    } catch (e) {
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}

export async function DELETE(req: Request, { params }: Ctx) {
    try {
        const { id } = await params;
        const sess = await requireAgency();
        await getClientOrgOrThrow(id, sess.orgId);

        const adAccountId = new URL(req.url).searchParams.get("ad_account_id");
        if (!adAccountId) return NextResponse.json({ error: "ad_account_id obrigatório" }, { status: 400 });

        const svc = createServiceClient();
        const { error } = await svc.from("client_ad_accounts")
            .delete()
            .eq("client_id", id)
            .eq("ad_account_id", adAccountId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    } catch (e) {
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}
