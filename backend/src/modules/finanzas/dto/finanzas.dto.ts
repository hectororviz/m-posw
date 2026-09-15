import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMoneyAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @IsOptional()
  @IsIn(['EFECTIVO', 'MERCADOPAGO', 'BANCO', 'OTRO'])
  kind?: 'EFECTIVO' | 'MERCADOPAGO' | 'BANCO' | 'OTRO';

  @IsOptional()
  @IsNumber()
  initialBalance?: number;
}

export class UpdateMoneyAccountDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsIn(['EFECTIVO', 'MERCADOPAGO', 'BANCO', 'OTRO'])
  kind?: 'EFECTIVO' | 'MERCADOPAGO' | 'BANCO' | 'OTRO';

  @IsOptional()
  @IsNumber()
  initialBalance?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateMoneyCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @IsOptional()
  @IsIn(['INGRESO', 'EGRESO', 'AMBOS'])
  kind?: 'INGRESO' | 'EGRESO' | 'AMBOS';
}

export class UpdateMoneyCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsIn(['INGRESO', 'EGRESO', 'AMBOS'])
  kind?: 'INGRESO' | 'EGRESO' | 'AMBOS';

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateMoneyMovementDto {
  @IsIn(['INGRESO', 'EGRESO'])
  kind: 'INGRESO' | 'EGRESO';

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsUUID()
  accountId: string;

  @IsUUID()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

export class ListMovementsDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class SummaryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class VoidMovementDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export enum MoneyMovementSourceDto {
  MANUAL = 'MANUAL',
  COBRO_FIADO = 'COBRO_FIADO',
  CUOTA_SOCIO = 'CUOTA_SOCIO',
  AJUSTE = 'AJUSTE',
}
