import { Controller, Get, Post, Body, HttpException } from '@nestjs/common';
import { z } from 'zod';
import { CurrentSession } from '../../common/auth/current-session.decorator';
import { OrgService } from '../../common/org/org.service';
import { MetaStoreService } from '../../common/meta/meta-store.service';
import { MetaApiService } from '../../common/meta/meta-api.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { Session } from '../../common/org/types';

const CredentialsBody = z.object({
  appId: z.string().regex(/^\d{10,20}$/, 'App ID deve ter 10-20 digitos'),
  appSecret: z.string().min(20, 'App Secret invalido'),
  appName: z.string().optional(),
});

const TokenBody = z.object({
  accessToken: z.string().min(10, 'Token inválido'),
});

type CredentialsBodyType = z.infer<typeof CredentialsBody>;
type TokenBodyType = z.infer<typeof TokenBody>;

/**
 * GET  /api/meta/credentials — retorna app_id e redirect_uri (sem secret)
 * POST /api/meta/credentials — salva/atualiza App ID + Secret cifrado
 * GET  /api/meta/status      — status da conexão (token válido?)
 * POST /api/meta/disconnect  — deleta token (mantém credenciais)
 */
@Controller('meta')
export class MetaController {
  constructor(
    private readonly org: OrgService,
    private readonly store: MetaStoreService,
    private readonly metaApi: MetaApiService,
  ) {}

  @Get('credentials')
  async getCredentials(@CurrentSession() session: Session) {
    const agency = this.org.requireAgency(session);
    const creds = await this.store.loadCredentials(agency.orgId);
    if (!creds) return { configured: false };
    return {
      configured: true,
      appId: creds.app_id,
      appName: creds.app_name,
      redirectUri: creds.redirect_uri,
    };
  }

  @Post('credentials')
  async saveCredentials(
    @CurrentSession() session: Session,
    @Body(new ZodValidationPipe(CredentialsBody)) body: CredentialsBodyType,
  ) {
    const agency = this.org.requireAgency(session);
    const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${origin.replace(/\/$/, '')}/api/meta/callback`;
    await this.store.saveCredentials(agency.orgId, { ...body, redirectUri });
    return { ok: true, redirectUri };
  }

  @Get('status')
  async getStatus(@CurrentSession() session: Session) {
    const agency = this.org.requireAgency(session);

    // Consulta em paralelo — token é verificado independente de ter credentials
    const [creds, token] = await Promise.all([
      this.store.loadCredentials(agency.orgId),
      this.store.loadToken(agency.orgId),
    ]);

    if (!token) {
      return {
        stage: creds ? ('no_token' as const) : ('no_credentials' as const),
        hasCredentials: !!creds,
        appId: creds?.app_id ?? null,
        appName: creds?.app_name ?? null,
      };
    }

    const ping = await this.metaApi.pingToken(token.access_token);

    return {
      stage: ping.ok ? ('connected' as const) : ('token_invalid' as const),
      hasCredentials: !!creds,
      appId: creds?.app_id ?? null,
      appName: creds?.app_name ?? null,
      fbUserName: token.fb_user_name,
      fbUserId: token.fb_user_id,
      expiresAt: token.expires_at,
      refreshedAt: token.refreshed_at,
      scopes: token.scopes,
      error: ping.ok ? null : ping.error,
    };
  }

  @Post('disconnect')
  async disconnect(@CurrentSession() session: Session) {
    const agency = this.org.requireAgency(session);
    await this.store.deleteToken(agency.orgId);
    return { ok: true };
  }

  /** GET /api/meta/access-token — devolve token decriptado (agência ou cliente do portal) */
  @Get('access-token')
  async getAccessToken(@CurrentSession() session: Session) {
    // Aceita tanto gestor quanto convidado — ambos têm orgId resolvido
    if (!('orgId' in session)) {
      throw new HttpException('Sessão sem organização vinculada', 403);
    }
    const orgId = (session as { orgId: string }).orgId;
    const token = await this.store.loadToken(orgId);
    if (!token) throw new HttpException('Token Meta não configurado. Conclua o onboarding.', 404);

    // Auto-refresh apenas para gestores (clientes não têm permissão de renovar)
    if (session.role === 'agency' && token.expires_at) {
      const daysLeft = (new Date(token.expires_at).getTime() - Date.now()) / 86_400_000;
      if (daysLeft < 7) {
        try {
          await this._doRefresh(orgId, token.access_token);
          const refreshed = await this.store.loadToken(orgId);
          return { accessToken: refreshed!.access_token, refreshed: true };
        } catch { /* retorna token atual */ }
      }
    }

    return { accessToken: token.access_token };
  }

  /** POST /api/meta/refresh — renova o token long-lived por mais 60 dias */
  @Post('refresh')
  async refreshToken(@CurrentSession() session: Session) {
    const agency = this.org.requireAgency(session);
    const token = await this.store.loadToken(agency.orgId);
    if (!token) throw new HttpException('Token Meta não configurado', 404);
    try {
      const expiresAt = await this._doRefresh(agency.orgId, token.access_token);
      return { ok: true, expiresAt };
    } catch (e: any) {
      throw new HttpException(e?.message || 'Falha ao renovar token', 400);
    }
  }

  private async _doRefresh(orgId: string, currentToken: string): Promise<string | null> {
    const [creds, existing] = await Promise.all([
      this.store.loadCredentials(orgId),
      this.store.loadToken(orgId),
    ]);
    if (!creds) throw new Error('Credenciais Meta não configuradas');
    const result = await this.metaApi.exchangeForLongLivedToken({
      appId: creds.app_id,
      appSecret: creds.app_secret,
      shortLivedToken: currentToken,
    });
    await this.store.saveToken(orgId, {
      accessToken: result.access_token,
      expiresInSeconds: result.expires_in,
      fbUserId: existing?.fb_user_id ?? undefined,
      fbUserName: existing?.fb_user_name ?? undefined,
      scopes: existing?.scopes ?? undefined,
    });
    const token = await this.store.loadToken(orgId);
    return token?.expires_at ?? null;
  }

  /** POST /api/meta/token — salva token manualmente (sem OAuth) */
  @Post('token')
  async saveManualToken(
    @CurrentSession() session: Session,
    @Body(new ZodValidationPipe(TokenBody)) body: TokenBodyType,
  ) {
    const agency = this.org.requireAgency(session);
    const ping = await this.metaApi.pingToken(body.accessToken);
    if (!ping.ok) throw new HttpException(`Token inválido: ${ping.error}`, 400);
    let me: { id: string; name: string } | undefined;
    try { me = await this.metaApi.getMe(body.accessToken); } catch { /* ignora */ }
    await this.store.saveToken(agency.orgId, {
      accessToken: body.accessToken,
      fbUserId: me?.id,
      fbUserName: me?.name,
    });
    return { ok: true, fbUserName: me?.name };
  }
}
