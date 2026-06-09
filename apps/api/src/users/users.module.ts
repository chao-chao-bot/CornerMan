import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";

/**
 * 用户模块
 * 训练者档案与查找；当前供 auth 复用。
 */
@Module({
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}
