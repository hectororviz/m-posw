import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return value;
    }
    return typeof value === 'string' || typeof value === 'number' ? Number(value) : value;
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  price: number;

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
