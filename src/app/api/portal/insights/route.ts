import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClient, clientCanAccessAdAccount, errorResponse } from "@/lib/org";
import { loadMetaToken } from "@/lib/meta/store";
import { getAccountInsights, getCampaigns, getActiveAds } from "@/lib/meta/insights";

export const dynamic = "force-dynamic";

const Query = z.object({
    ad_account_id: z.string().regex(/^act_\d+$/),
    date_preset:   z.enum(["today", "yesterday", "last_7d", "last_30d", "this_month", "last_month"]).default("last_30d"),
});

/**
 * GET /api/portal/insights?ad_account_id=act_xxx&date_preset=last_30d
 *
 * Retorna o que o cliente tem permissão de ver:
 *   - sempre: KPIs da conta (gasto, impressões, cliques, CTR, CPC, etc.)
 *   - se view_campaigns: lista de campanhas
 *   - se view_creatives: anúncios ativos
 */
export async function GET(req: Request) {
    try {
        const sess = await requireClient();
        const u = new URL(req.url);
        const parsed = Query.parse({
            ad_account_id: u.searchParams.get("ad_account_id"),
            date_preset:   u.searchParams.get("date_preset") || undefined,
        });

        // Confere permissão (cliente só vê ad_accounts atribuídas)
        const perm = await clientCanAccessAdAccount(sess.clientId, parsed.ad_account_id);
        if (!perm.allowed) return NextResponse.json({ error: "Sem acesso a essa conta" }, { status: 403 });

        // Token Meta é da AGÊNCIA (do org_id do cliente)
        const token = await loadMetaToken(sess.orgId);
        if (!token) return NextResponse.json({ error: "Agência não conectou Meta ainda" }, { status: 412 });

        const insights = perm.permissions?.view_insights !== false
            ? await getAccountInsights({ accessToken: token.access_token, adAccountId: parsed.ad_account_id, datePreset: parsed.date_preset })
            : null;

        const campaigns = perm.permissions?.view_campaigns !== false
            ? await getCampaigns(token.access_token, parsed.ad_account_id)
            : [];

        const ads = perm.permissions?.view_creatives !== false
            ? await getActiveAds(token.access_token, parsed.ad_account_id, 50)
            : [];

        return NextResponse.json({
            insights,
            campaigns,
            ads,
            permissions: perm.permissions,
        });
    } catch (e: any) {
        if (e?.fb) return NextResponse.json({ error: e.message, fb_code: e.fb.code }, { status: 500 });
        const { status, body } = errorResponse(e);
        return NextResponse.json(body, { status });
    }
}
