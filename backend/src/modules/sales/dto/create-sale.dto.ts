import { ArrayMinSize, IsArray, IsInt, IsString, Min } from 'class-validator';

export class SaleItemInputDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  items: SaleItemInputDto[];
}
