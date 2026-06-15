import { IsObject } from "class-validator";

export class UpdateContentDto {
  /** 按 block id 存储的复盘内容；结构由 service 落库为 Json */
  @IsObject()
  content!: Record<string, unknown>;
}
