import { IsInt, IsString, MaxLength, Min, MinLength } from "class-validator";

export class InitVideoUploadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MinLength(1)
  contentType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
