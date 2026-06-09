import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { UsersModule } from "../users/users.module";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtAuthGuard } from "./jwt-auth.guard";

/**
 * 鉴权模块
 * 邮箱/用户名 + 密码注册登录（bcrypt）、JWT（access 15min + refresh 30d）。
 * 预留三方登录 provider 抽象。
 */
@Module({
  imports: [UsersModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule]
})
export class AuthModule {}
