import {
  IsString,
  IsOptional,
  IsEmail,
  IsArray,
  IsBoolean,
  IsNumber,
  MaxLength,
  MinLength,
  Matches,
  Min,
  Max,
} from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// Telefon numarası regex - Türkiye formatı
const PHONE_REGEX = /^(\+90|0)?[0-9]{10}$/;

// XSS koruması için sanitize
const sanitizeInput = (value: string): string => {
  if (typeof value !== "string") return value;
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .trim();
};

export class CreateCustomerDto {
  @ApiProperty({ description: "Müşteri tam adı", example: "Ahmet Yılmaz" })
  @IsString()
  @MinLength(2, { message: "İsim en az 2 karakter olmalıdır" })
  @MaxLength(100, { message: "İsim en fazla 100 karakter olabilir" })
  @Transform(({ value }) => sanitizeInput(value))
  fullName: string;

  @ApiPropertyOptional({
    description: "Telefon numarası",
    example: "05551234567",
  })
  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, {
    message: "Geçerli bir telefon numarası giriniz (örn: 05551234567)",
  })
  phone?: string;

  @ApiPropertyOptional({
    description: "E-posta adresi",
    example: "ahmet@email.com",
  })
  @IsOptional()
  @IsEmail({}, { message: "Geçerli bir e-posta adresi giriniz" })
  @MaxLength(255, { message: "E-posta en fazla 255 karakter olabilir" })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiPropertyOptional({
    description: "Etiketler",
    example: ["VIP", "Düzenli"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, {
    each: true,
    message: "Her etiket en fazla 50 karakter olabilir",
  })
  tags?: string[];

  @ApiPropertyOptional({ description: "Notlar" })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: "Notlar en fazla 1000 karakter olabilir" })
  @Transform(({ value }) => (value ? sanitizeInput(value) : value))
  notes?: string;
}

export class UpdateCustomerDto {
  @ApiPropertyOptional({ description: "Müşteri tam adı" })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "İsim en az 2 karakter olmalıdır" })
  @MaxLength(100, { message: "İsim en fazla 100 karakter olabilir" })
  @Transform(({ value }) => (value ? sanitizeInput(value) : value))
  fullName?: string;

  @ApiPropertyOptional({ description: "Telefon numarası" })
  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, {
    message: "Geçerli bir telefon numarası giriniz (örn: 05551234567)",
  })
  phone?: string;

  @ApiPropertyOptional({ description: "E-posta adresi" })
  @IsOptional()
  @IsEmail({}, { message: "Geçerli bir e-posta adresi giriniz" })
  @MaxLength(255, { message: "E-posta en fazla 255 karakter olabilir" })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiPropertyOptional({
    description: "VIP puanı (0-100)",
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: "VIP puanı 0'dan küçük olamaz" })
  @Max(100, { message: "VIP puanı 100'den büyük olamaz" })
  vipScore?: number;

  @ApiPropertyOptional({ description: "Etiketler" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, {
    each: true,
    message: "Her etiket en fazla 50 karakter olabilir",
  })
  tags?: string[];

  @ApiPropertyOptional({ description: "Kara listede mi?" })
  @IsOptional()
  @IsBoolean()
  isBlacklisted?: boolean;

  @ApiPropertyOptional({ description: "Notlar" })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: "Notlar en fazla 1000 karakter olabilir" })
  @Transform(({ value }) => (value ? sanitizeInput(value) : value))
  notes?: string;
}
