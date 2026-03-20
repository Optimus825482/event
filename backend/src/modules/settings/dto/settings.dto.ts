import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEmail,
  Min,
  Max,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// ============ SYSTEM SETTINGS DTOs ============

export class UpdateGeneralSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  // Canvas Ayarları
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  defaultGridSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  snapToGrid?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showGridByDefault?: boolean;

  // Rezervasyon Ayarları
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  defaultGuestCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowOverbooking?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requirePhoneNumber?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireEmail?: boolean;

  // Check-in Ayarları
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoCheckInEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  checkInSoundEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showTableDirections?: boolean;

  // Feature Flags
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  qrCodeSystemEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  invitationSystemEnabled?: boolean;

  // Bildirim Ayarları
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  smsNotifications?: boolean;

  // SMTP Ayarları
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  smtpPort?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smtpUser?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smtpPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  smtpFromEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smtpFromName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;
}

// ============ STAFF COLOR DTOs ============

export class CreateStaffColorDto {
  @ApiProperty({ description: "Renk adı" })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: "Renk kodu (hex)" })
  @IsString()
  @MaxLength(50)
  color: string;
}

export class UpdateStaffColorDto {
  @ApiPropertyOptional({ description: "Renk adı" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: "Renk kodu (hex)" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ description: "Aktif mi?" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ============ TABLE TYPE DTOs ============

export class CreateTableTypeDto {
  @ApiProperty({ description: "Masa tipi adı" })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: "Kapasite", default: 8 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  capacity?: number;

  @ApiPropertyOptional({ description: "Renk kodu", default: "#3b82f6" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ description: "Şekil", default: "round" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shape?: string;

  @ApiPropertyOptional({ description: "Minimum aralık", default: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minSpacing?: number;

  @ApiPropertyOptional({ description: "İkon" })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: "Taban fiyat", default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;
}

export class UpdateTableTypeDto {
  @ApiPropertyOptional({ description: "Masa tipi adı" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: "Kapasite" })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  capacity?: number;

  @ApiPropertyOptional({ description: "Renk kodu" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ description: "Şekil" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shape?: string;

  @ApiPropertyOptional({ description: "Minimum aralık" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minSpacing?: number;

  @ApiPropertyOptional({ description: "Aktif mi?" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: "İkon" })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: "Taban fiyat" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;
}

// ============ SMTP TEST DTOs ============

export class SendTestEmailDto {
  @ApiProperty({ description: "Test e-postası gönderilecek adres" })
  @IsEmail()
  email: string;
}
