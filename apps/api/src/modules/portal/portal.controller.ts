import { Controller, Get, HttpException, HttpStatus, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentSession } from '../../common/auth/current-session.decorator';
import { OrgService } from '../../common/org/org.service';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { MetaStoreService } from '../../common/meta/meta-store.service';
import { MetaApiService } from '../../common/meta/meta-api.service';
import type { SessionOrPending } from '../../common/org/types';

const InsightsQuery = z.object({
  ad_account_id: z.string().regex(/^act_\d+$/, 'Formato inválido de ad_account_id'),
  date_preset: z
    .enum(['today', 'yesterday', 'last_7d', 'last_30d', 'this_month', 'last_month'])
    .default('last_30d'),
});

@Controller('portal')
export class PortalController {
  constructor(
    private readonly org: OrgService,
    private readonly supabase: SupabaseService,
    private readonly store: MetaStoreService,
    private readonly metaApi: MetaApiService,
  ) {}

  @Get('me')
  async me(@CurrentSession() session: SessionOrPending | null) {
    const sess = this.org.requireClient(session);
    const svc = this.supabase.service();

    const { data: client } = await svc
      .from('clients')
      .select('id, name, company, status, contact_email')
      .eq('id', sess.clientId)
      .single();

    const { data: org } = await svc
      .from('organizations')
      .select('name, logo_url, primary_color')
      .eq('id', sess.orgId)
      .single();

    const { data: accounts } = await svc
      .from('client_ad_accounts')
      .select('ad_account_id, ad_account_name, currency, permissions')
      .eq('client_id', sess.clientId);

    return { client, agency: org, accounts: accounts ?? [] };
  }

  /**
   * GET /api/portal/insights?ad_account_id=act_xxx&date_preset=last_30d
   *
   * Retorna o que o cliente tem permissão de ver:
   *   - sempre: KPIs da conta (spend, impressões, cliques, CTR, CPC, etc.)
   *   - se view_campaigns: lista de campanhas
   *   - se view_creatives: anúncios ativos
   */
  @Get('insights')
  async insights(
    @CurrentSession() session: SessionOrPending | null,
    @Query() rawQuery: Record<string, string>,
  ) {
    const sess = this.org.requireClient(session);

    const parsed = InsightsQuery.safeParse(rawQuery);
    if (!parsed.success) {
      throw new HttpException(
        parsed.error.issues[0]?.message ?? 'Query inválida',
        HttpStatus.BAD_REQUEST,
      );
    }
    const { ad_account_id, date_preset } = parsed.data;

    // Verifica permissão do cliente para esta conta
    const perm = await this.org.clientCanAccessAdAccount(sess.clientId, ad_account_id);
    if (!perm.allowed) {
      throw new HttpException('Sem acesso a essa conta', HttpStatus.FORBIDDEN);
    }

    // Token Meta é da AGÊNCIA do org_id do cliente
    const token = await this.store.loadToken(sess.orgId);
    if (!token) {
      throw new HttpException('Agência não conectou Meta ainda', HttpStatus.PRECONDITION_FAILED);
    }

    try {
      const [insights, campaigns, ads] = await Promise.all([
        perm.permissions?.view_insights !== false
          ? this.metaApi.getAccountInsights({
              accessToken: token.access_token,
              adAccountId: ad_account_id,
              datePreset: date_preset,
            })
          : Promise.resolve(null),
        perm.permissions?.view_campaigns !== false
          ? this.metaApi.getCampaigns(token.access_token, ad_account_id)
          : Promise.resolve([]),
        perm.permissions?.view_creatives !== false
          ? this.metaApi.getActiveAds(token.access_token, ad_account_id, 50)
          : Promise.resolve([]),
      ]);

      return { insights, campaigns, ads, permissions: perm.permissions };
    } catch (e: any) {
      if (e?.fb) {
        throw new HttpException(
          { error: e.message, fb_code: e.fb.code },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw e;
    }
  }
}
