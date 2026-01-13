import { IsBoolean, IsNumber, IsOptional, IsString, IsUrl, Matches } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsNumber()
  price: number;

  @IsUrl()
  imageUrl: string;

  @IsString()
  categoryId: string;

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
