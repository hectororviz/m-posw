import { IsInt, IsOptional, IsString, IsDateString, IsDecimal } from 'class-validator';

export class CreateAssetDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  categoryId: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;

  @IsOptional()
  @IsDecimal()
  acquisitionValue?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
