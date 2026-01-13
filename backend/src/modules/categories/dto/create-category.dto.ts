import { IsBoolean, IsOptional, IsString, IsUrl, Matches } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsUrl()
  imageUrl: string;

  @IsString()
  iconName: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  colorHex?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
