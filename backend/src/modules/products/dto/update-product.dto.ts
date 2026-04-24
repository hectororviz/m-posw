import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Matches, Min, ValidateIf, ValidateNested } from 'class-validator';
import { ProductType } from '@prisma/client';

class IngredientInputDto {
  @IsUUID()
  rawMaterialId: string;

  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return value;
    }
    return typeof value === 'string' || typeof value === 'number' ? Number(value) : value;
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  quantity: number;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return value;
    }
    return typeof value === 'string' || typeof value === 'number' ? Number(value) : value;
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @IsOptional()
  @IsString()
  iconName?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  colorHex?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientInputDto)
  ingredients?: IngredientInputDto[];
}
