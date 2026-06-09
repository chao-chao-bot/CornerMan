import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthUser } from "./jwt-auth.guard";

/** 从请求中取出 JwtAuthGuard 注入的当前用户 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return req.user;
  }
);
