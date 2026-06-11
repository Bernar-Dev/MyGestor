"use client";
import { Lightbulb, TrendingUp, AlertTriangle, DollarSign, Eye, BarChart3, Flame, Award } from "lucide-react";
import { formatCurrency, formatPct } from "../lib/format";

interface Account {
    id: string;
    name: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm: number;
    frequency: number;
    leads: number;
    cpl: number;
    purchases: number;
    purchase_value: number;
    roas: number;
    messaging_started: number;
    cpa_messaging: number;
    hook_rate: number;
    hold_rate: number;
    quality_ranking?: string;
    engagement_rate_ranking?: string;
    conversion_rate_ranking?: string;
    health: number;
    deltas?: any;
}

export interface InsightItem {
    type: "success" | "warning" | "danger" | "info";
    icon: any;
    title: string;
    description: string;
    account?: string;
    actionHint?: string;
}

export function generateInsights(accounts: Account[]): InsightItem[] {
    const items: InsightItem[] = [];

    for (const a of accounts) {
        if (a.spend === 0) continue;

        // Atenção
        if (a.frequency > 5) {
            items.push({
                type: "danger", icon: Flame, account: a.name,
                title: "Frequência crítica",
                description: `"${a.name}" — frequência ${a.frequency.toFixed(1)} (público saturado)`,
                actionHint: "Atualizar criativos ou expandir audiência",
            });
        } else if (a.frequency > 3.5) {
            items.push({
                type: "warning", icon: AlertTriangle, account: a.name,
                title: "Frequência alta",
                description: `Frequência ${a.frequency.toFixed(1)} em "${a.name}" — risco de saturação`,
                actionHint: "Considere variar copy/criativo",
            });
        }
        if (a.ctr < 0.5 && a.impressions > 1000) {
            items.push({
                type: "danger", icon: Eye, account: a.name,
                title: "CTR muito baixo",
                description: `"${a.name}" com CTR ${formatPct(a.ctr)}`,
                actionHint: "Trocar criativo principal ou refinar copy",
            });
        }
        if (a.spend > 50 && a.leads + a.purchases + a.messaging_started === 0) {
            items.push({
                type: "danger", icon: AlertTriangle, account: a.name,
                title: "Gasto sem conversão",
                description: `${formatCurrency(a.spend)} gastos sem registrar conversão em "${a.name}"`,
                actionHint: "Verificar pixel/Conversions API e relevância da oferta",
            });
        }
        if (a.cpc > 5) {
            items.push({
                type: "warning", icon: DollarSign, account: a.name,
                title: "CPC elevado",
                description: `"${a.name}" — CPC ${formatCurrency(a.cpc)}`,
                actionHint: "Refinar segmentação ou ampliar otimização",
            });
        }

        // Quality Meta
        const qBad = (a.quality_ranking?.startsWith("BELOW") || a.engagement_rate_ranking?.startsWith("BELOW") || a.conversion_rate_ranking?.startsWith("BELOW"));
        if (qBad) {
            items.push({
                type: "warning", icon: Award, account: a.name,
                title: "Ranking abaixo da média",
                description: `Q:${a.quality_ranking || '?'} · E:${a.engagement_rate_ranking || '?'} · C:${a.conversion_rate_ranking || '?'}`,
                actionHint: "Trocar criativo de pior performance",
            });
        }

        // Bom desempenho
        if (a.roas >= 2.5 && a.purchases > 0) {
            items.push({
                type: "success", icon: TrendingUp, account: a.name,
                title: "ROAS saudável",
                description: `"${a.name}" — ROAS ${a.roas.toFixed(2)}x · receita ${formatCurrency(a.purchase_value)}`,
                actionHint: "Considere escalar orçamento gradualmente (+20%)",
            });
        }
        if (a.leads >= 20) {
            items.push({
                type: "success", icon: TrendingUp, account: a.name,
                title: "Bom volume de leads",
                description: `${a.leads} leads · CPL ${formatCurrency(a.cpl)}`,
            });
        }
        if (a.hook_rate >= 25 && a.impressions > 1000) {
            items.push({
                type: "success", icon: TrendingUp, account: a.name,
                title: "Hook rate excelente",
                description: `"${a.name}" — Hook ${formatPct(a.hook_rate)} (criativo segura atenção)`,
            });
        }

        // Comparativo período-vs-anterior
        if (a.deltas?.cpl && a.deltas.cpl < -15 && a.leads > 0) {
            items.push({
                type: "success", icon: TrendingUp, account: a.name,
                title: "CPL caindo",
                description: `CPL ${a.deltas.cpl.toFixed(1)}% mais barato vs período anterior em "${a.name}"`,
            });
        }
        if (a.deltas?.spend && a.deltas.spend > 30 && a.deltas?.leads && a.deltas.leads < 0) {
            items.push({
                type: "danger", icon: AlertTriangle, account: a.name,
                title: "Gasto subindo, leads caindo",
                description: `"${a.name}" gastou +${a.deltas.spend.toFixed(0)}% mas leads caíram ${a.deltas.leads.toFixed(0)}%`,
                actionHint: "Investigar saturação ou queda de qualidade",
            });
        }
    }

    // Geral
    const totalSpend = accounts.reduce((s, a) => s + a.spend, 0);
    const totalLeads = accounts.reduce((s, a) => s + a.leads, 0);
    const totalPurchases = accounts.reduce((s, a) => s + a.purchases, 0);
    const totalRevenue = accounts.reduce((s, a) => s + (a.purchase_value || 0), 0);
    if (totalSpend > 0) {
        items.push({
            type: "info", icon: BarChart3,
            title: "Resumo geral",
            description: `${formatCurrency(totalSpend)} investidos · ${totalLeads} leads · ${totalPurchases} compras · receita ${formatCurrency(totalRevenue)}`,
        });
    }

    const order: Record<string, number> = { danger: 0, warning: 1, success: 2, info: 3 };
    items.sort((a, b) => (order[a.type] ?? 4) - (order[b.type] ?? 4));
    return items;
}

export default function SmartInsights({ accounts }: { accounts: Account[] }) {
    const items = generateInsights(accounts);
    if (items.length === 0) {
        return <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.85rem", textAlign: "center", padding: "2rem" }}>Sem insights — precisamos de mais dados.</p>;
    }
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {items.map((it, i) => {
                const Icon = it.icon;
                const colorMap: Record<string, { bg: string; ic: string }> = {
                    success: { bg: "rgba(16,185,129,0.08)", ic: "#34d399" },
                    danger: { bg: "rgba(239,68,68,0.08)", ic: "#f87171" },
                    warning: { bg: "rgba(245,158,11,0.08)", ic: "#fbbf24" },
                    info: { bg: "rgba(59,130,246,0.08)", ic: "#60a5fa" },
                };
                const c = colorMap[it.type];
                return (
                    <div key={i} style={{ display: "flex", gap: "0.85rem", padding: "0.85rem 1rem", borderRadius: "0.75rem", background: c.bg, border: `1px solid ${c.ic}33` }}>
                        <div style={{ padding: "0.55rem", borderRadius: "0.65rem", background: `${c.ic}22`, height: "fit-content" }}>
                            <Icon style={{ width: 18, height: 18, color: c.ic }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: 2, flexWrap: "wrap" }}>
                                <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "white" }}>{it.title}</p>
                                {it.account && <span className={`g-badge g-badge-${it.type === "success" ? "success" : it.type === "danger" ? "danger" : it.type === "warning" ? "warning" : "info"}`} style={{ fontSize: "0.6rem" }}>{it.account}</span>}
                            </div>
                            <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.65)" }}>{it.description}</p>
                            {it.actionHint && (
                                <p style={{ fontSize: "0.72rem", color: c.ic, marginTop: 4, fontWeight: 500 }}>
                                    <Lightbulb style={{ width: 11, height: 11, display: "inline", marginRight: 4 }} />{it.actionHint}
                                </p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

