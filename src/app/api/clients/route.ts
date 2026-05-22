import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAgency, errorResponse } from "@/lib/org";

export const dynamic = "force-dynamic";

/**
 * GET  /api/clients          → lista os clientes da org
 * POST /api/clients          → cria cliente (respeita limite do plano)
 */

export async function GET() {
    try {
        const sess = await requireAgency();
        const svc = createServiceClient();
        const { data, error } = await svc
            .from("clients")
            .select("id, name, contact_email, contact_phone, company, status, portal_enabled, auth_user_id, created_at")
            .eq("org_id", sess.orgId)
            .order("created_at", { ascending: false });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // conta ad_accounts por cliente
        const ids = (data || []).map(c => c.id);
        const counts: Record<string, number> = {};
        if (ids.length) {
            const { data: caa } = await svc
                .from("client_ad_accounts")
                .select("client_id")
                .in("client_id", ids);
            (caa || []).forEach(r => { counts[r.client_id] = (counts[r.client_id] || 0) + 1; });
        }

        return NextResponse.json({
            clients: (data || []).map(c => ({ ...c, ad_accounts_count: counts[c.id] || 0 })),
        });
    } catch (e) {
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}

const CreateBody = z.object({
    name:          z.string().min(2).max(120),
    contact_email: z.string().email().optional().or(z.literal("")),
    contact_phone: z.string().max(40).optional().or(z.literal("")),
    company:       z.string().max(120).optional().or(z.literal("")),
    notes:         z.string().max(2000).optional().or(z.literal("")),
});

export async function POST(req: Request) {
    try {
        const sess = await requireAgency();
        let parsed;
        try { parsed = CreateBody.parse(await req.json()); }
        catch (e: any) { return NextResponse.json({ error: e.errors?.[0]?.message || "Dados invalidos" }, { status: 400 }); }

        const svc = createServiceClient();

        // Checa limite de plano
        const { data: org } = await svc.from("organizations").select("max_clients").eq("id", sess.orgId).single();
        const { count } = await svc.from("clients").select("id", { count: "exact", head: true }).eq("org_id", sess.orgId);
        if (org && typeof count === "number" && count >= org.max_clients) {
            return NextResponse.json({
                error: `Limite do plano atingido (${org.max_clients} clientes). Faça upgrade.`,
            }, { status: 402 });
        }

        const { data, error } = await svc.from("clients").insert({
            org_id: sess.orgId,
            name: parsed.name,
            contact_email: parsed.contact_email || null,
            contact_phone: parsed.contact_phone || null,
            company:       parsed.company       || null,
            notes:         parsed.notes         || null,
        }).select("id").single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ ok: true, id: data.id });
    } catch (e) {
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}
