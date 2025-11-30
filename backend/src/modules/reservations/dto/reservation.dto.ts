import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
} from "class-validator";
import { ReservationStatus } from "../../../entities/reservation.entity";

/**
 * Rezervasyon filtreleme DTO'su
 * Requirements: 7.1, 7.2, 7.3, 7.4 - Arama ve filtreleme
 */
export class ReservationFiltersDto {
  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @IsOptional()
  @IsString()
  searchQuery?: string; // İsim veya telefon ile arama

  @IsOptional()
  @IsString()
  tableId?: string;
}

export class CreateReservationDto {
  @IsString()
  eventId: string;

  @IsString()
  tableId: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsNumber()
  guestCount: number;

  @IsOptional()
  @IsString()
  specialRequests?: string;

  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  // Müşteri kaydı olmadan direkt misafir bilgileri
  @IsOptional()
  @IsString()
  guestName?: string;

  @IsOptional()
  @IsString()
  guestPhone?: string;

  @IsOptional()
  @IsString()
  guestEmail?: string;
}

export class UpdateReservationDto {
  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsNumber()
  guestCount?: number;

  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @IsOptional()
  @IsString()
  specialRequests?: string;

  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
}
