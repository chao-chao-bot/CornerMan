import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

export interface AuthUser {
  userId: string;
}

/** 仅取用到的请求字段，避免依赖 @types/express */
interface RequestLike {
  headers: { authorization?: string };
  user?: AuthUser;
}

/**
 * 自定义 JWT 守卫：校验 Authorization: Bearer <access token>，
 * 通过后把 { userId } 注入 req.user。基于 @nestjs/jwt，不引入 passport。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestLike>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("缺少访问令牌");
    }
    const token = header.slice("Bearer ".length);
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; type?: string }>(
        token,
        { secret: process.env.JWT_ACCESS_SECRET }
      );
      if (payload.type && payload.type !== "access") {
        throw new UnauthorizedException("令牌类型错误");
      }
      req.user = { userId: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException("访问令牌无效或已过期");
    }
  }
}
