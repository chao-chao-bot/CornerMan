import { IsNumber, Max, Min } from "class-validator";

export class UpdateScoreDto {
  @IsNumber()
  @Min(0)
  @Max(10)
  userScore!: number;
}
