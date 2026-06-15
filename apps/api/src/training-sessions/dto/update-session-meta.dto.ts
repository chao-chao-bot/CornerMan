import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import { TrainingTypeEnum } from "./create-training-session.dto";

export enum SessionOutcomeResultEnum {
  win = "win",
  loss = "loss",
  draw = "draw",
  unscored = "unscored"
}

export class SessionOutcomeDto {
  @IsEnum(SessionOutcomeResultEnum)
  result!: SessionOutcomeResultEnum;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  opponent?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  rounds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  linkedProblemCodes?: string[];
}

export class UpdateSessionMetaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsEnum(TrainingTypeEnum)
  trainingType?: TrainingTypeEnum;

  @IsOptional()
  @IsISO8601()
  trainedAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMin?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  focus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  userNote?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SessionOutcomeDto)
  outcome?: SessionOutcomeDto;
}
