import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class CreateVenueTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  layoutData: any;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateVenueTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  layoutData?: any;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
