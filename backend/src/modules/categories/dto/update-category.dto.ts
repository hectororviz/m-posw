import { IsBoolean, IsOptional, IsString, IsUrl, Matches } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  iconName?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  colorHex?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
