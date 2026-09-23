import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { EntradaBeneficioSector } from '@prisma/client';

export class CreateEntradaBeneficioDto {
  @IsString()
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsEnum(EntradaBeneficioSector)
  sector!: EntradaBeneficioSector;

  @IsOptional()
  @IsUUID()
  categoriaProdId?: string;

  @IsOptional()
  @IsUUID()
  productoId?: string;

  @IsOptional()
  @IsUUID()
  internetPlanId?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  porcentaje!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descuentoMaximo?: number;

  @IsOptional()
  @IsBoolean()
  usoUnico?: boolean;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
