import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEmail,
  IsEnum,
  MinLength,
  MaxLength,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "../../../entities/user.entity";

export class CreateUserDto {
  @ApiProperty({ description: "Kullanıcı adı" })
  @IsString()
  @MaxLength(100)
  username: string;

  @ApiPropertyOptional({ description: "E-posta" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: "Şifre" })
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  password: string;

  @ApiProperty({ description: "Ad Soyad" })
  @IsString()
  @MaxLength(200)
  fullName: string;

  @ApiPropertyOptional({ description: "Rol", enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ description: "Telefon" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ description: "Pozisyon" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ description: "Kullanıcı adı" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @ApiPropertyOptional({ description: "E-posta" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: "Ad Soyad" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  @ApiPropertyOptional({ description: "Rol", enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ description: "Telefon" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ description: "Pozisyon" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @ApiPropertyOptional({ description: "Aktif mi?" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: "Renk" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;
}

export class AdminChangePasswordDto {
  @ApiPropertyOptional({ description: "Mevcut şifre (admin için opsiyonel)" })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiProperty({ description: "Yeni şifre" })
  @IsString()
  @MinLength(12, { message: "Yeni şifre en az 12 karakter olmalı" })
  @MaxLength(128)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#+\-_=])[A-Za-z\d@$!%*?&#+\-_=]{12,}$/,
    {
      message:
        "Şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir",
    },
  )
  newPassword: string;
}
