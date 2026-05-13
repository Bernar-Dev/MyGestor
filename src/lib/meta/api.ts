/**
 * Wrapper enxuto da Meta Graph API com retry/backoff em erros transitórios.
 * Versão do Newgestor: recebe accessToken como parâmetro (per-user) — sem env var.
 */

export const FB_API_VERSION = "v22.0";
const FB_GRAPH_URL = `https://graph.facebook.com/${FB_API_VERSION}`;

const TRANSIENT_FB_CODES = new Set([1, 2, 4, 17, 32, 341, 613]);
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 800;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fbFetch<T = any>(url: string): Promise<T> {
    let lastErr: any;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        let res: Response | undefined;
        try {
            res = await fetch(url, { cache: "no-store" });
        } catch (netErr: any) {
            lastErr = netErr;
            if (attempt < MAX_RETRIES) { await sleep(BASE_DELAY_MS * 2 ** attempt + Math.random() * 250); continue; }
            throw netErr;
        }

        if (res.status >= 500 || res.status === 429) {
            const retryAfter = Number(res.headers.get("retry-after")) || 0;
            lastErr = new Error(`Meta HTTP ${res.status}${res.status === 429 ? " (rate limit)" : ""}`);
            if (attempt < MAX_RETRIES) {
                await sleep(retryAfter > 0 ? retryAfter * 1000 : BASE_DELAY_MS * 2 ** attempt + Math.random() * 250);
                continue;
            }
            throw lastErr;
        }

        let json: any;
        try { json = await res.json(); }
        catch {
            lastErr = new Error(`Meta retornou resposta invalida (HTTP ${res.status})`);
            if (attempt < MAX_RETRIES) { await sleep(BASE_DELAY_MS * 2 ** attempt + Math.random() * 250); continue; }
            throw lastErr;
        }

        if (json.error) {
            const code = Number(json.error.code);
            const isTransient = TRANSIENT_FB_CODES.has(code);
            const err: any = new Error(json.error.message || "Erro Meta API");
            err.fb = json.error;
            if (isTransient && attempt < MAX_RETRIES) {
                lastErr = err; await sleep(BASE_DELAY_MS * 2 ** attempt + Math.random() * 250); continue;
            }
            throw err;
        }
        return json;
    }
    throw lastErr || new Error("Meta API: falha apos retries");
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

// ─── Trocar short-lived token por long-lived (~60 dias) ─────────────
export interface ExchangeTokenResult {
    access_token: string;
    expires_in: number;            // segundos
    token_type: string;
}
export async function exchangeForLongLivedToken(opts: {
    appId: string; appSecret: string; shortLivedToken: string;
}): Promise<ExchangeTokenResult> {
    const url = `${FB_GRAPH_URL}/oauth/access_token`
        + `?grant_type=fb_exchange_token`
        + `&client_id=${encodeURIComponent(opts.appId)}`
        + `&client_secret=${encodeURIComponent(opts.appSecret)}`
        + `&fb_exchange_token=${encodeURIComponent(opts.shortLivedToken)}`;
    return fbFetch<ExchangeTokenResult>(url);
}

// ─── Trocar OAuth code por access_token ─────────────────────────────
export async function exchangeCodeForToken(opts: {
    appId: string; appSecret: string; code: string; redirectUri: string;
}): Promise<{ access_token: string; token_type: string; expires_in?: number }> {
    const url = `${FB_GRAPH_URL}/oauth/access_token`
        + `?client_id=${encodeURIComponent(opts.appId)}`
        + `&client_secret=${encodeURIComponent(opts.appSecret)}`
        + `&redirect_uri=${encodeURIComponent(opts.redirectUri)}`
        + `&code=${encodeURIComponent(opts.code)}`;
    return fbFetch(url);
}

// ─── Dados do usuário dono do token ─────────────────────────────────
export async function getMe(accessToken: string): Promise<{ id: string; name: string; email?: string }> {
    return fbFetch(`${FB_GRAPH_URL}/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`);
}

// ─── Ad accounts visíveis pelo token ────────────────────────────────
export interface MetaAccount {
    id: string;
    name: string;
    account_id: string;
    currency: string;
    account_status: number;
    amount_spent: string;
    business_name?: string;
    timezone_name?: string;
}
export async function getAllAdAccounts(accessToken: string): Promise<MetaAccount[]> {
    const fields = "name,account_id,currency,account_status,amount_spent,business_name,timezone_name";
    return fbPaginate<MetaAccount>(
        `${FB_GRAPH_URL}/me/adaccounts?fields=${fields}&limit=100&access_token=${encodeURIComponent(accessToken)}`,
    );
}

// ─── Verifica se o token está vivo ──────────────────────────────────
export async function pingToken(accessToken: string): Promise<{ ok: boolean; error?: string }> {
    try { await getMe(accessToken); return { ok: true }; }
    catch (e: any) { return { ok: false, error: e?.message || "Token invalido" }; }
}
