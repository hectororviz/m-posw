import { IsBoolean, IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateBeneficioDto {
  @IsInt()
  socioTipoId: number;

  @IsOptional()
  @IsUUID()
  categoriaProdId?: string;

  @IsOptional()
  @IsUUID()
  productoId?: string;

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
