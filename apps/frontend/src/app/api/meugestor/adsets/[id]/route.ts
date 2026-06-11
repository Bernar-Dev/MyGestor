import { NextRequest, NextResponse } from 'next/server';
import {
    getAdsInsights, getDailyInsights,
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

        const [adsRaw, adsPrev, dailyRaw] = await Promise.all([
            getAdsInsights(id, accessToken, undefined, range),
            prev ? getAdsInsights(id, accessToken, undefined, prev) : Promise.resolve([]),
            getDailyInsights(id, accessToken, undefined, range),
        ]);

        const prevByAd: Record<string, any> = {};
        for (const r of adsPrev || []) {
            if (r.ad_id) prevByAd[r.ad_id] = flattenInsight(r);
        }

        const ads = adsRaw.map(a => {
            const flat = flattenInsight(a);
            const flatPrev = prevByAd[a.ad_id || ''];
            const health = healthScore(flat);
            const deltas = flatPrev ? {
                spend: deltaPct(flat.spend, flatPrev.spend),
                ctr: deltaPct(flat.ctr, flatPrev.ctr),
                cpc: deltaPct(flat.cpc, flatPrev.cpc),
                leads: deltaPct(flat.leads, flatPrev.leads),
                cpl: deltaPct(flat.cpl, flatPrev.cpl),
                roas: deltaPct(flat.roas, flatPrev.roas),
                hook_rate: deltaPct(flat.hook_rate, flatPrev.hook_rate),
            } : null;
            return { ...flat, deltas, health: health.score, health_reasons: health.reasons };
        });
        ads.sort((a, b) => b.spend - a.spend);

        const daily = dailyRaw.map(d => flattenInsight(d));

        return NextResponse.json({
            success: true,
            data: { ads, daily },
            period: { preset, range, previous: prev },
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message || 'Erro ao buscar dados do adset' },
            { status: 500 }
        );
    }
}
