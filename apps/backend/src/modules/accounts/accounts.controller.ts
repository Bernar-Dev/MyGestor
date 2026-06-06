import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { CurrentSession } from '../../common/auth/current-session.decorator';
import { OrgService } from '../../common/org/org.service';
import { MetaStoreService } from '../../common/meta/meta-store.service';
import { MetaApiService } from '../../common/meta/meta-api.service';
import type { Session } from '../../common/org/types';

/**
 * GET /api/accounts
 * Lista TODAS as ad accounts visíveis pelo token Meta da agência.
 * Usada na UI de gestão de clientes para atribuir contas.
 */
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly org: OrgService,
    private readonly store: MetaStoreService,
    private readonly metaApi: MetaApiService,
  ) {}

  @Get()
  async listAccounts(@CurrentSession() session: Session) {
    const agency = this.org.requireAgency(session);

    const token = await this.store.loadToken(agency.orgId);
    if (!token) {
      throw new HttpException('Meta não conectado', HttpStatus.PRECONDITION_FAILED);
    }

    try {
      const accounts = await this.metaApi.getAllAdAccounts(token.access_token);
      return { success: true, count: accounts.length, accounts };
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
