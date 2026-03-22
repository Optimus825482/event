import { IsEnum, IsBoolean, IsOptional, ValidateNested } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ModulePermission } from "../../../entities/user-permission.entity";

export class AssignPermissionDto {
  @ApiProperty({
    description: "Modül adı",
    enum: ModulePermission,
  })
  @IsEnum(ModulePermission)
  module: ModulePermission;

  @ApiProperty({ description: "Görüntüleme yetkisi" })
  @IsBoolean()
  canView: boolean;

  @ApiProperty({ description: "Oluşturma yetkisi" })
  @IsBoolean()
  canCreate: boolean;

  @ApiProperty({ description: "Düzenleme yetkisi" })
  @IsBoolean()
  canEdit: boolean;

  @ApiProperty({ description: "Silme yetkisi" })
  @IsBoolean()
  canDelete: boolean;
}

export class AssignPermissionsDto {
  @ApiProperty({
    description: "Atanacak yetkiler",
    type: [AssignPermissionDto],
  })
  @ValidateNested({ each: true })
  @Type(() => AssignPermissionDto)
  permissions: AssignPermissionDto[];
}

export class UpdatePermissionDto {
  @ApiPropertyOptional({ description: "Görüntüleme yetkisi" })
  @IsOptional()
  @IsBoolean()
  canView?: boolean;

  @ApiPropertyOptional({ description: "Oluşturma yetkisi" })
  @IsOptional()
  @IsBoolean()
  canCreate?: boolean;

  @ApiPropertyOptional({ description: "Düzenleme yetkisi" })
  @IsOptional()
  @IsBoolean()
  canEdit?: boolean;

  @ApiPropertyOptional({ description: "Silme yetkisi" })
  @IsOptional()
  @IsBoolean()
  canDelete?: boolean;
}

export class PermissionResponseDto {
  @ApiProperty({ description: "Yetki ID" })
  id: string;

  @ApiProperty({ description: "Modül adı", enum: ModulePermission })
  module: ModulePermission;

  @ApiProperty({ description: "Görüntüleme yetkisi" })
  canView: boolean;

  @ApiProperty({ description: "Oluşturma yetkisi" })
  canCreate: boolean;

  @ApiProperty({ description: "Düzenleme yetkisi" })
  canEdit: boolean;

  @ApiProperty({ description: "Silme yetkisi" })
  canDelete: boolean;

  @ApiProperty({ description: "Oluşturulma tarihi" })
  createdAt: Date;

  @ApiProperty({ description: "Güncellenme tarihi" })
  updatedAt: Date;
}
