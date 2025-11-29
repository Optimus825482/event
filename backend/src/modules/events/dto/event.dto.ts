import { IsString, IsOptional, IsDateString, IsEnum, IsObject, IsNumber } from 'class-validator';
import { EventStatus } from '../../../entities/event.entity';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  eventDate: string;

  @IsOptional()
  @IsDateString()
  eventEndDate?: string;

  @IsOptional()
  @IsString()
  venueTemplateId?: string;

  @IsOptional()
  @IsObject()
  venueLayout?: any;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @IsOptional()
  @IsDateString()
  eventEndDate?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsObject()
  venueLayout?: any;

  @IsOptional()
  @IsNumber()
  totalCapacity?: number;
}

export class UpdateLayoutDto {
  @IsObject()
  venueLayout: any;
}
