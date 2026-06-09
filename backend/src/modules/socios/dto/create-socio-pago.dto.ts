import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateSocioPagoDto {
  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsDateString()
  fecha: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}
