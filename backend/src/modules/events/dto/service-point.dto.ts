import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
  Max,
  IsUUID,
} from "class-validator";

/**
 * Hizmet Noktası Oluşturma DTO
 */
export class CreateServicePointDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  pointType?: string; // bar, lounge, reception, vip_area, backstage, other

  @IsNumber()
  @Min(1)
  @Max(50)
  @IsOptional()
  requiredStaffCount?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedRoles?: string[]; // barman, hostes, garson, barboy, security

  @IsNumber()
  @IsOptional()
  x?: number;

  @IsNumber()
  @IsOptional()
  y?: number;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  shape?: string; // square, circle, rectangle

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

/**
 * Hizmet Noktası Güncelleme DTO
 */
export class UpdateServicePointDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  pointType?: string;

  @IsNumber()
  @Min(1)
  @Max(50)
  @IsOptional()
  requiredStaffCount?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedRoles?: string[];

  @IsNumber()
  @IsOptional()
  x?: number;

  @IsNumber()
  @IsOptional()
  y?: number;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  shape?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/**
 * Hizmet Noktası Personel Ataması DTO
 */
export class CreateServicePointStaffAssignmentDto {
  @IsUUID()
  servicePointId: string;

  @IsUUID()
  staffId: string;

  @IsString()
  role: string; // barman, hostes, garson, barboy, security

  @IsUUID()
  @IsOptional()
  shiftId?: string;

  @IsString()
  @IsOptional()
  shiftStart?: string; // "18:00"

  @IsString()
  @IsOptional()
  shiftEnd?: string; // "02:00"

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

/**
 * Hizmet Noktası Personel Ataması Güncelleme DTO
 */
export class UpdateServicePointStaffAssignmentDto {
  @IsString()
  @IsOptional()
  role?: string;

  @IsUUID()
  @IsOptional()
  shiftId?: string;

  @IsString()
  @IsOptional()
  shiftStart?: string;

  @IsString()
  @IsOptional()
  shiftEnd?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/**
 * Toplu Hizmet Noktası Personel Ataması DTO
 */
export class BulkServicePointStaffAssignmentDto {
  @IsArray()
  assignments: CreateServicePointStaffAssignmentDto[];
}
