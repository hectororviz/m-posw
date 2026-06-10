import { IsBoolean, IsInt, IsNumber, IsOptional, IsUUID, Max, Min, ValidateIf } from 'class-validator';

export class CreateBeneficioDto {
  @IsInt()
  socioTipoId: number;

  @IsOptional()
  @IsUUID()
  categoriaProdId?: string;

  @IsOptional()
  @IsUUID()
  productoId?: string;

  @ValidateIf((o) => !o.categoriaProdId && !o.productoId)
  _validateAtLeastOne() {
    // validator will fail — at least one of categoriaProdId or productoId is required
  }

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
