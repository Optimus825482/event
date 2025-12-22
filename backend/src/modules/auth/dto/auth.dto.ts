import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
} from "class-validator";
import { UserRole } from "../../../entities/user.entity";

export class RegisterDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
