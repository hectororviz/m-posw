import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateAjusteDto {
  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsDateString()
  fecha: string;
}
