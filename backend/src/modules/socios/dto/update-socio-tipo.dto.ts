import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSocioTipoDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  montoMensual?: number;

  @IsOptional()
  @IsString()
  comentario?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
