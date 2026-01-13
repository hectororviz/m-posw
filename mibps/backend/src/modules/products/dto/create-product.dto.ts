import { IsBoolean, IsNumber, IsOptional, IsString, IsUrl } from 'class-validator';

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
  @IsBoolean()
  active?: boolean;
}
