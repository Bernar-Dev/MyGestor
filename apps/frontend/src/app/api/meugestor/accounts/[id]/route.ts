import { NextRequest, NextResponse } from 'next/server';
import {
    getCampaignsInsights, getDailyInsights, getAdsetsInsights,
    flattenInsight, healthScore,
    presetToRange, previousRange, deltaPct,
    MetaDatePreset, MetaTimeRange,
} from '@/lib/facebook';
import { getMetaAccessToken } from '@/lib/meta-token';

export const dynamic = 'force-dynamic';

const VALID_PRESETS: MetaDatePreset[] = [
    'today', 'yesterday',
    'last_3d', 'last_7d', 'last_14d', 'last_28d', 'last_30d', 'last_90d',
    'this_month', 'last_month', 'this_quarter', 'last_quarter', 'this_year', 'last_year',
];

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const accessToken = await getMetaAccessToken();

        const { searchParams } = new URL(request.url);
        const preset = (searchParams.get('period') || 'last_7d') as MetaDatePreset;
        const since = searchParams.get('since');
        const until = searchParams.get('until');
        const compare = searchParams.get('compare') !== 'false';

        let range: MetaTimeRange;
        if (since && until) range = { since, until };
        else {
            if (!VALID_PRESETS.includes(preset))
                return NextResponse.json({ success: false, error: 'Período inválido' }, { status: 400 });
            range = presetToRange(preset);
        }
        const prev = compare ? previousRange(range) : null;
        const accountId = id.startsWith('act_') ? id : `act_${id}`;

        const [campaignsRaw, campaignsPrev, dailyRaw, adsetsRaw] = await Promise.all([
            getCampaignsInsights(accountId, accessToken, undefined, range),
            prev ? getCampaignsInsights(accountId, accessToken, undefined, prev) : Promise.resolve([]),
            getDailyInsights(accountId, accessToken, undefined, range),
            getAdsetsInsights(accountId, accessToken, undefined, range).catch(() => []),
        ]);

        const prevByCampaign: Record<string, any> = {};
        for (const r of campaignsPrev || []) {
            if (r.campaign_id) prevByCampaign[r.campaign_id] = flattenInsight(r);
        }

        const campaigns = campaignsRaw.map(c => {
            const flat = flattenInsight(c);
            const flatPrev = prevByCampaign[c.campaign_id || ''];
            const health = healthScore(flat);
            const deltas = flatPrev ? {
                spend: deltaPct(flat.spend, flatPrev.spend),
                ctr: deltaPct(flat.ctr, flatPrev.ctr),
                cpc: deltaPct(flat.cpc, flatPrev.cpc),
                cpm: deltaPct(flat.cpm, flatPrev.cpm),
                leads: deltaPct(flat.leads, flatPrev.leads),
                cpl: deltaPct(flat.cpl, flatPrev.cpl),
                roas: deltaPct(flat.roas, flatPrev.roas),
                messaging_started: deltaPct(flat.messaging_started, flatPrev.messaging_started),
            } : null;
            return { ...flat, deltas, health: health.score, health_reasons: health.reasons };
        });
        campaigns.sort((a, b) => b.spend - a.spend);

        const adsets = adsetsRaw.map(a => flattenInsight(a))
            .sort((a, b) => b.spend - a.spend);

        const daily = dailyRaw.map(d => flattenInsight(d));

        return NextResponse.json({
            success: true,
            data: { campaigns, adsets, daily },
            period: { preset, range, previous: prev },
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message || 'Erro ao buscar detalhes' },
            { status: 500 }
        );
    }
}

