import { NextResponse } from "next/server";
import { createServiceClient, createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET  /api/invite/[token]   → info pública do convite (nome do cliente, agência)
 * POST /api/invite/[token]   → aceita o convite (precisa estar logado)
 *
 * Fluxo de aceite (POST):
 *   1. user precisa estar logado (signup/login antes via /invite/<token>)
 *   2. validamos token, expiração, e que o user.email bate com invitation.email
 *      (pra evitar que outro user roube o convite)
 *   3. associamos clients.auth_user_id = user.id + portal_enabled=true
 *   4. update profile.role='client', profile.client_id
 *   5. marcamos invitation.accepted_at = now()
 */

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Ctx) {
    const { token } = await params;
    const svc = createServiceClient();
    const { data } = await svc
        .from("client_invitations")
        .select("id, email, expires_at, accepted_at, client_id, org_id")
        .eq("token", token).maybeSingle();
    if (!data) return NextResponse.json({ error: "Convite inválido" }, { status: 404 });
    if (data.accepted_at) return NextResponse.json({ error: "Convite já aceito" }, { status: 410 });
    if (new Date(data.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "Convite expirado" }, { status: 410 });

    const { data: client } = await svc.from("clients").select("name").eq("id", data.client_id).single();
    const { data: org } = await svc.from("organizations").select("name, logo_url, primary_color").eq("id", data.org_id).single();

    return NextResponse.json({
        email: data.email,
        client_name: client?.name,
        org_name: org?.name,
        org_logo_url: org?.logo_url,
        org_primary_color: org?.primary_color,
    });
}

export async function POST(_req: Request, { params }: Ctx) {
    const { token } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const svc = createServiceClient();
    const { data: invite } = await svc
        .from("client_invitations")
        .select("id, email, expires_at, accepted_at, client_id, org_id")
        .eq("token", token).maybeSingle();
    if (!invite) return NextResponse.json({ error: "Convite inválido" }, { status: 404 });
    if (invite.accepted_at) return NextResponse.json({ error: "Convite já aceito" }, { status: 410 });
    if (new Date(invite.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "Convite expirado" }, { status: 410 });

    if (invite.email.toLowerCase() !== (user.email || "").toLowerCase()) {
        return NextResponse.json({
            error: `Este convite é para ${invite.email}. Faça login com esse email.`,
        }, { status: 403 });
    }

    // 1) clients ← auth_user_id + portal_enabled
    const { error: cErr } = await svc.from("clients")
        .update({ auth_user_id: user.id, portal_enabled: true, updated_at: new Date().toISOString() })
        .eq("id", invite.client_id);
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

    // 2) profile ← role='client' + client_id (current_org_id null porque cliente não tem org)
    const { error: pErr } = await svc.from("profiles")
        .update({ role: "client", client_id: invite.client_id, current_org_id: null })
        .eq("id", user.id);
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    // 3) marca convite
    await svc.from("client_invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invite.id);

    return NextResponse.json({ ok: true, redirect: "/portal" });
}
