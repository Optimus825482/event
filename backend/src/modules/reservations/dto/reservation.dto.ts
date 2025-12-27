import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  Matches,
  IsEmail,
  IsUUID,
} from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ReservationStatus } from "../../../entities/reservation.entity";

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

/**
 * Rezervasyon filtreleme DTO'su
 * Requirements: 7.1, 7.2, 7.3, 7.4 - Arama ve filtreleme
 */
export class ReservationFiltersDto {
  @ApiPropertyOptional({ description: "Etkinlik ID" })
  @IsOptional()
  @IsString()
  @IsUUID("4", { message: "Geçerli bir etkinlik ID giriniz" })
  eventId?: string;

  @ApiPropertyOptional({ description: "Müşteri ID" })
  @IsOptional()
  @IsString()
  @IsUUID("4", { message: "Geçerli bir müşteri ID giriniz" })
  customerId?: string;

  @ApiPropertyOptional({
    description: "Rezervasyon durumu",
    enum: ReservationStatus,
  })
  @IsOptional()
  @IsEnum(ReservationStatus, { message: "Geçerli bir durum seçiniz" })
  status?: ReservationStatus;

  @ApiPropertyOptional({ description: "Arama terimi (isim veya telefon)" })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Arama terimi en fazla 100 karakter olabilir" })
  @Transform(({ value }) => (value ? sanitizeInput(value) : value))
  searchQuery?: string;

  @ApiPropertyOptional({ description: "Masa ID" })
  @IsOptional()
  @IsString()
  tableId?: string;
}

export class CreateReservationDto {
  @ApiProperty({ description: "Etkinlik ID" })
  @IsString()
  @IsUUID("4", { message: "Geçerli bir etkinlik ID giriniz" })
  eventId: string;

  @ApiProperty({ description: "Masa ID" })
  @IsString()
  tableId: string;

  @ApiPropertyOptional({ description: "Müşteri ID" })
  @IsOptional()
  @IsString()
  @IsUUID("4", { message: "Geçerli bir müşteri ID giriniz" })
  customerId?: string;

  @ApiProperty({ description: "Misafir sayısı", minimum: 1, maximum: 50 })
  @IsNumber()
  @Min(1, { message: "Misafir sayısı en az 1 olmalıdır" })
  @Max(50, { message: "Misafir sayısı en fazla 50 olabilir" })
  guestCount: number;

  @ApiPropertyOptional({ description: "Özel istekler" })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Özel istekler en fazla 500 karakter olabilir" })
  @Transform(({ value }) => (value ? sanitizeInput(value) : value))
  specialRequests?: string;

  @ApiPropertyOptional({ description: "Toplam tutar", minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: "Tutar 0'dan küçük olamaz" })
  totalAmount?: number;

  // Müşteri kaydı olmadan direkt misafir bilgileri
  @ApiPropertyOptional({ description: "Misafir adı" })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Misafir adı en fazla 100 karakter olabilir" })
  @Transform(({ value }) => (value ? sanitizeInput(value) : value))
  guestName?: string;

  @ApiPropertyOptional({ description: "Misafir telefonu" })
  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, {
    message: "Geçerli bir telefon numarası giriniz (örn: 05551234567)",
  })
  guestPhone?: string;

  @ApiPropertyOptional({ description: "Misafir e-postası" })
  @IsOptional()
  @IsEmail({}, { message: "Geçerli bir e-posta adresi giriniz" })
  @MaxLength(255, { message: "E-posta en fazla 255 karakter olabilir" })
  @Transform(({ value }) => value?.toLowerCase().trim())
  guestEmail?: string;
}

export class UpdateReservationDto {
  @ApiPropertyOptional({ description: "Masa ID" })
  @IsOptional()
  @IsString()
  tableId?: string;

  @ApiPropertyOptional({
    description: "Misafir sayısı",
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: "Misafir sayısı en az 1 olmalıdır" })
  @Max(50, { message: "Misafir sayısı en fazla 50 olabilir" })
  guestCount?: number;

  @ApiPropertyOptional({
    description: "Rezervasyon durumu",
    enum: ReservationStatus,
  })
  @IsOptional()
  @IsEnum(ReservationStatus, { message: "Geçerli bir durum seçiniz" })
  status?: ReservationStatus;

  @ApiPropertyOptional({ description: "Özel istekler" })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Özel istekler en fazla 500 karakter olabilir" })
  @Transform(({ value }) => (value ? sanitizeInput(value) : value))
  specialRequests?: string;

  @ApiPropertyOptional({ description: "Toplam tutar", minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: "Tutar 0'dan küçük olamaz" })
  totalAmount?: number;

  @ApiPropertyOptional({ description: "Ödeme yapıldı mı?" })
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
}
