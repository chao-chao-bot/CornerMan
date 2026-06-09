import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import type { User } from "@prisma/client";
import type {
  AuthResponse,
  AuthTokens,
  PublicUser
} from "@cornerman/shared-types";
import { UsersService } from "../users/users.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.users.findByIdentifier(dto.email);
    const existingByName = await this.users.findByIdentifier(dto.username);
    if (existing || existingByName) {
      throw new ConflictException("邮箱或用户名已被使用");
    }
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.users.create({
      email: dto.email,
      username: dto.username,
      passwordHash,
      displayName: dto.displayName
    });
    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findByIdentifier(dto.identifier);
    if (!user) {
      throw new UnauthorizedException("账号或密码错误");
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("账号或密码错误");
    }
    return this.buildAuthResponse(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    let payload: { sub: string; type?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET
      });
    } catch {
      throw new UnauthorizedException("刷新令牌无效或已过期");
    }
    if (payload.type !== "refresh") {
      throw new UnauthorizedException("令牌类型错误");
    }
    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException("用户不存在");
    }
    return this.buildAuthResponse(user);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException("用户不存在");
    }
    return this.toPublicUser(user);
  }

  private async buildAuthResponse(user: User): Promise<AuthResponse> {
    const tokens = await this.signTokens(user.id);
    return { user: this.toPublicUser(user), tokens };
  }

  private async signTokens(userId: string): Promise<AuthTokens> {
    const accessTtl = process.env.JWT_ACCESS_TTL ?? "15m";
    const refreshTtl = process.env.JWT_REFRESH_TTL ?? "30d";
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: userId, type: "access" },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: accessTtl }
      ),
      this.jwt.signAsync(
        { sub: userId, type: "refresh" },
        { secret: process.env.JWT_REFRESH_SECRET, expiresIn: refreshTtl }
      )
    ]);
    return { accessToken, refreshToken, expiresIn: this.ttlToSeconds(accessTtl) };
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName ?? undefined,
      createdAt: user.createdAt.toISOString()
    };
  }

  /** 把 "15m"/"30d"/"3600" 这类 TTL 粗略转换为秒，供前端参考 */
  private ttlToSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])?$/.exec(ttl.trim());
    if (!match) return 900;
    const value = Number(match[1]);
    const unit = match[2];
    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 3600;
      case "d":
        return value * 86400;
      default:
        return value;
    }
  }
}
