import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import { OrgService } from '../org/org.service';
import { HttpError } from '../exceptions/http-error';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AuthUser, SessionOrPending } from '../org/types';

interface AuthRequest extends Request {
  user?: AuthUser;
  session?: SessionOrPending | null;
  token?: string;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
    private readonly org: OrgService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const auth = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (token) {
      const user = await this.supabase.getUserFromToken(token);
      if (user) {
        req.token = token;
        req.user = { id: user.id, email: user.email ?? '' };
        req.session = await this.org.resolveSession(user.id, user.email ?? '');
      }
    }

    if (isPublic) return true;
    if (!req.user) throw new HttpError(401, 'Não autenticado');
    return true;
  }
}
