import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import type { TemplateDTO } from "@cornerman/shared-types";
import { JwtAuthGuard, type AuthUser } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { TemplatesService } from "./templates.service";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { UpdateTemplateDto } from "./dto/update-template.dto";

@UseGuards(JwtAuthGuard)
@Controller("templates")
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<TemplateDTO[]> {
    return this.templates.findAllForUser(user.userId);
  }

  @Get(":id")
  detail(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string
  ): Promise<TemplateDTO> {
    return this.templates.findOne(user.userId, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTemplateDto
  ): Promise<TemplateDTO> {
    return this.templates.create(user.userId, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateTemplateDto
  ): Promise<TemplateDTO> {
    return this.templates.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string
  ): Promise<{ id: string }> {
    return this.templates.remove(user.userId, id);
  }

  @Post(":id/duplicate")
  duplicate(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string
  ): Promise<TemplateDTO> {
    return this.templates.duplicate(user.userId, id);
  }
}
