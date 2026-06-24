import { IsInt, IsOptional, IsString, IsDateString, IsDecimal } from 'class-validator';

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  categoryId?: number;

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
