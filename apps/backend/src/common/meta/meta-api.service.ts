/**
 * Wrapper da Meta Graph API com retry/backoff em erros transitórios.
 */
import { Injectable } from '@nestjs/common';

export const FB_API_VERSION = 'v22.0';
const FB_GRAPH_URL = `https://graph.facebook.com/${FB_API_VERSION}`;

const TRANSIENT_FB_CODES = new Set([1, 2, 4, 17, 32, 341, 613]);
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 800;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

export interface ExchangeTokenResult {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface AccountInsights {
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  cpm: string;
  reach?: string;
  frequency?: string;
  date_start: string;
  date_stop: string;
  actions?: { action_type: string; value: string }[];
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

export interface AdCreative {
  id: string;
  name: string;
  status: string;
  creative?: { id: string; thumbnail_url?: string; image_url?: string; title?: string; body?: string };
}

@Injectable()
export class MetaApiService {
  private async fbFetch<T = any>(url: string): Promise<T> {
    let lastErr: any;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let res: Response | undefined;
      try {
        res = await fetch(url, { cache: 'no-store' } as any);
      } catch (netErr: any) {
        lastErr = netErr;
        if (attempt < MAX_RETRIES) {
          await sleep(BASE_DELAY_MS * 2 ** attempt + Math.random() * 250);
          continue;
        }
        throw netErr;
      }

      if (res.status >= 500 || res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after')) || 0;
        lastErr = new Error(`Meta HTTP ${res.status}${res.status === 429 ? ' (rate limit)' : ''}`);
        if (attempt < MAX_RETRIES) {
          await sleep(retryAfter > 0 ? retryAfter * 1000 : BASE_DELAY_MS * 2 ** attempt + Math.random() * 250);
          continue;
        }
        throw lastErr;
      }

      let json: any;
      try {
        json = await res.json();
      } catch {
        lastErr = new Error(`Meta retornou resposta invalida (HTTP ${res.status})`);
        if (attempt < MAX_RETRIES) {
          await sleep(BASE_DELAY_MS * 2 ** attempt + Math.random() * 250);
          continue;
        }
        throw lastErr;
      }

      if (json.error) {
        const code = Number(json.error.code);
        const isTransient = TRANSIENT_FB_CODES.has(code);
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
    throw lastErr || new Error('Meta API: falha apos retries');
  }

  private async fbPaginate<T = any>(initialUrl: string): Promise<T[]> {
    const all: T[] = [];
    let url: string | null = initialUrl;
    let safety = 50;
    while (url && safety-- > 0) {
      const data: any = await this.fbFetch<any>(url);
      if (Array.isArray(data?.data)) all.push(...data.data);
      url = data?.paging?.next || null;
    }
    return all;
  }

  async getMe(accessToken: string): Promise<{ id: string; name: string; email?: string }> {
    return this.fbFetch(
      `${FB_GRAPH_URL}/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`,
    );
  }

  async getAllAdAccounts(accessToken: string): Promise<MetaAccount[]> {
    const fields = 'name,account_id,currency,account_status,amount_spent,business_name,timezone_name';
    return this.fbPaginate<MetaAccount>(
      `${FB_GRAPH_URL}/me/adaccounts?fields=${fields}&limit=100&access_token=${encodeURIComponent(accessToken)}`,
    );
  }

  async pingToken(accessToken: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.getMe(accessToken);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Token invalido' };
    }
  }

  async exchangeCodeForToken(opts: {
    appId: string;
    appSecret: string;
    code: string;
    redirectUri: string;
  }): Promise<{ access_token: string; token_type: string; expires_in?: number }> {
    const url =
      `${FB_GRAPH_URL}/oauth/access_token` +
      `?client_id=${encodeURIComponent(opts.appId)}` +
      `&client_secret=${encodeURIComponent(opts.appSecret)}` +
      `&redirect_uri=${encodeURIComponent(opts.redirectUri)}` +
      `&code=${encodeURIComponent(opts.code)}`;
    return this.fbFetch(url);
  }

  async exchangeForLongLivedToken(opts: {
    appId: string;
    appSecret: string;
    shortLivedToken: string;
  }): Promise<ExchangeTokenResult> {
    const url =
      `${FB_GRAPH_URL}/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(opts.appId)}` +
      `&client_secret=${encodeURIComponent(opts.appSecret)}` +
      `&fb_exchange_token=${encodeURIComponent(opts.shortLivedToken)}`;
    return this.fbFetch<ExchangeTokenResult>(url);
  }

  async getAccountInsights(opts: {
    accessToken: string;
    adAccountId: string;
    datePreset?: 'today' | 'yesterday' | 'last_7d' | 'last_30d' | 'this_month' | 'last_month';
  }): Promise<AccountInsights | null> {
    const preset = opts.datePreset || 'last_30d';
    const fields = 'spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions';
    const url =
      `${FB_GRAPH_URL}/${opts.adAccountId}/insights` +
      `?fields=${fields}&date_preset=${preset}&access_token=${encodeURIComponent(opts.accessToken)}`;
    const res: any = await this.fbFetch(url);
    return res?.data?.[0] || null;
  }

  async getCampaigns(accessToken: string, adAccountId: string): Promise<Campaign[]> {
    const fields = 'name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time';
    return this.fbPaginate<Campaign>(
      `${FB_GRAPH_URL}/${adAccountId}/campaigns?fields=${fields}&limit=100&access_token=${encodeURIComponent(accessToken)}`,
    );
  }

  async getActiveAds(accessToken: string, adAccountId: string, limit = 50): Promise<AdCreative[]> {
    const fields = 'name,status,creative{id,thumbnail_url,image_url,title,body}';
    const url =
      `${FB_GRAPH_URL}/${adAccountId}/ads` +
      `?fields=${fields}&effective_status=['ACTIVE']&limit=${limit}&access_token=${encodeURIComponent(accessToken)}`;
    const res: any = await this.fbFetch(url);
    return res?.data || [];
  }
}
