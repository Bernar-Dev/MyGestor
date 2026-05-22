import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAgency, errorResponse } from "@/lib/org";

export const dynamic = "force-dynamic";

/**
 * POST /api/clients/[id]/invite  → gera link de convite (token único)
 *
 * O link expira em 7 dias. Retorna URL pública (NEXT_PUBLIC_APP_URL/invite/<token>).
 * A agência copia esse link e manda pro cliente (WhatsApp/email).
 *
 * Quando o cliente clica e cria conta, em /invite/[token] a gente:
 *   - cria/identifica auth.users
 *   - associa profile.role='client' + client_id
 *   - associa clients.auth_user_id + portal_enabled=true
 *   - marca invitation.accepted_at
 */

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
    email: z.string().email("Email inválido"),
});

export async function POST(req: Request, { params }: Ctx) {
    try {
        const { id } = await params;
        const sess = await requireAgency();
        const svc = createServiceClient();

        // Confere ownership
        const { data: client } = await svc.from("clients").select("id, name, contact_email").eq("id", id).eq("org_id", sess.orgId).maybeSingle();
        if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

        let parsed;
        try { parsed = Body.parse(await req.json()); }
        catch (e: any) { return NextResponse.json({ error: e.errors?.[0]?.message || "Dados invalidos" }, { status: 400 }); }

        // Limpa convites pendentes antigos do mesmo cliente
        await svc.from("client_invitations")
            .delete()
            .eq("client_id", id)
            .is("accepted_at", null);

        const token = randomBytes(24).toString("base64url");
        const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();

        const { error } = await svc.from("client_invitations").insert({
            client_id:  id,
            org_id:     sess.orgId,
            token,
            email:      parsed.email,
            expires_at: expiresAt,
            created_by: sess.userId,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Atualiza contact_email do cliente se não tiver
        if (!client.contact_email) {
            await svc.from("clients").update({ contact_email: parsed.email }).eq("id", id);
        }

        const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
        const inviteUrl = `${origin}/invite/${token}`;
        return NextResponse.json({ ok: true, inviteUrl, expiresAt });
    } catch (e) {
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}
