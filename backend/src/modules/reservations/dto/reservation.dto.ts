import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ReservationStatus } from '../../../entities/reservation.entity';

export class CreateReservationDto {
  @IsString()
  eventId: string;

  @IsString()
  tableId: string;

  @IsString()
  customerId: string;

  @IsNumber()
  guestCount: number;

  @IsOptional()
  @IsString()
  specialRequests?: string;

  @IsOptional()
  @IsNumber()
  totalAmount?: number;
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
