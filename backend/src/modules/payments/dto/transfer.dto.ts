import { IsNumber, IsPositive, IsString, IsUUID, IsInt, Min, ValidateNested, IsArray, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class ConfirmTransferItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}

export class PollTransferDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  monto_esperado!: number;
}

export class ConfirmTransferDto {
  @IsString()
  payment_id!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  monto_recibido!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  monto_esperado!: number;
}

export class ConfirmTransferWithItemsDto extends ConfirmTransferDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConfirmTransferItemDto)
  items: ConfirmTransferItemDto[];
}

export interface PollTransferResponse {
  hay_pago: boolean;
  monto?: number;
  pagador?: string;
  tipo?: string;
  fecha?: string;
  payment_id?: string;
}

export interface ConfirmTransferResponse {
  success: boolean;
  saleId?: string;
  orderNumber?: number;
  message?: string;
}
