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
  shape?: string;
}
