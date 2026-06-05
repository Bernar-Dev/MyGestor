import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SessionOrPending } from '../org/types';

export const CurrentSession = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): SessionOrPending | null | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.session;
  },
);
