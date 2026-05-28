import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePagoDto {
  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsString()
  @IsIn(['efectivo', 'transferencia'])
  medioPago: string;

  @IsDateString()
  fecha: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
