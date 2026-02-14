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

// Geçmiş tarih kontrolü için custom validator (saat dahil)
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
          const now = new Date();
          // Etkinlik tarihi şu anki zamandan en az 1 saat sonra olmalı
          // Bu sayede bugün + geçmiş saat kabul edilmez
          now.setMinutes(now.getMinutes() - 30); // 30 dakika tolerans
          return inputDate >= now;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} geçmiş bir tarih/saat olamaz`;
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

  @IsOptional()
  @IsBoolean()
  isVip?: boolean;

  @IsOptional()
  @IsNumber()
  size?: number;

  @IsOptional()
  @IsString()
  gridCol?: string;

  @IsOptional()
  @IsNumber()
  gridRow?: number;

  @IsOptional()
  @IsNumber()
  floor?: number;
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

  @IsOptional()
  @IsString()
  displayText?: string;

  @IsOptional()
  @IsString()
  gridCol?: string;

  @IsOptional()
  @IsNumber()
  gridRow?: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  borderColor?: string;

  @IsOptional()
  @IsNumber()
  borderWidth?: number;

  @IsOptional()
  @IsString()
  iconId?: string;

  @IsOptional()
  @IsString()
  fontSize?: string;

  @IsOptional()
  @IsString()
  fontFamily?: string;

  @IsOptional()
  @IsString()
  textDirection?: string;
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

export class GroupLineDto {
  @IsString()
  id: string;

  @IsString()
  orientation: string;

  @IsNumber()
  position: number;

  @IsOptional()
  @IsString()
  color?: string;
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupLineDto)
  groupLines?: GroupLineDto[];
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

  @IsOptional()
  @IsBoolean()
  reviewEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  reviewHistoryVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  reservationEnabled?: boolean;
}

export class UpdateLayoutDto {
  @IsObject()
  @ValidateNested()
  @Type(() => VenueLayoutDto)
  venueLayout: VenueLayoutDto;
}
