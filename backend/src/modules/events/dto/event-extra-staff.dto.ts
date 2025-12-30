import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsUUID,
} from "class-validator";

/**
 * Ekstra Personel Oluşturma DTO
 */
export class CreateEventExtraStaffDto {
  @IsString()
  fullName: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  shiftStart?: string;

  @IsString()
  @IsOptional()
  shiftEnd?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  assignedGroups?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  assignedTables?: string[];

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

/**
 * Ekstra Personel Güncelleme DTO
 */
export class UpdateEventExtraStaffDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  shiftStart?: string;

  @IsString()
  @IsOptional()
  shiftEnd?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  assignedGroups?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  assignedTables?: string[];

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/**
 * Toplu Ekstra Personel Kaydetme DTO
 */
export class BulkSaveEventExtraStaffDto {
  @IsArray()
  extraStaff: CreateEventExtraStaffDto[];
}
