import { Injectable } from "@nestjs/common";
import type { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  /** 按邮箱或用户名查找（登录用） */
  findByIdentifier(identifier: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ email: identifier }, { username: identifier }]
      }
    });
  }

  create(data: {
    email: string;
    username: string;
    passwordHash: string;
    displayName?: string;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }
}
