import { NextRequest, NextResponse } from 'next/server';
import {
    getAllAdAccounts, getAccountInsights, getCampaignsInsights, getAdsInsights, getDailyInsights,
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

/**
 * Gera um CSV ou JSON consolidado, pronto para mandar pra IA analisar.
 * Aceita:
 *   ?period=last_7d (ou since/until)
 *   ?accounts=id1,id2 (filtro — vazio = todas)
 *   ?level=accounts|campaigns|ads (default accounts)
 *   ?format=csv|json (default csv)
 */
export async function GET(request: NextRequest) {
    try {
        const accessToken = await getMetaAccessToken();

        const { searchParams } = new URL(request.url);
        const preset = (searchParams.get('period') || 'last_7d') as MetaDatePreset;
        const since = searchParams.get('since');
        const until = searchParams.get('until');
        const filterAccounts = (searchParams.get('accounts') || '').split(',').filter(Boolean);
        const level = (searchParams.get('level') || 'accounts') as 'accounts' | 'campaigns' | 'ads';
        const format = (searchParams.get('format') || 'csv') as 'csv' | 'json';

        let range: MetaTimeRange;
        if (since && until) range = { since, until };
        else {
            if (!VALID_PRESETS.includes(preset))
                return NextResponse.json({ success: false, error: 'Período inválido' }, { status: 400 });
            range = presetToRange(preset);
        }
        const prev = previousRange(range);

        const allAccounts = await getAllAdAccounts(accessToken);
        const accounts = allAccounts.filter(a =>
            filterAccounts.length ? filterAccounts.includes(a.id) : (a.account_status === 1 || Number(a.amount_spent) > 0)
        );

        // accounts (consolidado)
        const accountRows: any[] = [];
        const campaignRows: any[] = [];
        const adRows: any[] = [];
        const dailyRows: any[] = [];

        for (const acc of accounts) {
            const [curr, previous] = await Promise.all([
                getAccountInsights(acc.id, accessToken, undefined, range),
                getAccountInsights(acc.id, accessToken, undefined, prev),
            ]);
            if (curr) {
                const flat = flattenInsight(curr, acc.currency);
                const flatPrev = previous ? flattenInsight(previous, acc.currency) : null;
                const h = healthScore(flat);
                accountRows.push({
                    ...flat,
                    account_id: acc.account_id,
                    account_name: acc.name,
                    business_name: acc.business_name || '',
                    currency: acc.currency,
                    period_since: range.since,
                    period_until: range.until,
                    health_score: h.score,
                    health_reasons: h.reasons.join(' · '),
                    delta_spend_pct: flatPrev ? deltaPct(flat.spend, flatPrev.spend) : null,
                    delta_leads_pct: flatPrev ? deltaPct(flat.leads, flatPrev.leads) : null,
                    delta_ctr_pct: flatPrev ? deltaPct(flat.ctr, flatPrev.ctr) : null,
                    delta_cpl_pct: flatPrev ? deltaPct(flat.cpl, flatPrev.cpl) : null,
                    delta_roas_pct: flatPrev ? deltaPct(flat.roas, flatPrev.roas) : null,
                });
            }

            if (level === 'campaigns' || level === 'ads') {
                const camps = await getCampaignsInsights(acc.id, accessToken, undefined, range);
                for (const c of camps) {
                    campaignRows.push({
                        account_id: acc.account_id,
                        account_name: acc.name,
                        period_since: range.since,
                        period_until: range.until,
                        ...flattenInsight(c, acc.currency),
                    });
                }
            }
            if (level === 'ads') {
                const camps = await getCampaignsInsights(acc.id, accessToken, undefined, range);
                for (const c of camps) {
                    if (!c.campaign_id) continue;
                    const ads = await getAdsInsights(c.campaign_id, accessToken, undefined, range);
                    for (const a of ads) {
                        adRows.push({
                            ...flattenInsight(a, acc.currency),
                            account_id: acc.account_id,
                            account_name: acc.name,
                            campaign_id: c.campaign_id,
                            campaign_name: c.campaign_name,
                            period_since: range.since,
                            period_until: range.until,
                        });
                    }
                }
            }

            const daily = await getDailyInsights(acc.id, accessToken, undefined, range);
            for (const d of daily) {
                dailyRows.push({
                    account_id: acc.account_id,
                    account_name: acc.name,
                    ...flattenInsight(d, acc.currency),
                });
            }
        }

        if (format === 'json') {
            const payload = {
                generated_at: new Date().toISOString(),
                period: { range, previous: prev },
                instructions_for_ai: [
                    'Você é um gestor sênior de tráfego pago Meta Ads.',
                    'Analise os dados a seguir e produza: (1) um diagnóstico geral por conta;',
                    '(2) campanhas e criativos com melhor e pior desempenho; (3) recomendações claras de otimização;',
                    '(4) sinais de saturação (frequência alta, CTR caindo, CPM subindo);',
                    '(5) priorização — o que pausar, escalar ou investigar agora.',
                    'Compare sempre com o período anterior (delta_*_pct) e considere health_score.',
                ].join(' '),
                summary: {
                    total_accounts: accountRows.length,
                    total_spend: accountRows.reduce((s, a) => s + a.spend, 0),
                    total_leads: accountRows.reduce((s, a) => s + a.leads, 0),
                    total_purchases: accountRows.reduce((s, a) => s + a.purchases, 0),
                    total_purchase_value: accountRows.reduce((s, a) => s + a.purchase_value, 0),
                },
                accounts: accountRows,
                campaigns: campaignRows,
                ads: adRows,
                daily: dailyRows,
            };
            return new NextResponse(JSON.stringify(payload, null, 2), {
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Disposition': `attachment; filename="meugestor_${range.since}_${range.until}.json"`,
                },
            });
        }

        // CSV
        const rowsToExport =
            level === 'campaigns' ? campaignRows :
            level === 'ads' ? adRows :
            accountRows;
        const csv = toCsv(rowsToExport);
        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="meugestor_${level}_${range.since}_${range.until}.csv"`,
            },
        });
    } catch (error: any) {
        const fbCode = error?.fb?.code;
        const transient = fbCode === 1 || fbCode === 2 || fbCode === 4 || fbCode === 17 || fbCode === 32 || fbCode === 613;
        const friendly = transient
            ? `Meta API instável/limite de chamadas atingido (${error.message}). Tente novamente em 1-2 minutos, ou exporte um nível menor (Contas em vez de Anúncios) ou período mais curto.`
            : (error?.message || 'Erro no export');
        return NextResponse.json(
            { success: false, error: friendly, fb_code: fbCode ?? null },
            { status: transient ? 503 : 500 }
        );
    }
}

function toCsv(rows: any[]): string {
    if (!rows.length) return '';
    const cols = Array.from(rows.reduce<Set<string>>((set, r) => {
        Object.keys(r).forEach(k => set.add(k));
        return set;
    }, new Set()));
    const escape = (v: any) => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') v = JSON.stringify(v);
        const s = String(v);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
        return s;
    };
    const head = cols.map(escape).join(',');
    const body = rows.map(r => cols.map(c => escape(r[c])).join(',')).join('\n');
    // BOM para Excel ler UTF-8 corretamente
    return '﻿' + head + '\n' + body;
}

