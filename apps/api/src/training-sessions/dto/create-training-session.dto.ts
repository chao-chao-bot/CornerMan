import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

export enum TrainingTypeEnum {
  private_lesson = "private_lesson",
  self_training = "self_training",
  sparring = "sparring"
}

export class CreateTrainingSessionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsEnum(TrainingTypeEnum)
  trainingType!: TrainingTypeEnum;

  @IsISO8601()
  trainedAt!: string;

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
}
