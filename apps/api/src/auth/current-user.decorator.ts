import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface JwtPayloadUser {
  userId: string;
  email: string;
}

/** 从 JWT 里取出当前用户，挂在 req.user 上（见 jwt.strategy.ts） */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.user as JwtPayloadUser;
});
