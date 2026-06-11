import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreatePagoDto {
  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsOptional()
  @IsString()
  @IsIn(['efectivo', 'transferencia'])
  medioPago?: string;

  @IsDateString()
  fecha: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsUUID()
  @IsNotEmpty()
  treasuryAccountId: string;
}
