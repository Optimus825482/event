import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateTableTypeDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(1)
  capacity: number;

  @IsString()
  color: string;

  @IsString()
  @IsOptional()
  shape?: string; // 'round' | 'rectangle' | 'square'
}

export class UpdateTableTypeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  shape?: string;
}

export * from './create-table-type.dto';
export * from './update-table-type.dto';
