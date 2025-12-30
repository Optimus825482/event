import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "../../../entities/user.entity";

export class RegisterDto {
  @ApiProperty({ description: "Kullanıcı adı", minLength: 3, maxLength: 30 })
  @IsString()
  @MinLength(3, { message: "Kullanıcı adı en az 3 karakter olmalı" })
  @MaxLength(30, { message: "Kullanıcı adı en fazla 30 karakter olabilir" })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: "Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir",
  })
  username: string;

  @ApiPropertyOptional({ description: "Email adresi" })
  @IsOptional()
  @IsEmail({}, { message: "Geçerli bir email adresi giriniz" })
  email?: string;

  @ApiProperty({
    description:
      "Şifre - En az 12 karakter, büyük/küçük harf, rakam ve özel karakter içermeli",
    minLength: 12,
  })
  @IsString()
  @MinLength(12, { message: "Şifre en az 12 karakter olmalı" })
  @MaxLength(128, { message: "Şifre en fazla 128 karakter olabilir" })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#+\-_=])[A-Za-z\d@$!%*?&#+\-_=]{12,}$/,
    {
      message:
        "Şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter (@$!%*?&#+\\-_=) içermelidir",
    }
  )
  password: string;

  @ApiProperty({ description: "Tam ad" })
  @IsString()
  @MinLength(2, { message: "Ad en az 2 karakter olmalı" })
  @MaxLength(100, { message: "Ad en fazla 100 karakter olabilir" })
  fullName: string;

  @ApiPropertyOptional({ description: "Telefon numarası" })
  @IsOptional()
  @IsString()
  @Matches(/^(\+90|0)?[0-9]{10}$/, {
    message: "Geçerli bir telefon numarası giriniz (örn: 05551234567)",
  })
  phone?: string;
}

export class LoginDto {
  @ApiProperty({ description: "Kullanıcı adı" })
  @IsString()
  @MinLength(1, { message: "Kullanıcı adı gerekli" })
  username: string;

  @ApiProperty({ description: "Şifre" })
  @IsString()
  @MinLength(1, { message: "Şifre gerekli" })
  password: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ description: "Tam ad" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ description: "Telefon numarası" })
  @IsOptional()
  @IsString()
  @Matches(/^(\+90|0)?[0-9]{10}$/, {
    message: "Geçerli bir telefon numarası giriniz",
  })
  phone?: string;

  @ApiPropertyOptional({ description: "Kullanıcı rolü", enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class ChangePasswordDto {
  @ApiProperty({ description: "Mevcut şifre" })
  @IsString()
  @MinLength(1, { message: "Mevcut şifre gerekli" })
  currentPassword: string;

  @ApiProperty({
    description:
      "Yeni şifre - En az 12 karakter, büyük/küçük harf, rakam ve özel karakter içermeli",
  })
  @IsString()
  @MinLength(12, { message: "Yeni şifre en az 12 karakter olmalı" })
  @MaxLength(128)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#+\-_=])[A-Za-z\d@$!%*?&#+\-_=]{12,}$/,
    {
      message:
        "Şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir",
    }
  )
  newPassword: string;
}
