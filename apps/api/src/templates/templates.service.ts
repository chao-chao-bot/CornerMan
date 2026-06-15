import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, type Template } from "@prisma/client";
import type {
  TemplateDTO,
  TemplateScene,
  TemplateSchema
} from "@cornerman/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { UpdateTemplateDto } from "./dto/update-template.dto";
import { validateTemplateSchema } from "./template-schema.util";

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** 系统模板 + 当前用户的自定义模板 */
  async findAllForUser(userId: string): Promise<TemplateDTO[]> {
    const templates = await this.prisma.template.findMany({
      where: {
        deletedAt: null,
        OR: [{ isSystem: true }, { userId }]
      },
      orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }]
    });
    return templates.map((t) => this.toDTO(t));
  }

  async findOne(userId: string, id: string): Promise<TemplateDTO> {
    return this.toDTO(await this.getVisibleOrThrow(userId, id));
  }

  async create(userId: string, dto: CreateTemplateDto): Promise<TemplateDTO> {
    const schema = validateTemplateSchema(dto.schema);
    const template = await this.prisma.template.create({
      data: {
        userId,
        name: dto.name,
        scene: dto.scene,
        description: dto.description,
        schema: schema as unknown as Prisma.InputJsonValue,
        isSystem: false,
        version: schema.version
      }
    });
    return this.toDTO(template);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTemplateDto
  ): Promise<TemplateDTO> {
    await this.getOwnedCustomOrThrow(userId, id);
    const schema = dto.schema ? validateTemplateSchema(dto.schema) : undefined;
    const template = await this.prisma.template.update({
      where: { id },
      data: {
        name: dto.name,
        scene: dto.scene,
        description: dto.description,
        ...(schema
          ? {
              schema: schema as unknown as Prisma.InputJsonValue,
              version: schema.version
            }
          : {})
      }
    });
    return this.toDTO(template);
  }

  async remove(userId: string, id: string): Promise<{ id: string }> {
    await this.getOwnedCustomOrThrow(userId, id);
    await this.prisma.template.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    return { id };
  }

  /** 从系统模板或已有模板复制为当前用户的自定义模板 */
  async duplicate(userId: string, id: string): Promise<TemplateDTO> {
    const source = await this.getVisibleOrThrow(userId, id);
    const schema = validateTemplateSchema(source.schema);
    const template = await this.prisma.template.create({
      data: {
        userId,
        name: `${source.name} 副本`,
        scene: source.scene,
        description: source.description,
        schema: schema as unknown as Prisma.InputJsonValue,
        isSystem: false,
        version: schema.version
      }
    });
    return this.toDTO(template);
  }

  /** 供其它模块（创建 Session 时写快照）复用：取可见模板 */
  async getVisibleOrThrow(userId: string, id: string): Promise<Template> {
    const template = await this.prisma.template.findFirst({
      where: { id, deletedAt: null }
    });
    if (!template || (!template.isSystem && template.userId !== userId)) {
      throw new NotFoundException("模板不存在");
    }
    return template;
  }

  private async getOwnedCustomOrThrow(
    userId: string,
    id: string
  ): Promise<Template> {
    const template = await this.prisma.template.findFirst({
      where: { id, deletedAt: null }
    });
    if (!template) {
      throw new NotFoundException("模板不存在");
    }
    if (template.isSystem) {
      throw new ForbiddenException("系统模板不可修改");
    }
    if (template.userId !== userId) {
      throw new ForbiddenException("无权操作他人模板");
    }
    return template;
  }

  private toDTO(template: Template): TemplateDTO {
    return {
      id: template.id,
      userId: template.userId ?? undefined,
      name: template.name,
      scene: template.scene as TemplateScene,
      description: template.description ?? undefined,
      schema: template.schema as unknown as TemplateSchema,
      isSystem: template.isSystem,
      version: template.version,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString()
    };
  }
}
