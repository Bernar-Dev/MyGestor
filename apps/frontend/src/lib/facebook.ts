/**
 * Facebook Marketing API Helper — Meu Gestor v3
 *
 * Acesso direto à Meta Marketing API (v22.0). Suporta:
 *  - Insights agregados, por campanha, por ad, diários, por hora
 *  - Custom time ranges (since/until) e presets oficiais
 *  - Comparativo período-vs-período-anterior (helper previousRange)
 *  - Breakdowns: age, gender, age+gender, device_platform, publisher_platform,
 *      platform_position, impression_device, country, region, hourly
 *  - Quality rankings, ROAS, video metrics (hook/thumbstop/hold), action_values
 *  - Creative preview (thumb, body, title, CTA, instagram permalink)
 *  - Toggle de status ad/campaign/adset (ACTIVE / PAUSED)
 */

const FB_API_VERSION = 'v22.0';
const FB_GRAPH_URL = `https://graph.facebook.com/${FB_API_VERSION}`;

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export type MetaDatePreset =
    | 'today' | 'yesterday'
    | 'last_3d' | 'last_7d' | 'last_14d' | 'last_28d' | 'last_30d' | 'last_90d'
    | 'this_week_mon_today' | 'this_week_sun_today'
    | 'this_month' | 'last_month'
    | 'this_quarter' | 'last_quarter'
    | 'this_year' | 'last_year'
    | 'maximum';

export interface MetaTimeRange { since: string; until: string; }

export type MetaLevel = 'account' | 'campaign' | 'adset' | 'ad';

export type MetaBreakdown =
    | 'age' | 'gender' | 'age,gender'
    | 'country' | 'region'
    | 'device_platform' | 'publisher_platform' | 'platform_position' | 'impression_device'
    | 'hourly_stats_aggregated_by_advertiser_time_zone';

export interface MetaAccount {
    id: string;
    name: string;
    account_id: string;
    currency: string;
    account_status: number;
    amount_spent: string;
    business_name?: string;
    timezone_name?: string;
    disable_reason?: number;
    balance?: string;
    spend_cap?: string;
    is_prepay_account?: boolean;
    created_time?: string;
    age?: number;
    funding_source_details?: { id?: string; display_string?: string; type?: number };
    capabilities?: string[];
}

export const ACCOUNT_STATUS_LABEL: Record<number, string> = {
    1: 'Ativa',
    2: 'Desativada',
    3: 'Pagamento pendente',
    7: 'Em revisão',
    8: 'Aguardando pagamento',
    9: 'Período de tolerância',
    100: 'Encerramento pendente',
    101: 'Encerrada',
    201: 'Qualquer ativa',
    202: 'Qualquer encerrada',
};

export const DISABLE_REASON_LABEL: Record<number, string> = {
    0: '',
    1: 'Violação política de anúncios',
    2: 'Em revisão de IP',
    3: 'Risco de pagamento',
    4: 'Conta cinza desativada',
    5: 'Revisão AFC',
    6: 'Revisão de integridade do negócio',
    7: 'Fechamento permanente',
    8: 'Conta de revendedor inativa',
    9: 'Conta inativa',
};

export function accountStatusSeverity(status: number, disableReason?: number): 'ok' | 'warn' | 'danger' {
    if (status === 1) return 'ok';
    if (status === 9 || status === 7 || status === 8 || status === 3) return 'warn';
    if (status === 2 || status === 100 || status === 101 || (disableReason && disableReason > 0)) return 'danger';
    return 'warn';
}

export interface MetaActionRow { action_type: string; value: string; }

export interface MetaInsightRaw {
    [k: string]: any;
    spend?: string;
    impressions?: string;
    clicks?: string;
    reach?: string;
    frequency?: string;
    cpc?: string;
    cpm?: string;
    cpp?: string;
    ctr?: string;
    inline_link_clicks?: string;
    inline_link_click_ctr?: string;
    cost_per_inline_link_click?: string;
    unique_clicks?: string;
    unique_ctr?: string;
    cost_per_unique_click?: string;
    actions?: MetaActionRow[];
    action_values?: MetaActionRow[];
    cost_per_action_type?: MetaActionRow[];
    video_play_actions?: MetaActionRow[];
    video_p25_watched_actions?: MetaActionRow[];
    video_p50_watched_actions?: MetaActionRow[];
    video_p75_watched_actions?: MetaActionRow[];
    video_p95_watched_actions?: MetaActionRow[];
    video_p100_watched_actions?: MetaActionRow[];
    video_thruplay_watched_actions?: MetaActionRow[];
    video_30_sec_watched_actions?: MetaActionRow[];
    video_avg_time_watched_actions?: MetaActionRow[];
    quality_ranking?: string;
    engagement_rate_ranking?: string;
    conversion_rate_ranking?: string;
    purchase_roas?: MetaActionRow[];
    website_purchase_roas?: MetaActionRow[];
    date_start?: string;
    date_stop?: string;
    campaign_id?: string;
    campaign_name?: string;
    adset_id?: string;
    adset_name?: string;
    ad_id?: string;
    ad_name?: string;
}

// ─────────────────────────────────────────────────────────────
// CAMPOS PADRÃO QUE PEDIMOS AO META
// ─────────────────────────────────────────────────────────────

export const FIELD_GROUPS = {
    base: [
        'spend', 'impressions', 'clicks', 'reach', 'frequency',
        'cpc', 'cpm', 'cpp', 'ctr',
        'inline_link_clicks', 'inline_link_click_ctr', 'cost_per_inline_link_click',
        'unique_clicks', 'unique_ctr', 'cost_per_unique_click',
    ],
    actions: ['actions', 'action_values', 'cost_per_action_type'],
    video: [
        'video_play_actions',
        'video_p25_watched_actions', 'video_p50_watched_actions',
        'video_p75_watched_actions', 'video_p95_watched_actions', 'video_p100_watched_actions',
        'video_thruplay_watched_actions', 'video_30_sec_watched_actions',
        'video_avg_time_watched_actions',
    ],
    quality: ['quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking'],
    roas: ['purchase_roas', 'website_purchase_roas'],
};

const DEFAULT_INSIGHT_FIELDS = [
    ...FIELD_GROUPS.base,
    ...FIELD_GROUPS.actions,
    ...FIELD_GROUPS.video,
    ...FIELD_GROUPS.quality,
    ...FIELD_GROUPS.roas,
];

// ─────────────────────────────────────────────────────────────
// CORE: chamada genérica + paginação automática
// ─────────────────────────────────────────────────────────────

// Códigos de erro Meta que indicam falha transitória (worth retrying):
//   1   = API unknown / temporary
//   2   = Service temporarily unavailable
//   4   = Application request limit reached (rate limit)
//   17  = User request limit reached
//   32  = Page request limit reached
//   341 = Application limit reached
//   368 = Temporarily blocked for policies violations (não retentar, mas seguro pra rate)
//   613 = Calls to this api have exceeded the rate limit
const TRANSIENT_FB_CODES = new Set([1, 2, 4, 17, 32, 341, 613]);
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 800;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fbFetch<T = any>(url: string): Promise<T> {
    let lastErr: any;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        let res: Response | undefined;
        try {
            res = await fetch(url, { cache: 'no-store' });
        } catch (netErr: any) {
            // erro de rede (DNS, timeout, reset). Retentar.
            lastErr = netErr;
            if (attempt < MAX_RETRIES) {
                await sleep(BASE_DELAY_MS * 2 ** attempt + Math.random() * 250);
                continue;
            }
            throw netErr;
        }

        // 5xx / 429 — sempre retentar
        if (res.status >= 500 || res.status === 429) {
            const retryAfter = Number(res.headers.get('retry-after')) || 0;
            lastErr = new Error(`Meta HTTP ${res.status}${res.status === 429 ? ' (rate limit)' : ''}`);
            if (attempt < MAX_RETRIES) {
                const delay = retryAfter > 0
                    ? retryAfter * 1000
                    : BASE_DELAY_MS * 2 ** attempt + Math.random() * 250;
                await sleep(delay);
                continue;
            }
            throw lastErr;
        }

        // tentar parsear JSON; se vier HTML/texto, tratar como transitório
        let json: any;
        try {
            json = await res.json();
        } catch {
            lastErr = new Error(`Meta retornou resposta inválida (HTTP ${res.status})`);
            if (attempt < MAX_RETRIES) {
                await sleep(BASE_DELAY_MS * 2 ** attempt + Math.random() * 250);
                continue;
            }
            throw lastErr;
        }

        if (json.error) {
            const code = Number(json.error.code);
            const subcode = Number(json.error.error_subcode);
            const isTransient = TRANSIENT_FB_CODES.has(code) || subcode === 2446079;
            const err: any = new Error(json.error.message || 'Erro Meta API');
            err.fb = json.error;
            if (isTransient && attempt < MAX_RETRIES) {
                lastErr = err;
                await sleep(BASE_DELAY_MS * 2 ** attempt + Math.random() * 250);
                continue;
            }
            throw err;
        }

        return json;
    }
    throw lastErr || new Error('Meta API: falha após retries');
}

async function fbPaginate<T = any>(initialUrl: string): Promise<T[]> {
    const all: T[] = [];
    let url: string | null = initialUrl;
    let safety = 50;
    while (url && safety-- > 0) {
        const data: any = await fbFetch<any>(url);
        if (Array.isArray(data?.data)) all.push(...data.data);
        url = data?.paging?.next || null;
    }
    return all;
}

interface InsightsParams {
    object: string;                  // 'me' | 'act_xxx' | campaign_id | adset_id
    accessToken: string;
    level?: MetaLevel;
    datePreset?: MetaDatePreset;
    timeRange?: MetaTimeRange;
    timeIncrement?: number | 'all_days';
    breakdowns?: MetaBreakdown | MetaBreakdown[];
    fields?: string[];
    extraFields?: string[];          // adiciona aos default
    actionAttributionWindows?: string[];
    limit?: number;
}

export async function metaInsights(p: InsightsParams): Promise<MetaInsightRaw[]> {
    const fields = p.fields ?? [...DEFAULT_INSIGHT_FIELDS, ...(p.extraFields || [])];
    const params = new URLSearchParams();
    if (p.level) params.set('level', p.level);
    if (p.datePreset) params.set('date_preset', p.datePreset);
    if (p.timeRange) params.set('time_range', JSON.stringify(p.timeRange));
    if (p.timeIncrement !== undefined) params.set('time_increment', String(p.timeIncrement));
    if (p.breakdowns) {
        const bd = Array.isArray(p.breakdowns) ? p.breakdowns.join(',') : p.breakdowns;
        params.set('breakdowns', bd);
    }
    if (p.actionAttributionWindows?.length)
        params.set('action_attribution_windows', JSON.stringify(p.actionAttributionWindows));
    // sempre identificadores básicos
    const idFields: string[] = [];
    if (p.level === 'campaign') idFields.push('campaign_id', 'campaign_name');
    if (p.level === 'adset') idFields.push('adset_id', 'adset_name', 'campaign_id', 'campaign_name');
    if (p.level === 'ad') idFields.push('ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id', 'campaign_name');
    if (p.timeIncrement) idFields.push('date_start', 'date_stop');

    params.set('fields', Array.from(new Set([...fields, ...idFields])).join(','));
    params.set('limit', String(p.limit ?? 500));
    params.set('access_token', p.accessToken);

    const url = `${FB_GRAPH_URL}/${p.object}/insights?${params.toString()}`;
    return fbPaginate<MetaInsightRaw>(url);
}

// ─────────────────────────────────────────────────────────────
// CONTAS
// ─────────────────────────────────────────────────────────────

export async function getAllAdAccounts(accessToken: string): Promise<MetaAccount[]> {
    const fields = [
        'name', 'account_id', 'currency', 'account_status', 'amount_spent',
        'business_name', 'timezone_name', 'disable_reason',
        'balance', 'spend_cap', 'is_prepay_account', 'created_time', 'age',
        'funding_source_details', 'capabilities',
    ].join(',');
    return fbPaginate<MetaAccount>(
        `${FB_GRAPH_URL}/me/adaccounts?fields=${fields}&limit=100&access_token=${accessToken}`
    );
}

// ─────────────────────────────────────────────────────────────
// SHORT-CUTS (compat com endpoints já existentes)
// ─────────────────────────────────────────────────────────────

export async function getAccountInsights(
    adAccountId: string,
    accessToken: string,
    datePreset: MetaDatePreset = 'last_7d',
    timeRange?: MetaTimeRange,
) {
    const data = await metaInsights({
        object: adAccountId,
        accessToken,
        datePreset: timeRange ? undefined : datePreset,
        timeRange,
    });
    return data?.[0] || null;
}

export async function getCampaignsInsights(
    adAccountId: string,
    accessToken: string,
    datePreset: MetaDatePreset = 'last_7d',
    timeRange?: MetaTimeRange,
): Promise<MetaInsightRaw[]> {
    return metaInsights({
        object: adAccountId,
        accessToken,
        level: 'campaign',
        datePreset: timeRange ? undefined : datePreset,
        timeRange,
    });
}

export async function getAdsetsInsights(
    parentId: string,
    accessToken: string,
    datePreset: MetaDatePreset = 'last_7d',
    timeRange?: MetaTimeRange,
): Promise<MetaInsightRaw[]> {
    return metaInsights({
        object: parentId,
        accessToken,
        level: 'adset',
        datePreset: timeRange ? undefined : datePreset,
        timeRange,
    });
}

export async function getAdsInsights(
    parentId: string,
    accessToken: string,
    datePreset: MetaDatePreset = 'last_7d',
    timeRange?: MetaTimeRange,
): Promise<MetaInsightRaw[]> {
    return metaInsights({
        object: parentId,
        accessToken,
        level: 'ad',
        datePreset: timeRange ? undefined : datePreset,
        timeRange,
    });
}

export async function getDailyInsights(
    adAccountOrCampaignId: string,
    accessToken: string,
    datePreset: MetaDatePreset = 'last_7d',
    timeRange?: MetaTimeRange,
): Promise<MetaInsightRaw[]> {
    return metaInsights({
        object: adAccountOrCampaignId,
        accessToken,
        timeIncrement: 1,
        datePreset: timeRange ? undefined : datePreset,
        timeRange,
        fields: [
            'spend', 'impressions', 'clicks', 'reach', 'inline_link_clicks',
            'actions', 'action_values', 'purchase_roas',
        ],
    });
}

export async function getHourlyInsights(
    adAccountId: string,
    accessToken: string,
    datePreset: MetaDatePreset = 'last_7d',
    timeRange?: MetaTimeRange,
): Promise<MetaInsightRaw[]> {
    return metaInsights({
        object: adAccountId,
        accessToken,
        breakdowns: 'hourly_stats_aggregated_by_advertiser_time_zone',
        datePreset: timeRange ? undefined : datePreset,
        timeRange,
        fields: [
            'spend', 'impressions', 'clicks', 'reach',
            'inline_link_clicks', 'actions', 'action_values',
        ],
    });
}

export async function getBreakdownInsights(
    object: string,
    accessToken: string,
    breakdowns: MetaBreakdown,
    datePreset: MetaDatePreset = 'last_7d',
    timeRange?: MetaTimeRange,
): Promise<MetaInsightRaw[]> {
    return metaInsights({
        object,
        accessToken,
        breakdowns,
        datePreset: timeRange ? undefined : datePreset,
        timeRange,
        fields: [
            'spend', 'impressions', 'clicks', 'reach', 'frequency',
            'cpc', 'cpm', 'ctr', 'inline_link_clicks',
            'actions', 'action_values', 'purchase_roas',
        ],
    });
}

// ─────────────────────────────────────────────────────────────
// CREATIVE (preview do anúncio)
// ─────────────────────────────────────────────────────────────

export interface AdCreativePreview {
    ad_id: string;
    ad_name: string;
    status: string;
    effective_status: string;
    creative?: {
        id: string;
        thumbnail_url?: string;
        image_url?: string;
        body?: string;
        title?: string;
        call_to_action_type?: string;
        instagram_permalink_url?: string;
        video_id?: string;
        object_story_spec?: any;
    };
}

export async function getAdCreative(adId: string, accessToken: string): Promise<AdCreativePreview | null> {
    const fields = [
        'id', 'name', 'status', 'effective_status',
        'creative{id,thumbnail_url,image_url,body,title,call_to_action_type,instagram_permalink_url,video_id,object_story_spec}',
    ].join(',');
    try {
        const data = await fbFetch<any>(`${FB_GRAPH_URL}/${adId}?fields=${fields}&access_token=${accessToken}`);
        return {
            ad_id: data.id,
            ad_name: data.name,
            status: data.status,
            effective_status: data.effective_status,
            creative: data.creative,
        };
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
// ACTIVE ADS (lista compartilhável: cada anúncio com link público)
// ─────────────────────────────────────────────────────────────

export interface ActiveAdLink {
    ad_id: string;
    ad_name: string;
    effective_status: string;
    campaign_id?: string;
    campaign_name?: string;
    adset_id?: string;
    adset_name?: string;
    thumbnail_url?: string;
    instagram_permalink_url?: string;
    facebook_permalink_url?: string;
    preview_shareable_link?: string;
}

/** Constrói URL pública do post no FB a partir de "page_id_post_id" */
function buildFbPermalink(objectStoryId?: string): string | undefined {
    if (!objectStoryId) return undefined;
    const m = String(objectStoryId).match(/^(\d+)_(\d+)$/);
    if (!m) return undefined;
    return `https://www.facebook.com/${m[1]}/posts/${m[2]}`;
}

export async function getActiveAdsForAccount(
    adAccountId: string,
    accessToken: string,
): Promise<ActiveAdLink[]> {
    const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const fields = [
        'id', 'name', 'effective_status', 'status',
        'campaign_id', 'campaign{name}',
        'adset_id', 'adset{name}',
        'creative{id,thumbnail_url,instagram_permalink_url,object_story_id,effective_object_story_id}',
    ].join(',');
    const filtering = encodeURIComponent(JSON.stringify([
        { field: 'effective_status', operator: 'IN', value: ['ACTIVE'] },
    ]));
    const url = `${FB_GRAPH_URL}/${accountId}/ads?fields=${fields}&filtering=${filtering}&limit=200&access_token=${accessToken}`;
    const ads = await fbPaginate<any>(url);
    return ads.map(a => {
        const c = a.creative || {};
        const fbObjId = c.effective_object_story_id || c.object_story_id;
        return {
            ad_id: a.id,
            ad_name: a.name,
            effective_status: a.effective_status,
            campaign_id: a.campaign_id,
            campaign_name: a.campaign?.name,
            adset_id: a.adset_id,
            adset_name: a.adset?.name,
            thumbnail_url: c.thumbnail_url,
            instagram_permalink_url: c.instagram_permalink_url,
            facebook_permalink_url: buildFbPermalink(fbObjId),
            preview_shareable_link: c.preview_shareable_link,
        };
    });
}

/** Busca anúncios ativos de uma conta, filtrados por campaign_id */
export async function getActiveAdsForCampaign(
    campaignId: string,
    accessToken: string,
): Promise<ActiveAdLink[]> {
    const fields = [
        'id', 'name', 'effective_status', 'status',
        'campaign_id', 'campaign{name}',
        'adset_id', 'adset{name}',
        'creative{id,thumbnail_url,instagram_permalink_url,object_story_id,effective_object_story_id}',
    ].join(',');
    const filtering = encodeURIComponent(JSON.stringify([
        { field: 'effective_status', operator: 'IN', value: ['ACTIVE'] },
    ]));
    const url = `${FB_GRAPH_URL}/${campaignId}/ads?fields=${fields}&filtering=${filtering}&limit=200&access_token=${accessToken}`;
    const ads = await fbPaginate<any>(url);
    return ads.map(a => {
        const c = a.creative || {};
        const fbObjId = c.effective_object_story_id || c.object_story_id;
        return {
            ad_id: a.id,
            ad_name: a.name,
            effective_status: a.effective_status,
            campaign_id: a.campaign_id,
            campaign_name: a.campaign?.name,
            adset_id: a.adset_id,
            adset_name: a.adset?.name,
            thumbnail_url: c.thumbnail_url,
            instagram_permalink_url: c.instagram_permalink_url,
            facebook_permalink_url: buildFbPermalink(fbObjId),
            preview_shareable_link: c.preview_shareable_link,
        };
    });
}

/** Busca anúncios ativos de um conjunto de anúncios (adset) */
export async function getActiveAdsForAdset(
    adsetId: string,
    accessToken: string,
): Promise<ActiveAdLink[]> {
    const fields = [
        'id', 'name', 'effective_status', 'status',
        'campaign_id', 'campaign{name}',
        'adset_id', 'adset{name}',
        'creative{id,thumbnail_url,instagram_permalink_url,object_story_id,effective_object_story_id}',
    ].join(',');
    const filtering = encodeURIComponent(JSON.stringify([
        { field: 'effective_status', operator: 'IN', value: ['ACTIVE'] },
    ]));
    const url = `${FB_GRAPH_URL}/${adsetId}/ads?fields=${fields}&filtering=${filtering}&limit=200&access_token=${accessToken}`;
    const ads = await fbPaginate<any>(url);
    return ads.map(a => {
        const c = a.creative || {};
        const fbObjId = c.effective_object_story_id || c.object_story_id;
        return {
            ad_id: a.id,
            ad_name: a.name,
            effective_status: a.effective_status,
            campaign_id: a.campaign_id,
            campaign_name: a.campaign?.name,
            adset_id: a.adset_id,
            adset_name: a.adset?.name,
            thumbnail_url: c.thumbnail_url,
            instagram_permalink_url: c.instagram_permalink_url,
            facebook_permalink_url: buildFbPermalink(fbObjId),
            preview_shareable_link: c.preview_shareable_link,
        };
    });
}

// ─────────────────────────────────────────────────────────────
// HELPERS DE EXTRAÇÃO
// ─────────────────────────────────────────────────────────────

export function getActionValue(
    actions: MetaActionRow[] | undefined,
    actionType: string,
): number {
    if (!actions) return 0;
    const a = actions.find(x => x.action_type === actionType);
    return a ? Number(a.value) : 0;
}

/** soma vários action_types (útil pra "leads" agregando lead + onsite_lead + offsite_lead etc) */
export function sumActions(
    actions: MetaActionRow[] | undefined,
    actionTypes: string[],
): number {
    if (!actions) return 0;
    return actions
        .filter(a => actionTypes.includes(a.action_type))
        .reduce((s, a) => s + Number(a.value || 0), 0);
}

/** Mapas de conversão padrão por categoria */
export const ACTION_MAP = {
    leads: ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'leadgen.other'],
    purchases: ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'],
    add_to_cart: ['add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart'],
    initiate_checkout: ['initiate_checkout', 'offsite_conversion.fb_pixel_initiate_checkout'],
    view_content: ['view_content', 'offsite_conversion.fb_pixel_view_content'],
    complete_registration: ['complete_registration', 'offsite_conversion.fb_pixel_complete_registration'],
    search: ['search', 'offsite_conversion.fb_pixel_search'],
    contact: ['contact', 'offsite_conversion.fb_pixel_contact'],
    messaging_started: ['onsite_conversion.messaging_conversation_started_7d'],
    messaging_replied: ['onsite_conversion.messaging_first_reply', 'onsite_conversion.total_messaging_connection'],
    link_clicks: ['link_click'],
    landing_page_views: ['landing_page_view', 'omni_landing_page_view'],
    post_engagement: ['post_engagement'],
    page_engagement: ['page_engagement'],
    post_reaction: ['post_reaction'],
    post_save: ['onsite_conversion.post_save'],
    video_3s: ['video_view'],
};

/**
 * Achata um insight bruto da Meta em um objeto plano com 60+ métricas calculadas.
 * Esse é o formato canônico usado pelo frontend e pelo export.
 */
export function flattenInsight(raw: MetaInsightRaw, currency: string = 'BRL') {
    const num = (v: any) => Number(v || 0);
    const spend = num(raw.spend);
    const impressions = num(raw.impressions);
    const clicks = num(raw.clicks);
    const reach = num(raw.reach);
    const frequency = num(raw.frequency);
    const inline_link_clicks = num(raw.inline_link_clicks);
    const unique_clicks = num(raw.unique_clicks);

    const leads = sumActions(raw.actions, ACTION_MAP.leads);
    const purchases = sumActions(raw.actions, ACTION_MAP.purchases);
    const purchase_value = sumActions(raw.action_values, ACTION_MAP.purchases);
    const add_to_cart = sumActions(raw.actions, ACTION_MAP.add_to_cart);
    const initiate_checkout = sumActions(raw.actions, ACTION_MAP.initiate_checkout);
    const view_content = sumActions(raw.actions, ACTION_MAP.view_content);
    const complete_registration = sumActions(raw.actions, ACTION_MAP.complete_registration);
    const search = sumActions(raw.actions, ACTION_MAP.search);
    const contact = sumActions(raw.actions, ACTION_MAP.contact);
    const messaging_started = sumActions(raw.actions, ACTION_MAP.messaging_started);
    const messaging_replied = sumActions(raw.actions, ACTION_MAP.messaging_replied);
    const link_clicks = sumActions(raw.actions, ACTION_MAP.link_clicks);
    const landing_page_views = sumActions(raw.actions, ACTION_MAP.landing_page_views);
    const post_engagement = sumActions(raw.actions, ACTION_MAP.post_engagement);
    const page_engagement = sumActions(raw.actions, ACTION_MAP.page_engagement);
    const post_reaction = sumActions(raw.actions, ACTION_MAP.post_reaction);
    const post_save = sumActions(raw.actions, ACTION_MAP.post_save);
    const video_3s = sumActions(raw.actions, ACTION_MAP.video_3s);

    const video_p25 = sumActions(raw.video_p25_watched_actions, ['video_view']);
    const video_p50 = sumActions(raw.video_p50_watched_actions, ['video_view']);
    const video_p75 = sumActions(raw.video_p75_watched_actions, ['video_view']);
    const video_p95 = sumActions(raw.video_p95_watched_actions, ['video_view']);
    const video_p100 = sumActions(raw.video_p100_watched_actions, ['video_view']);
    const thruplay = sumActions(raw.video_thruplay_watched_actions, ['video_view']);
    const video_avg_time = sumActions(raw.video_avg_time_watched_actions, ['video_view']);

    // Métricas derivadas
    const cpm = num(raw.cpm) || (impressions > 0 ? (spend / impressions) * 1000 : 0);
    const cpc = num(raw.cpc) || (clicks > 0 ? spend / clicks : 0);
    const ctr = num(raw.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : 0);
    const cpp = num(raw.cpp) || (reach > 0 ? (spend / reach) * 1000 : 0);
    const inline_link_click_ctr = num(raw.inline_link_click_ctr) ||
        (impressions > 0 ? (inline_link_clicks / impressions) * 100 : 0);
    const cost_per_inline_link_click = num(raw.cost_per_inline_link_click) ||
        (inline_link_clicks > 0 ? spend / inline_link_clicks : 0);
    const unique_ctr = num(raw.unique_ctr);
    const cost_per_unique_click = num(raw.cost_per_unique_click);

    const cpl = leads > 0 ? spend / leads : 0;
    const cpa_purchase = purchases > 0 ? spend / purchases : 0;
    const cpa_messaging = messaging_started > 0 ? spend / messaging_started : 0;
    const cpa_contact = contact > 0 ? spend / contact : 0;
    const cpa_landing = landing_page_views > 0 ? spend / landing_page_views : 0;
    const roas = spend > 0 ? purchase_value / spend : 0;
    const conversion_rate = clicks > 0 ? (purchases / clicks) * 100 : 0;
    const lead_rate = clicks > 0 ? (leads / clicks) * 100 : 0;

    // Métricas de vídeo derivadas
    const hook_rate = impressions > 0 ? (video_3s / impressions) * 100 : 0;
    const thumbstop_rate = impressions > 0 ? (video_3s / impressions) * 100 : 0; // alias
    const hold_rate = video_3s > 0 ? (video_p100 / video_3s) * 100 : 0;
    const view_rate_25 = impressions > 0 ? (video_p25 / impressions) * 100 : 0;
    const view_rate_50 = impressions > 0 ? (video_p50 / impressions) * 100 : 0;
    const view_rate_75 = impressions > 0 ? (video_p75 / impressions) * 100 : 0;
    const view_rate_95 = impressions > 0 ? (video_p95 / impressions) * 100 : 0;
    const view_rate_100 = impressions > 0 ? (video_p100 / impressions) * 100 : 0;
    const cost_per_thruplay = thruplay > 0 ? spend / thruplay : 0;

    return {
        // identidade
        date_start: raw.date_start,
        date_stop: raw.date_stop,
        campaign_id: raw.campaign_id,
        campaign_name: raw.campaign_name,
        adset_id: raw.adset_id,
        adset_name: raw.adset_name,
        ad_id: raw.ad_id,
        ad_name: raw.ad_name,
        currency,

        // base
        spend, impressions, clicks, reach, frequency,
        cpm, cpc, cpp, ctr,
        inline_link_clicks, inline_link_click_ctr, cost_per_inline_link_click,
        unique_clicks, unique_ctr, cost_per_unique_click,

        // conversões
        leads, cpl, lead_rate,
        purchases, purchase_value, cpa_purchase, roas, conversion_rate,
        add_to_cart, initiate_checkout, view_content, complete_registration,
        search, contact, cpa_contact,
        messaging_started, messaging_replied, cpa_messaging,
        link_clicks, landing_page_views, cpa_landing,
        post_engagement, page_engagement, post_reaction, post_save,

        // vídeo
        video_3s, video_p25, video_p50, video_p75, video_p95, video_p100,
        thruplay, cost_per_thruplay, video_avg_time,
        hook_rate, thumbstop_rate, hold_rate,
        view_rate_25, view_rate_50, view_rate_75, view_rate_95, view_rate_100,

        // qualidade Meta
        quality_ranking: raw.quality_ranking,
        engagement_rate_ranking: raw.engagement_rate_ranking,
        conversion_rate_ranking: raw.conversion_rate_ranking,

        // raw para debug
        _raw_actions: raw.actions,
    };
}

export type FlatInsight = ReturnType<typeof flattenInsight>;

// ─────────────────────────────────────────────────────────────
// HEALTH SCORE — algoritmo proprietário (0-100)
// ─────────────────────────────────────────────────────────────

export function healthScore(f: FlatInsight): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 100;

    // CTR — esperado >1%
    if (f.impressions > 1000) {
        if (f.ctr < 0.5) { score -= 18; reasons.push('CTR muito baixo (<0,5%)'); }
        else if (f.ctr < 1) { score -= 8; reasons.push('CTR abaixo da média (<1%)'); }
    }
    // Frequência — alerta >3.5
    if (f.frequency > 5) { score -= 18; reasons.push('Frequência crítica (>5)'); }
    else if (f.frequency > 3.5) { score -= 8; reasons.push('Frequência alta (>3,5)'); }

    // CPM elevado depende do nicho — usamos como sinal relativo
    if (f.cpm > 80) { score -= 8; reasons.push('CPM elevado (>R$80)'); }

    // Quality rankings da própria Meta
    const rankPenalty = (r?: string) => {
        if (!r || r === 'UNKNOWN') return 0;
        if (r === 'BELOW_AVERAGE_10' || r === 'BELOW_AVERAGE_20_35') return 16;
        if (r === 'BELOW_AVERAGE_35_55') return 8;
        if (r === 'AVERAGE') return 0;
        if (r === 'ABOVE_AVERAGE') return -4; // bônus
        return 0;
    };
    const qp = rankPenalty(f.quality_ranking);
    const ep = rankPenalty(f.engagement_rate_ranking);
    const cp = rankPenalty(f.conversion_rate_ranking);
    if (qp > 0) reasons.push('Quality ranking abaixo da média');
    if (ep > 0) reasons.push('Engagement ranking abaixo da média');
    if (cp > 0) reasons.push('Conversion ranking abaixo da média');
    score -= (qp + ep + cp);

    // Ausência de conversão com gasto relevante
    if (f.spend > 50 && f.leads + f.purchases + f.messaging_started === 0) {
        score -= 25;
        reasons.push('Gasto sem conversão registrada');
    }
    // ROAS quando há valor — bônus se > 2
    if (f.purchase_value > 0) {
        if (f.roas >= 3) { score += 5; reasons.push('ROAS forte (≥3x)'); }
        else if (f.roas < 1) { score -= 14; reasons.push('ROAS abaixo de 1x'); }
    }

    score = Math.max(0, Math.min(100, score));
    return { score, reasons };
}

// ─────────────────────────────────────────────────────────────
// PERÍODO ANTERIOR (para comparativo)
// ─────────────────────────────────────────────────────────────

const ONE_DAY = 86_400_000;
const DEFAULT_TZ = 'America/Sao_Paulo';

function ymd(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/** Retorna {y, m, d} de "agora" no fuso indicado (default: Brasília). */
function dateInTz(tz: string = DEFAULT_TZ, now: Date = new Date()): { y: number; m: number; d: number } {
    // pt-BR formata como dd/mm/aaaa; uso en-CA que dá aaaa-mm-dd, parsing fácil
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const parts = fmt.formatToParts(now);
    const get = (k: string) => Number(parts.find(p => p.type === k)?.value);
    return { y: get('year'), m: get('month'), d: get('day') };
}

/**
 * Resolve um preset para o range absoluto [since, until] em YYYY-MM-DD,
 * considerando "hoje" no fuso de Brasília (America/Sao_Paulo) por padrão.
 *
 * IMPORTANTE: O Vercel/Node rodam em UTC, então sem essa correção, a partir
 * das 21h Brasília o servidor já contava o dia seguinte e Meta retornava
 * vazio em "today".
 */
export function presetToRange(
    preset: MetaDatePreset,
    opts?: { timezone?: string; now?: Date },
): MetaTimeRange {
    const tz = opts?.timezone || DEFAULT_TZ;
    const { y, m, d } = dateInTz(tz, opts?.now);
    // Base UTC midnight nos componentes locais — usado só pra aritmética em dias.
    const t = new Date(Date.UTC(y, m - 1, d));
    const sub = (n: number) => new Date(t.getTime() - n * ONE_DAY);

    switch (preset) {
        case 'today':       return { since: ymd(t),       until: ymd(t) };
        case 'yesterday':   return { since: ymd(sub(1)),  until: ymd(sub(1)) };
        case 'last_3d':     return { since: ymd(sub(3)),  until: ymd(sub(1)) };
        case 'last_7d':     return { since: ymd(sub(7)),  until: ymd(sub(1)) };
        case 'last_14d':    return { since: ymd(sub(14)), until: ymd(sub(1)) };
        case 'last_28d':    return { since: ymd(sub(28)), until: ymd(sub(1)) };
        case 'last_30d':    return { since: ymd(sub(30)), until: ymd(sub(1)) };
        case 'last_90d':    return { since: ymd(sub(90)), until: ymd(sub(1)) };
        case 'this_month': {
            const start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
            return { since: ymd(start), until: ymd(t) };
        }
        case 'last_month': {
            const start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1));
            const end = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0));
            return { since: ymd(start), until: ymd(end) };
        }
        case 'this_quarter': {
            const q = Math.floor(t.getUTCMonth() / 3);
            const start = new Date(Date.UTC(t.getUTCFullYear(), q * 3, 1));
            return { since: ymd(start), until: ymd(t) };
        }
        case 'last_quarter': {
            const q = Math.floor(t.getUTCMonth() / 3) - 1;
            const yr = q < 0 ? t.getUTCFullYear() - 1 : t.getUTCFullYear();
            const qq = (q + 4) % 4;
            const start = new Date(Date.UTC(yr, qq * 3, 1));
            const end = new Date(Date.UTC(yr, qq * 3 + 3, 0));
            return { since: ymd(start), until: ymd(end) };
        }
        case 'this_year':   return { since: ymd(new Date(Date.UTC(t.getUTCFullYear(), 0, 1))), until: ymd(t) };
        case 'last_year':   return { since: ymd(new Date(Date.UTC(t.getUTCFullYear() - 1, 0, 1))), until: ymd(new Date(Date.UTC(t.getUTCFullYear() - 1, 11, 31))) };
        default:            return { since: ymd(sub(7)), until: ymd(sub(1)) };
    }
}

/** Dado um range, retorna o range imediatamente anterior do mesmo tamanho. */
export function previousRange(range: MetaTimeRange): MetaTimeRange {
    const since = new Date(range.since + 'T00:00:00Z');
    const until = new Date(range.until + 'T00:00:00Z');
    const days = Math.round((until.getTime() - since.getTime()) / ONE_DAY) + 1;
    const prevUntil = new Date(since.getTime() - ONE_DAY);
    const prevSince = new Date(prevUntil.getTime() - (days - 1) * ONE_DAY);
    return { since: ymd(prevSince), until: ymd(prevUntil) };
}

// ─────────────────────────────────────────────────────────────
// DELTA (compara dois flats)
// ─────────────────────────────────────────────────────────────

export function deltaPct(current: number, previous: number): number | null {
    if (previous === 0 && current === 0) return 0;
    if (previous === 0) return null; // sem base de comparação
    return ((current - previous) / previous) * 100;
}

// ─────────────────────────────────────────────────────────────
// STATUS TOGGLE
// ─────────────────────────────────────────────────────────────

export async function setObjectStatus(
    objectId: string,
    accessToken: string,
    status: 'ACTIVE' | 'PAUSED',
): Promise<any> {
    const res = await fetch(`${FB_GRAPH_URL}/${objectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, access_token: accessToken }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data;
}
