import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { RevisionAction, ScoreDimension } from "@cornerman/shared-types";

const ACTIONS: RevisionAction[] = ["accept", "edit", "delete", "add"];
const DIMENSIONS: ScoreDimension[] = [
  "stance",
  "guard",
  "footwork",
  "punch_technique",
  "defense",
  "combination",
  "overall"
];

export class CreateRevisionDto {
  @IsString()
  @MinLength(1)
  itemKey!: string;

  @IsIn(ACTIONS)
  action!: RevisionAction;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  detail?: string;

  @IsOptional()
  @IsIn(DIMENSIONS)
  dimension?: ScoreDimension;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  problemCode?: string;

  @IsOptional()
  @IsString()
  segmentId?: string;
}
