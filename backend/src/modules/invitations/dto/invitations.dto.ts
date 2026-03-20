import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsEnum,
  Min,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { InvitationSize } from "../../../entities/invitation-template.entity";
// ============ INVITATION TEMPLATE DTOs ============

export class CreateInvitationTemplateDto {
  @ApiProperty({ description: "Şablon adı" })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: "Açıklama" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: "Varsayılan mı?" })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    description: "Boyut",
    enum: ["A5", "A6", "SQUARE", "CUSTOM"],
  })
  @IsOptional()
  @IsString()
  size?: InvitationSize;

  @ApiPropertyOptional({ description: "Genişlik (px)" })
  @IsOptional()
  @IsNumber()
  @Min(1)
  width?: number;

  @ApiPropertyOptional({ description: "Yükseklik (px)" })
  @IsOptional()
  @IsNumber()
  @Min(1)
  height?: number;

  @ApiPropertyOptional({ description: "Arka plan rengi" })
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @ApiPropertyOptional({ description: "Arka plan görseli" })
  @IsOptional()
  @IsString()
  backgroundImage?: string;

  @ApiPropertyOptional({ description: "Arka plan gradient" })
  @IsOptional()
  @IsString()
  backgroundGradient?: string;

  @ApiPropertyOptional({ description: "Elementler (JSON)" })
  @IsOptional()
  @IsArray()
  elements?: any[];

  @ApiPropertyOptional({ description: "Önizleme görseli" })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: "Aktif mi?" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateInvitationTemplateDto {
  @ApiPropertyOptional({ description: "Şablon adı" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: "Açıklama" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: "Varsayılan mı?" })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    description: "Boyut",
    enum: ["A5", "A6", "SQUARE", "CUSTOM"],
  })
  @IsOptional()
  @IsString()
  size?: InvitationSize;

  @ApiPropertyOptional({ description: "Genişlik (px)" })
  @IsOptional()
  @IsNumber()
  @Min(1)
  width?: number;

  @ApiPropertyOptional({ description: "Yükseklik (px)" })
  @IsOptional()
  @IsNumber()
  @Min(1)
  height?: number;

  @ApiPropertyOptional({ description: "Arka plan rengi" })
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @ApiPropertyOptional({ description: "Arka plan görseli" })
  @IsOptional()
  @IsString()
  backgroundImage?: string;

  @ApiPropertyOptional({ description: "Arka plan gradient" })
  @IsOptional()
  @IsString()
  backgroundGradient?: string;

  @ApiPropertyOptional({ description: "Elementler (JSON)" })
  @IsOptional()
  @IsArray()
  elements?: any[];

  @ApiPropertyOptional({ description: "Önizleme görseli" })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: "Aktif mi?" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ============ EVENT INVITATION DTOs ============

export class SaveEventInvitationDto {
  @ApiPropertyOptional({ description: "Şablon ID" })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ description: "Özelleştirilmiş elementler" })
  @IsOptional()
  @IsArray()
  customElements?: any[];

  @ApiPropertyOptional({
    description: "Boyut",
    enum: ["A5", "A6", "SQUARE", "CUSTOM"],
  })
  @IsOptional()
  @IsString()
  size?: InvitationSize;

  @ApiPropertyOptional({ description: "Genişlik (px)" })
  @IsOptional()
  @IsNumber()
  @Min(1)
  width?: number;

  @ApiPropertyOptional({ description: "Yükseklik (px)" })
  @IsOptional()
  @IsNumber()
  @Min(1)
  height?: number;

  @ApiPropertyOptional({ description: "Arka plan rengi" })
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @ApiPropertyOptional({ description: "Arka plan görseli" })
  @IsOptional()
  @IsString()
  backgroundImage?: string;

  @ApiPropertyOptional({ description: "Arka plan gradient" })
  @IsOptional()
  @IsString()
  backgroundGradient?: string;

  @ApiPropertyOptional({ description: "Etkinlik görselleri" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventImages?: string[];

  @ApiPropertyOptional({ description: "Firma logosu" })
  @IsOptional()
  @IsString()
  companyLogo?: string;

  @ApiPropertyOptional({ description: "Aktif mi?" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ============ IMAGE DTOs ============

export class EventImageDto {
  @ApiProperty({ description: "Görsel URL" })
  @IsString()
  imageUrl: string;
}
