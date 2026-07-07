import {
  Controller, Get, Post, Delete, Body, Param,
  HttpException, HttpStatus,
} from '@nestjs/common';
import { CurrentSession } from '../../common/auth/current-session.decorator';
import { OrgService } from '../../common/org/org.service';
import { MetaStoreService } from '../../common/meta/meta-store.service';
import { MetaApiService } from '../../common/meta/meta-api.service';
import { SupabaseService } from '../../common/supabase/supabase.service';
import type { Session, SessionOrPending } from '../../common/org/types';

/**
 * GET  /api/accounts          — lista todas as contas visíveis pelo token Meta (para picker)
 * GET  /api/accounts/managed  — lista só as contas que a agência escolheu gerenciar
 * POST /api/accounts/managed  — adiciona uma conta à lista gerenciada
 * DELETE /api/accounts/managed/:accountId — remove da lista
 */
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly org: OrgService,
    private readonly store: MetaStoreService,
    private readonly metaApi: MetaApiService,
    private readonly supabase: SupabaseService,
  ) {}

  /** Lista TODAS as contas acessíveis pelo token — para picker de atribuição */
  @Get()
  async listAccounts(@CurrentSession() session: Session) {
    const agency = this.org.requireAgency(session);
    const token = await this.store.loadToken(agency.orgId);
    if (!token) throw new HttpException('Meta não conectado', HttpStatus.PRECONDITION_FAILED);
    try {
      const accounts = await this.metaApi.getAllAdAccounts(token.access_token);
      return { success: true, count: accounts.length, accounts };
    } catch (e: any) {
      if (e?.fb) throw new HttpException({ error: e.message, fb_code: e.fb.code }, HttpStatus.INTERNAL_SERVER_ERROR);
      throw e;
    }
  }

  /** Lista as contas que a agência escolheu gerenciar (ou as do membro, se for member) */
  @Get('managed')
  async listManaged(@CurrentSession() session: SessionOrPending | null) {
    const sess = this.org.requireAgencyOrMember(session);
    const svc = this.supabase.service();

    // Membro: retorna apenas contas vinculadas aos clientes que ele tem acesso
    if (sess.role === 'member') {
      if (sess.clientIds.length === 0) return { success: true, accounts: [] };
      const { data, error } = await svc
        .from('client_ad_accounts')
        .select('id, ad_account_id, ad_account_name, currency')
        .in('client_id', sess.clientIds);
      if (error) return { success: true, accounts: [] };
      // Deduplica por ad_account_id (um mesmo account pode estar em vários clients)
      const seen = new Set<string>();
      const unique = (data ?? []).filter((r: any) => {
        if (seen.has(r.ad_account_id)) return false;
        seen.add(r.ad_account_id);
        return true;
      });
      return {
        success: true,
        accounts: unique.map((r: any) => ({
          id: r.id,
          account_id: r.ad_account_id,
          account_name: r.ad_account_name,
          currency: r.currency,
          added_at: null,
        })),
      };
    }

    // Agência: comportamento original
    const agency = this.org.requireAgency(session);
    const { data, error } = await svc
      .from('org_meta_accounts')
      .select('id, account_id, account_name, currency, added_at')
      .eq('org_id', agency.orgId)
      .order('account_name');
    if (error) {
      if ((error as any).code === '42P01') return { success: true, accounts: [] };
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return { success: true, accounts: data ?? [] };
  }

  /** Adiciona uma conta à lista gerenciada */
  @Post('managed')
  async addManaged(
    @CurrentSession() session: Session,
    @Body() body: { account_id: string; account_name?: string; currency?: string },
  ) {
    const agency = this.org.requireAgency(session);
    if (!body.account_id) throw new HttpException('account_id obrigatório', HttpStatus.BAD_REQUEST);
    const accountId = body.account_id.startsWith('act_') ? body.account_id : `act_${body.account_id}`;
    const svc = this.supabase.service();
    const { data, error } = await svc
      .from('org_meta_accounts')
      .upsert({
        org_id: agency.orgId,
        account_id: accountId,
        account_name: body.account_name ?? null,
        currency: body.currency ?? null,
      }, { onConflict: 'org_id,account_id' })
      .select()
      .single();
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return { success: true, account: data };
  }

  /** Remove uma conta da lista gerenciada */
  @Delete('managed/:accountId')
  async removeManaged(
    @CurrentSession() session: Session,
    @Param('accountId') accountId: string,
  ) {
    const agency = this.org.requireAgency(session);
    const svc = this.supabase.service();
    const { error } = await svc
      .from('org_meta_accounts')
      .delete()
      .eq('org_id', agency.orgId)
      .eq('account_id', accountId);
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return { success: true };
  }
}
