import { IsNumber, IsPositive, IsString, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

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
