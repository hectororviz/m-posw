import { ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SaleItemInputDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class SocioCanjeInputDto {
  @IsString()
  socioBeneficioId: string;

  @IsNumber()
  @Min(0)
  montoDescontado: number;
}

export class CreateSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items: SaleItemInputDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountTotal?: number;

  @IsOptional()
  @IsInt()
  socioId?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocioCanjeInputDto)
  canjes?: SocioCanjeInputDto[];
}

export class CreateCashSaleDto extends CreateSaleDto {
  @IsNumber() @Min(0) total: number;
  @IsNumber() @Min(0) cashReceived: number;
  @IsNumber() changeAmount: number;
  @IsString() @IsIn(['CASH']) paymentMethod: 'CASH';
}

export class CreateQrSaleDto extends CreateSaleDto {
  @IsNumber() @Min(0) total: number;
  @IsString() @IsIn(['MP_QR']) paymentMethod: 'MP_QR';
}

export class CreateFiadoSaleDto extends CreateSaleDto {
  @IsNumber() @Min(0) total: number;
  @IsString() @IsIn(['FIADO']) paymentMethod: 'FIADO';
  @IsInt() acreedorId: number;
}
