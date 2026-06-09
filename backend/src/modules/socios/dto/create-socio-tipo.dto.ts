import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateSocioTipoDto {
  @IsString()
  nombre: string;

  @IsNumber()
  @Min(0)
  montoMensual: number;

  @IsOptional()
  @IsString()
  comentario?: string;
}
