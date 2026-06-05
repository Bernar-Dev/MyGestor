import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../org/types';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
