import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import type {
  SessionListItemDTO,
  TrainingSessionDTO
} from "@cornerman/shared-types";
import { JwtAuthGuard, type AuthUser } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { TrainingSessionsService } from "./training-sessions.service";
import { CreateTrainingSessionDto } from "./dto/create-training-session.dto";

@UseGuards(JwtAuthGuard)
@Controller("training-sessions")
export class TrainingSessionsController {
  constructor(private readonly sessions: TrainingSessionsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTrainingSessionDto
  ): Promise<TrainingSessionDTO> {
    return this.sessions.create(user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<SessionListItemDTO[]> {
    return this.sessions.findAllByUser(user.userId);
  }

  @Get(":id")
  detail(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string
  ): Promise<TrainingSessionDTO> {
    return this.sessions.findOne(user.userId, id);
  }

  @Delete(":id")
  remove(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string
  ): Promise<{ id: string }> {
    return this.sessions.remove(user.userId, id);
  }
}
