import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Min, Max } from "class-validator";

/**
 * Pagination Query DTO
 * Tüm paginated endpoint'ler için kullanılır
 */
export class PaginationQueryDto {
  @ApiProperty({
    description: "Sayfa numarası",
    minimum: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: "Sayfa başına kayıt sayısı",
    minimum: 1,
    maximum: 100,
    default: 50,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

/**
 * Pagination Metadata
 * Response'larda pagination bilgisi için
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginated Response DTO
 * Generic paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}
