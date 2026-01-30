import { ArrayMinSize, IsArray, IsInt, IsIn, IsNumber, IsString, Min } from 'class-validator';

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

export class CreateCashSaleDto extends CreateSaleDto {
  @IsNumber()
  @Min(0)
  total: number;

  @IsNumber()
  @Min(0)
  cashReceived: number;

  @IsNumber()
  changeAmount: number;

  @IsString()
  @IsIn(['CASH'])
  paymentMethod: 'CASH';
}

export class CreateQrSaleDto extends CreateSaleDto {
  @IsNumber()
  @Min(0)
  total: number;

  @IsString()
  @IsIn(['MP_QR'])
  paymentMethod: 'MP_QR';
}
