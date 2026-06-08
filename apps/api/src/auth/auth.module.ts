import { Module } from "@nestjs/common";

/**
 * 鉴权模块（占位）
 * 邮箱/用户名 + 密码注册登录（bcrypt）、JWT（access 15min + refresh 30d）。
 * 预留三方登录 provider 抽象。
 */
@Module({})
export class AuthModule {}
