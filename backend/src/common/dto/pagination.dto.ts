import { IsOptional, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Pagination Query DTO
 * Tüm liste endpoint'lerinde kullanılır
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Sayfa numarası (1'den başlar)",
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Sayfa başına kayıt sayısı",
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: "Arama terimi",
  })
  @IsOptional()
  search?: string;

  /**
   * Offset hesapla (TypeORM skip için)
   */
  get skip(): number {
    return ((this.page || 1) - 1) * (this.limit || 20);
  }

  /**
   * Take değeri (TypeORM take için)
   */
  get take(): number {
    return this.limit || 20;
  }
}

/**
 * Paginated Response Interface
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Paginated response oluşturucu helper
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}
