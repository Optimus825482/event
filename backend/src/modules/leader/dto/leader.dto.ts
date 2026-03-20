import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  ValidateNested,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

// ============ Category Scores DTO ============

export class CategoryScoresDto {
  @ApiPropertyOptional({ description: "İletişim Becerileri (0-5)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  communication: number;

  @ApiPropertyOptional({ description: "Dakiklik ve Güvenilirlik (0-5)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  punctuality: number;

  @ApiPropertyOptional({ description: "Takım Çalışması (0-5)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  teamwork: number;

  @ApiPropertyOptional({ description: "Müşteri Memnuniyeti (0-5)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  customerService: number;

  @ApiPropertyOptional({ description: "Teknik Beceriler (0-5)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  technicalSkills: number;

  @ApiPropertyOptional({ description: "İnisiyatif ve Problem Çözme (0-5)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  initiative: number;

  @ApiPropertyOptional({ description: "Kıyafet ve Görünüm (0-5)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  appearance: number;

  @ApiPropertyOptional({ description: "Stres Yönetimi (0-5)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  stressManagement: number;
}

// ============ Review DTOs ============

export class AutoSaveReviewDto {
  @ApiProperty({ description: "Personel ID" })
  @IsUUID()
  staffId: string;

  @ApiProperty({ description: "Etkinlik ID" })
  @IsUUID()
  eventId: string;

  @ApiPropertyOptional({ description: "Kategori puanları" })
  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryScoresDto)
  categoryScores?: CategoryScoresDto;

  @ApiPropertyOptional({ description: "Güçlü yönler" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  strengths?: string[];

  @ApiPropertyOptional({ description: "Geliştirilecek yönler" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  improvements?: string[];

  @ApiPropertyOptional({ description: "Yorum" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiPropertyOptional({ description: "Özel notlar" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  privateNotes?: string;

  @ApiPropertyOptional({ description: "Sonraki etkinlik notları" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  nextEventNotes?: string;
}

export class CreateReviewDto extends AutoSaveReviewDto {
  @ApiPropertyOptional({ description: "Tamamlandı mı?" })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}

export class BulkReviewItemDto {
  @ApiProperty({ description: "Personel ID" })
  @IsUUID()
  staffId: string;

  @ApiPropertyOptional({ description: "Kategori puanları" })
  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryScoresDto)
  categoryScores?: CategoryScoresDto;

  @ApiPropertyOptional({ description: "Güçlü yönler" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  strengths?: string[];

  @ApiPropertyOptional({ description: "Geliştirilecek yönler" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  improvements?: string[];

  @ApiPropertyOptional({ description: "Yorum" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiPropertyOptional({ description: "Özel notlar" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  privateNotes?: string;

  @ApiPropertyOptional({ description: "Sonraki etkinlik notları" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  nextEventNotes?: string;

  @ApiPropertyOptional({ description: "Tamamlandı mı?" })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}

export class CreateBulkReviewsDto {
  @ApiProperty({
    description: "Değerlendirme listesi",
    type: [BulkReviewItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkReviewItemDto)
  reviews: BulkReviewItemDto[];
}
