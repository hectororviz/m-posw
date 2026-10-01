import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListMpMovementsDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(['PENDIENTE', 'SUGERIDO', 'CONCILIADO', 'IGNORADO'])
  estado?: string;

  @IsOptional()
  @IsIn(['COBRO_QR', 'TRANSFERENCIA', 'RETIRO', 'GASTO', 'FEE', 'REFUND', 'CHARGEBACK', 'OTRO'])
  tipo?: string;

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

export class SyncDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class VincularDto {
  @IsOptional()
  @IsUUID()
  saleId?: string;

  @IsOptional()
  @IsUUID()
  moneyMovementId?: string;
}

export class CategorizarDto {
  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsString()
  concepto?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsUUID()
  responsableId?: string;

  @IsOptional()
  @IsString()
  nota?: string;
}
