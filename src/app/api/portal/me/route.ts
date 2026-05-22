import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireClient, errorResponse } from "@/lib/org";

export const dynamic = "force-dynamic";

/**
 * GET /api/portal/me  → dados do cliente + agência + ad_accounts liberadas
 *
 * Resposta usada pelo portal pra montar header e listar contas.
 */
export async function GET() {
    try {
        const sess = await requireClient();
        const svc = createServiceClient();

        const { data: client } = await svc.from("clients")
            .select("id, name, company, status, contact_email")
            .eq("id", sess.clientId).single();

        const { data: org } = await svc.from("organizations")
            .select("name, logo_url, primary_color")
            .eq("id", sess.orgId).single();

        const { data: accounts } = await svc.from("client_ad_accounts")
            .select("ad_account_id, ad_account_name, currency, permissions")
            .eq("client_id", sess.clientId);

        return NextResponse.json({
            client,
            agency: org,
            accounts: accounts || [],
        });
    } catch (e) {
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}
