import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { CurrentSession } from '../../common/auth/current-session.decorator';
import type { AuthUser, SessionOrPending } from '../../common/org/types';

/**
 * Smoke-test da Fase 3. Só carregado se NODE_ENV !== 'production'.
 * Remover (ou manter como ferramenta de debug) quando a Fase 4 estiver completa.
 */
@Controller('whoami')
export class WhoamiController {
  @Get()
  me(
    @CurrentUser() user: AuthUser,
    @CurrentSession() session: SessionOrPending | null,
  ) {
    return { user, session };
  }
}
