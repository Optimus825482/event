import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsObject,
  IsNumber,
  IsArray,
  ValidateNested,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  MaxLength,
  IsBoolean,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { EventStatus } from "../../../entities/event.entity";

// HTML/Script tag'lerini temizleyen transformer (XSS koruması)
const sanitizeInput = (value: string): string => {
  if (typeof value !== "string") return value;
  // HTML tag'lerini ve script içeriklerini temizle
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
};

// Geçmiş tarih kontrolü için custom validator
function IsFutureDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isFutureDate",
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (!value) return true; // Optional alanlar için
          const inputDate = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return inputDate >= today;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} geçmiş bir tarih olamaz`;
        },
      },
    });
  };
}

// Venue Layout için tip tanımları - YENİ FORMAT
export class PlacedTableDto {
  @IsString()
  id: string;

  @IsNumber()
  tableNumber: number;

  @IsString()
  type: string;

  @IsNumber()
  capacity: number;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsBoolean()
  isLoca: boolean;

  @IsOptional()
  @IsString()
  locaName?: string;

  @IsBoolean()
  isLocked: boolean;
}

export class StageElementDto {
  @IsString()
  id: string;

  @IsString()
  type: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;

  @IsString()
  label: string;

  @IsBoolean()
  isLocked: boolean;
}

export class DrawnLineDto {
  @IsString()
  id: string;

  @IsArray()
  points: any[];

  @IsString()
  color: string;

  @IsNumber()
  width: number;
}

export class TablePlanDto {
  @IsString()
  id: string;

  @IsString()
  type: string;

  @IsNumber()
  capacity: number;

  @IsNumber()
  count: number;
}

export class DimensionsDto {
  @IsNumber()
  width: number;

  @IsNumber()
  height: number;
}

// Yeni VenueLayout formatı
export class VenueLayoutDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TablePlanDto)
  tablePlans?: TablePlanDto[];

  @IsOptional()
  @IsString()
  stageConfig?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlacedTableDto)
  placedTables?: PlacedTableDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageElementDto)
  stageElements?: StageElementDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DrawnLineDto)
  drawnLines?: DrawnLineDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => DimensionsDto)
  dimensions?: DimensionsDto;
}

export class CreateEventDto {
  @IsString()
  @MaxLength(200, { message: "Etkinlik adı en fazla 200 karakter olabilir" })
  @Transform(({ value }) => sanitizeInput(value))
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "Açıklama en fazla 2000 karakter olabilir" })
  @Transform(({ value }) => (value ? sanitizeInput(value) : value))
  description?: string;

  @IsDateString()
  @IsFutureDate({ message: "Etkinlik tarihi geçmiş bir tarih olamaz" })
  eventDate: string;

  @IsOptional()
  @IsDateString()
  eventEndDate?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  venueTemplateId?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => VenueLayoutDto)
  venueLayout?: VenueLayoutDto;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsNumber()
  totalCapacity?: number;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: "Etkinlik adı en fazla 200 karakter olabilir" })
  @Transform(({ value }) => (value ? sanitizeInput(value) : value))
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "Açıklama en fazla 2000 karakter olabilir" })
  @Transform(({ value }) => (value ? sanitizeInput(value) : value))
  description?: string;

  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @IsOptional()
  @IsDateString()
  eventEndDate?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => VenueLayoutDto)
  venueLayout?: VenueLayoutDto;

  @IsOptional()
  @IsNumber()
  totalCapacity?: number;
}

export class UpdateLayoutDto {
  @IsObject()
  @ValidateNested()
  @Type(() => VenueLayoutDto)
  venueLayout: VenueLayoutDto;
}
