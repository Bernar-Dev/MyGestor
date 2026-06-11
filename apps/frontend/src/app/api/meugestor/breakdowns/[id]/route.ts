import { NextRequest, NextResponse } from 'next/server';
import {
    getBreakdownInsights, flattenInsight,
    presetToRange, MetaDatePreset, MetaTimeRange, MetaBreakdown,
} from '@/lib/facebook';
import { getMetaAccessToken } from '@/lib/meta-token';

export const dynamic = 'force-dynamic';

const ALLOWED: MetaBreakdown[] = [
    'age', 'gender', 'age,gender',
    'country', 'region',
    'device_platform', 'publisher_platform', 'platform_position', 'impression_device',
    'hourly_stats_aggregated_by_advertiser_time_zone',
];

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const accessToken = await getMetaAccessToken();

        const { searchParams } = new URL(request.url);
        const dim = (searchParams.get('dim') || 'age,gender') as MetaBreakdown;
        if (!ALLOWED.includes(dim)) {
            return NextResponse.json({ success: false, error: 'Breakdown inválido' }, { status: 400 });
        }
        const preset = (searchParams.get('period') || 'last_7d') as MetaDatePreset;
        const since = searchParams.get('since');
        const until = searchParams.get('until');

        let range: MetaTimeRange;
        if (since && until) range = { since, until };
        else range = presetToRange(preset);

        // Aceita qualquer level: act_xxx (account), campaign_id, adset_id ou ad_id.
        // Frontend envia o id correto; sem forçar prefixo aqui.
        const objectId = id;
        const raw = await getBreakdownInsights(objectId, accessToken, dim, undefined, range);

        const rows = raw.map(r => {
            const flat = flattenInsight(r);
            // mantém os campos originais do breakdown (Meta retorna como propriedades extras)
            const extra: any = {};
            for (const k of ['age', 'gender', 'country', 'region', 'device_platform',
                'publisher_platform', 'platform_position', 'impression_device',
                'hourly_stats_aggregated_by_advertiser_time_zone']) {
                if ((r as any)[k] !== undefined) extra[k] = (r as any)[k];
            }
            return { ...extra, ...flat };
        });

        return NextResponse.json({ success: true, data: rows, dim, period: { preset, range } });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message || 'Erro ao buscar breakdowns' },
            { status: 500 }
        );
    }
}

