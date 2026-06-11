import { NextRequest, NextResponse } from 'next/server';
import {
    getAllAdAccounts, getAccountInsights,
    flattenInsight, healthScore,
    presetToRange, previousRange, deltaPct,
    ACCOUNT_STATUS_LABEL, DISABLE_REASON_LABEL, accountStatusSeverity,
    MetaDatePreset, MetaTimeRange,
} from '@/lib/facebook';
import { getMetaAccessToken } from '@/lib/meta-token';

export const dynamic = 'force-dynamic';

const VALID_PRESETS: MetaDatePreset[] = [
    'today', 'yesterday',
    'last_3d', 'last_7d', 'last_14d', 'last_28d', 'last_30d', 'last_90d',
    'this_month', 'last_month', 'this_quarter', 'last_quarter', 'this_year', 'last_year',
];

export async function GET(request: NextRequest) {
    try {
        const accessToken = await getMetaAccessToken();

        const { searchParams } = new URL(request.url);
        const preset = (searchParams.get('period') || 'last_7d') as MetaDatePreset;
        const since = searchParams.get('since');
        const until = searchParams.get('until');
        const compare = searchParams.get('compare') !== 'false'; // default true

        // Range absoluto (custom > preset)
        let range: MetaTimeRange;
        if (since && until) {
            range = { since, until };
        } else {
            if (!VALID_PRESETS.includes(preset)) {
                return NextResponse.json({ success: false, error: 'Período inválido' }, { status: 400 });
            }
            range = presetToRange(preset);
        }
        const prev = compare ? previousRange(range) : null;

        const allAccounts = await getAllAdAccounts(accessToken);

        // Sem filtro: queremos ver TUDO — ativas, pendentes, encerradas, sem anúncios.
        // Só buscamos insights de contas que potencialmente têm anúncios (qualquer status
        // exceto 101=encerrada permanentemente OU lifetime spend > 0).
        const batchSize = 25;
        const enriched: any[] = [];

        for (let i = 0; i < allAccounts.length; i += batchSize) {
            const batch = allAccounts.slice(i, i + batchSize);
            const results = await Promise.allSettled(
                batch.map(async account => {
                    const lifetimeSpend = Number(account.amount_spent || 0);
                    const skipInsights = account.account_status === 101 && lifetimeSpend === 0;

                    const [curr, previous] = skipInsights
                        ? [null, null]
                        : await Promise.all([
                            getAccountInsights(account.id, accessToken, undefined, range).catch(() => null),
                            prev ? getAccountInsights(account.id, accessToken, undefined, prev).catch(() => null) : Promise.resolve(null),
                        ]);

                    const flat = flattenInsight(curr || {}, account.currency);
                    const flatPrev = previous ? flattenInsight(previous, account.currency) : null;
                    const health = curr ? healthScore(flat) : { score: 0, reasons: [] };

                    const deltas = flatPrev ? {
                        spend: deltaPct(flat.spend, flatPrev.spend),
                        impressions: deltaPct(flat.impressions, flatPrev.impressions),
                        clicks: deltaPct(flat.clicks, flatPrev.clicks),
                        ctr: deltaPct(flat.ctr, flatPrev.ctr),
                        cpc: deltaPct(flat.cpc, flatPrev.cpc),
                        cpm: deltaPct(flat.cpm, flatPrev.cpm),
                        leads: deltaPct(flat.leads, flatPrev.leads),
                        cpl: deltaPct(flat.cpl, flatPrev.cpl),
                        purchases: deltaPct(flat.purchases, flatPrev.purchases),
                        roas: deltaPct(flat.roas, flatPrev.roas),
                        messaging_started: deltaPct(flat.messaging_started, flatPrev.messaging_started),
                    } : null;

                    const lifetimeBRL = lifetimeSpend / 100;
                    const hasAdsInPeriod = !!curr && flat.spend > 0;
                    const hasAnyAds = lifetimeBRL > 0 || hasAdsInPeriod;

                    const issues: string[] = [];
                    const issue_categories: string[] = [];
                    if (account.account_status !== 1) {
                        issues.push(ACCOUNT_STATUS_LABEL[account.account_status] || `Status ${account.account_status}`);
                        issue_categories.push('inactive');
                    }
                    if (account.disable_reason && account.disable_reason > 0) {
                        const r = DISABLE_REASON_LABEL[account.disable_reason];
                        if (r) issues.push(r);
                        if (!issue_categories.includes('inactive')) issue_categories.push('inactive');
                    }
                    if (!hasAnyAds) {
                        issues.push('Sem anúncios veiculados');
                        issue_categories.push('no_ads');
                    } else if (!hasAdsInPeriod && account.account_status === 1) {
                        issues.push('Sem veiculação no período');
                        issue_categories.push('no_delivery');
                    }
                    if (account.is_prepay_account && Number(account.balance || 0) === 0 && hasAnyAds) {
                        issues.push('Saldo pré-pago zerado');
                        if (!issue_categories.includes('payment')) issue_categories.push('payment');
                    }
                    if (!account.funding_source_details?.id && hasAnyAds) {
                        issues.push('Sem fonte de pagamento');
                        if (!issue_categories.includes('payment')) issue_categories.push('payment');
                    }

                    return {
                        ...flat,
                        id: account.id,
                        account_id: account.account_id,
                        name: account.name,
                        business_name: account.business_name,
                        currency: account.currency,
                        timezone: account.timezone_name,
                        account_status: account.account_status,
                        account_status_label: ACCOUNT_STATUS_LABEL[account.account_status] || `Status ${account.account_status}`,
                        disable_reason: account.disable_reason || 0,
                        disable_reason_label: DISABLE_REASON_LABEL[account.disable_reason || 0] || '',
                        severity: accountStatusSeverity(account.account_status, account.disable_reason),
                        total_spent_lifetime: lifetimeBRL,
                        balance: Number(account.balance || 0) / 100,
                        spend_cap: Number(account.spend_cap || 0) / 100,
                        is_prepay_account: !!account.is_prepay_account,
                        created_time: account.created_time || null,
                        funding_source: account.funding_source_details?.display_string || null,
                        has_any_ads: hasAnyAds,
                        has_ads_in_period: hasAdsInPeriod,
                        issues,
                        issue_categories,
                        previous: flatPrev,
                        deltas,
                        health: health.score,
                        health_reasons: health.reasons,
                    };
                })
            );

            for (const r of results) {
                if (r.status === 'fulfilled' && r.value) enriched.push(r.value);
            }
        }

        // ordena: contas com gasto no período primeiro, depois por nome.
        enriched.sort((a, b) => {
            if (b.spend !== a.spend) return b.spend - a.spend;
            return (a.name || '').localeCompare(b.name || '');
        });

        return NextResponse.json({
            success: true,
            data: enriched,
            period: { preset, range, previous: prev },
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message || 'Erro ao buscar contas' },
            { status: 500 }
        );
    }
}

