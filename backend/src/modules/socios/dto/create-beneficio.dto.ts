import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateBeneficioDto {
  @IsInt()
  socioTipoId: number;

  @IsUUID()
  categoriaProdId: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  porcentaje: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descuentoMaximo?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limiteDiario?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
