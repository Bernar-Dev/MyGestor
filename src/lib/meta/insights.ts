/**
 * Helpers de leitura da Meta Marketing API para o dashboard / portal.
 * Camadas finas em cima de api.ts (que tem o fetch + retry).
 */
import { FB_API_VERSION } from "@/lib/meta/api";

const FB = `https://graph.facebook.com/${FB_API_VERSION}`;

async function fetchJson(url: string): Promise<any> {
    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json();
    if (j.error) throw Object.assign(new Error(j.error.message), { fb: j.error });
    return j;
}

async function paginate<T>(initial: string): Promise<T[]> {
    const all: T[] = [];
    let url: string | null = initial;
    let safety = 30;
    while (url && safety-- > 0) {
        const j: any = await fetchJson(url);
        if (Array.isArray(j?.data)) all.push(...j.data);
        url = j?.paging?.next || null;
    }
    return all;
}

export interface Campaign {
    id: string;
    name: string;
    objective: string;
    status: string;
    effective_status: string;
    daily_budget?: string;
    lifetime_budget?: string;
    start_time?: string;
    stop_time?: string;
}
export async function getCampaigns(accessToken: string, adAccountId: string): Promise<Campaign[]> {
    const fields = "name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time";
    return paginate<Campaign>(
        `${FB}/${adAccountId}/campaigns?fields=${fields}&limit=100&access_token=${encodeURIComponent(accessToken)}`,
    );
}

export interface AccountInsights {
    spend: string; impressions: string; clicks: string; ctr: string; cpc: string; cpm: string;
    reach?: string; frequency?: string; date_start: string; date_stop: string;
    actions?: { action_type: string; value: string }[];
}
export async function getAccountInsights(opts: {
    accessToken: string; adAccountId: string;
    datePreset?: "today" | "yesterday" | "last_7d" | "last_30d" | "this_month" | "last_month";
}): Promise<AccountInsights | null> {
    const preset = opts.datePreset || "last_30d";
    const fields = "spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions";
    const url = `${FB}/${opts.adAccountId}/insights?fields=${fields}&date_preset=${preset}&access_token=${encodeURIComponent(opts.accessToken)}`;
    const j = await fetchJson(url);
    return j?.data?.[0] || null;
}

export interface AdCreative {
    id: string;
    name: string;
    status: string;
    creative?: { id: string; thumbnail_url?: string; image_url?: string; title?: string; body?: string };
}
export async function getActiveAds(accessToken: string, adAccountId: string, limit = 50): Promise<AdCreative[]> {
    const fields = "name,status,creative{id,thumbnail_url,image_url,title,body}";
    const url = `${FB}/${adAccountId}/ads?fields=${fields}&effective_status=['ACTIVE']&limit=${limit}&access_token=${encodeURIComponent(accessToken)}`;
    const j = await fetchJson(url);
    return j?.data || [];
}
