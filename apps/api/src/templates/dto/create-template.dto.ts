import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";

export enum TemplateSceneEnum {
  private_lesson = "private_lesson",
  sparring = "sparring",
  self_training = "self_training",
  custom = "custom"
}

export class CreateTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsEnum(TemplateSceneEnum)
  scene!: TemplateSceneEnum;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  /** schema 结构在 service 内用 validateTemplateSchema 深度校验 */
  @IsObject()
  schema!: Record<string, unknown>;
}
