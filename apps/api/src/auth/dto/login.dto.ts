import { IsString, MinLength } from "class-validator";

export class LoginDto {
  /** 邮箱或用户名 */
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
