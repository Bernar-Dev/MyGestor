/**
 * Catálogo de KPI Cards (cards do topo do dashboard).
 * Cada KPI referencia uma chave do METRIC_CATALOG e adiciona ícone + cor.
 * Pode mostrar uma métrica secundária no rodapé do card (subMetric).
 */
import {
    DollarSign, Users, Target, MousePointerClick, Eye, Wallet, Activity,
    Gauge, Heart, Film, Award, ShoppingCart, Globe, Layers,
} from "lucide-react";
import { METRIC_BY_KEY } from "./metrics";

export type KpiCtx = "dashboard" | "account" | "campaign" | "adset" | "ad";

export type KpiColor = "blue" | "green" | "yellow" | "red" | "purple";

export interface KpiDef {
    id: string;
    metricKey: string;
    icon: any;
    color: KpiColor;
    subMetric?: string;
    contexts: KpiCtx[];
}

export const KPI_CATALOG: KpiDef[] = [
    // ── Investimento / Alcance
    { id: "spend", metricKey: "spend", icon: DollarSign, color: "blue", contexts: ["dashboard", "account", "campaign", "adset", "ad"] },
    { id: "reach", metricKey: "reach", icon: Globe, color: "blue", subMetric: "frequency", contexts: ["dashboard", "account", "campaign", "adset", "ad"] },
    { id: "impressions", metricKey: "impressions", icon: Eye, color: "blue", contexts: ["dashboard", "account", "campaign", "adset", "ad"] },
    { id: "frequency", metricKey: "frequency", icon: Gauge, color: "yellow", contexts: ["account", "campaign", "adset", "ad"] },

    // ── Engajamento
    { id: "clicks", metricKey: "clicks", icon: MousePointerClick, color: "yellow", subMetric: "cpc", contexts: ["dashboard", "account", "campaign", "adset", "ad"] },
    { id: "inline_link_clicks", metricKey: "inline_link_clicks", icon: MousePointerClick, color: "yellow", subMetric: "cost_per_inline_link_click", contexts: ["dashboard", "account", "campaign", "adset", "ad"] },
    { id: "ctr", metricKey: "ctr", icon: Target, color: "green", subMetric: "impressions", contexts: ["dashboard", "account", "campaign", "adset", "ad"] },
    { id: "inline_link_click_ctr", metricKey: "inline_link_click_ctr", icon: Target, color: "green", contexts: ["dashboard", "account", "campaign", "adset", "ad"] },
    { id: "post_engagement", metricKey: "post_engagement", icon: Activity, color: "purple", contexts: ["account", "campaign", "adset", "ad"] },
    { id: "post_save", metricKey: "post_save", icon: Activity, color: "purple", contexts: ["account", "campaign", "adset", "ad"] },

    // ── Custo
    { id: "cpc", metricKey: "cpc", icon: DollarSign, color: "yellow", contexts: ["dashboard", "account", "campaign", "adset", "ad"] },
    { id: "cost_per_inline_link_click", metricKey: "cost_per_inline_link_click", icon: DollarSign, color: "yellow", contexts: ["dashboard", "account", "campaign", "adset", "ad"] },
    { id: "cpm", metricKey: "cpm", icon: Eye, color: "yellow", contexts: ["dashboard", "account", "campaign", "adset", "ad"] },
    { id: "cpp", metricKey: "cpp", icon: Eye, color: "yellow", contexts: ["account", "campaign", "adset", "ad"] },

    // ── Conversão
    { id: "leads", metricKey: "leads", icon: Users, color: "green", subMetric: "cpl", contexts: ["dashboard", "account", "campaign", "adset", "ad"] },
    { id: "cpl", metricKey: "cpl", icon: DollarSign, color: "green", contexts: ["account", "campaign", "adset", "ad"] },
    { id: "purchases", metricKey: "purchases", icon: ShoppingCart, color: "green", subMetric: "cpa_purchase", contexts: ["dashboard", "account", "campaign", "adset", "ad"] },
    { id: "purchase_value", metricKey: "purchase_value", icon: Wallet, color: "green", contexts: ["dashboard", "account", "campaign", "adset", "ad"] },
    { id: "roas", metricKey: "roas", icon: Wallet, color: "blue", contexts: ["dashboard", "account", "campaign", "adset", "ad"] },
    { id: "conversion_rate", metricKey: "conversion_rate", icon: Target, color: "green", contexts: ["account", "campaign", "adset", "ad"] },
    { id: "messaging_started", metricKey: "messaging_started", icon: Activity, color: "purple", subMetric: "cpa_messaging", contexts: ["dashboard", "account", "campaign", "adset", "ad"] },
    { id: "cpa_messaging", metricKey: "cpa_messaging", icon: Activity, color: "purple", contexts: ["account", "campaign", "adset", "ad"] },
    { id: "add_to_cart", metricKey: "add_to_cart", icon: ShoppingCart, color: "green", contexts: ["account", "campaign", "adset", "ad"] },
    { id: "initiate_checkout", metricKey: "initiate_checkout", icon: ShoppingCart, color: "green", contexts: ["account", "campaign", "adset", "ad"] },
    { id: "landing_page_views", metricKey: "landing_page_views", icon: Layers, color: "green", subMetric: "cpa_landing", contexts: ["account", "campaign", "adset", "ad"] },
    { id: "complete_registration", metricKey: "complete_registration", icon: Users, color: "green", contexts: ["account", "campaign", "adset", "ad"] },
    { id: "contact", metricKey: "contact", icon: Users, color: "green", contexts: ["account", "campaign", "adset", "ad"] },

    // ── Vídeo
    { id: "video_3s", metricKey: "video_3s", icon: Film, color: "purple", subMetric: "hook_rate", contexts: ["account", "campaign", "adset", "ad"] },
    { id: "hook_rate", metricKey: "hook_rate", icon: Film, color: "purple", contexts: ["account", "campaign", "adset", "ad"] },
    { id: "hold_rate", metricKey: "hold_rate", icon: Film, color: "purple", contexts: ["account", "campaign", "adset", "ad"] },
    { id: "thruplay", metricKey: "thruplay", icon: Film, color: "purple", subMetric: "cost_per_thruplay", contexts: ["account", "campaign", "adset", "ad"] },
    { id: "video_avg_time", metricKey: "video_avg_time", icon: Film, color: "purple", contexts: ["account", "campaign", "adset", "ad"] },
    { id: "view_rate_50", metricKey: "view_rate_50", icon: Film, color: "purple", contexts: ["account", "campaign", "adset", "ad"] },
    { id: "view_rate_100", metricKey: "view_rate_100", icon: Film, color: "purple", contexts: ["account", "campaign", "adset", "ad"] },

    // ── Qualidade
    { id: "health", metricKey: "health", icon: Heart, color: "green", contexts: ["account", "campaign", "adset", "ad"] },
    { id: "quality_ranking", metricKey: "quality_ranking", icon: Award, color: "yellow", contexts: ["account", "campaign", "adset", "ad"] },
    { id: "engagement_rate_ranking", metricKey: "engagement_rate_ranking", icon: Award, color: "yellow", contexts: ["account", "campaign", "adset", "ad"] },
    { id: "conversion_rate_ranking", metricKey: "conversion_rate_ranking", icon: Award, color: "yellow", contexts: ["account", "campaign", "adset", "ad"] },
];


export const KPI_BY_ID: Record<string, KpiDef> = KPI_CATALOG.reduce((acc, k) => { acc[k.id] = k; return acc; }, {} as Record<string, KpiDef>);

export const DEFAULT_KPIS: Record<KpiCtx, string[]> = {
    dashboard: ["spend", "clicks", "ctr", "leads", "messaging_started", "roas"],
    account: ["spend", "inline_link_click_ctr", "cost_per_inline_link_click", "cpm", "leads", "messaging_started", "roas", "health"],
    campaign: ["spend", "ctr", "cost_per_inline_link_click", "cpm", "leads", "messaging_started", "frequency", "health"],
    adset: ["spend", "ctr", "cpc", "cpm", "leads", "messaging_started", "frequency", "health"],
    ad: ["spend", "ctr", "cpc", "hook_rate", "hold_rate", "frequency", "leads", "health"],
};


/**
 * Constrói um "row sintético" agregando várias contas — útil pra usar o KpiGrid no dashboard.
 * Métricas derivadas (CTR, CPC, CPL, ROAS) são recalculadas a partir das somas, não médias.
 */
export function aggregateRow(rows: any[]): any {
    if (!rows.length) return null;
    const sum = (k: string) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const sumPrev = (k: string) => rows.reduce((s, r) => s + (Number(r.previous?.[k]) || 0), 0);

    const spend = sum("spend");
    const impressions = sum("impressions");
    const clicks = sum("clicks");
    const inline_link_clicks = sum("inline_link_clicks");
    const reach = sum("reach");
    const leads = sum("leads");
    const purchases = sum("purchases");
    const purchase_value = sum("purchase_value");
    const messaging_started = sum("messaging_started");
    const messaging_replied = sum("messaging_replied");
    const add_to_cart = sum("add_to_cart");
    const initiate_checkout = sum("initiate_checkout");
    const landing_page_views = sum("landing_page_views");
    const complete_registration = sum("complete_registration");
    const contact = sum("contact");
    const video_3s = sum("video_3s");
    const video_p100 = sum("video_p100");
    const thruplay = sum("thruplay");
    const post_engagement = sum("post_engagement");
    const post_save = sum("post_save");

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const inline_link_click_ctr = impressions > 0 ? (inline_link_clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cost_per_inline_link_click = inline_link_clicks > 0 ? spend / inline_link_clicks : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const cpp = reach > 0 ? (spend / reach) * 1000 : 0;
    const cpl = leads > 0 ? spend / leads : 0;
    const cpa_purchase = purchases > 0 ? spend / purchases : 0;
    const cpa_messaging = messaging_started > 0 ? spend / messaging_started : 0;
    const cpa_landing = landing_page_views > 0 ? spend / landing_page_views : 0;
    const roas = spend > 0 ? purchase_value / spend : 0;
    const conversion_rate = clicks > 0 ? (purchases / clicks) * 100 : 0;
    const hook_rate = impressions > 0 ? (video_3s / impressions) * 100 : 0;
    const hold_rate = video_3s > 0 ? (video_p100 / video_3s) * 100 : 0;

    // delta agregado vs periodo anterior (para os campos prev.*)
    const prevSpend = sumPrev("spend"), prevLeads = sumPrev("leads"), prevClicks = sumPrev("clicks"),
          prevImpr = sumPrev("impressions"), prevPurch = sumPrev("purchases"), prevValue = sumPrev("purchase_value"),
          prevMsg = sumPrev("messaging_started"), prevLink = sumPrev("inline_link_clicks");
    const dPct = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : null;
    const deltas: any = {
        spend: dPct(spend, prevSpend),
        impressions: dPct(impressions, prevImpr),
        clicks: dPct(clicks, prevClicks),
        inline_link_clicks: dPct(inline_link_clicks, prevLink),
        leads: dPct(leads, prevLeads),
        purchases: dPct(purchases, prevPurch),
        purchase_value: dPct(purchase_value, prevValue),
        messaging_started: dPct(messaging_started, prevMsg),
        ctr: prevImpr > 0 && prevClicks > 0 ? dPct(ctr, (prevClicks / prevImpr) * 100) : null,
        cpc: prevClicks > 0 ? dPct(cpc, prevSpend / prevClicks) : null,
        cpm: prevImpr > 0 ? dPct(cpm, (prevSpend / prevImpr) * 1000) : null,
        cpl: prevLeads > 0 ? dPct(cpl, prevSpend / prevLeads) : null,
        roas: prevSpend > 0 && prevValue > 0 ? dPct(roas, prevValue / prevSpend) : null,
        cost_per_inline_link_click: prevLink > 0 ? dPct(cost_per_inline_link_click, prevSpend / prevLink) : null,
        inline_link_click_ctr: prevImpr > 0 && prevLink > 0 ? dPct(inline_link_click_ctr, (prevLink / prevImpr) * 100) : null,
    };

    return {
        spend, impressions, clicks, inline_link_clicks, reach,
        ctr, inline_link_click_ctr, cpc, cost_per_inline_link_click, cpm, cpp,
        leads, cpl, purchases, purchase_value, cpa_purchase, roas, conversion_rate,
        messaging_started, messaging_replied, cpa_messaging,
        add_to_cart, initiate_checkout, landing_page_views, cpa_landing, complete_registration, contact,
        video_3s, video_p100, thruplay, hook_rate, hold_rate,
        post_engagement, post_save,
        deltas,
    };
}

// usado para validar METRIC_BY_KEY exists at compile time
export const _CHECK_METRIC_BY_KEY: typeof METRIC_BY_KEY = METRIC_BY_KEY;

