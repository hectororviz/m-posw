import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { SocioEstado } from '@prisma/client';

const emptyToNull = ({ value }: { value: unknown }) => {
  if (value === '' || value === null || value === undefined) return null;
  return value;
};

const toIntOrNull = ({ value }: { value: unknown }) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
};

export class CreateSocioDto {
  @Transform(toIntOrNull)
  @IsInt()
  nroSocio: number;

  @IsString()
  dni: string;

  @IsString()
  apellido: string;

  @IsString()
  nombre: string;

  @IsOptional()
  @IsDateString()
  @Transform(emptyToNull)
  fechaNacimiento?: string;

  @IsOptional()
  @IsString()
  @Transform(emptyToNull)
  telefono?: string;

  @IsOptional()
  @IsString()
  @Transform(emptyToNull)
  direccion?: string;

  @Transform(toIntOrNull)
  @IsInt()
  socioTipoId: number;

  @IsDateString()
  fechaAlta: string;

  @IsOptional()
  @IsEnum(SocioEstado)
  estado?: SocioEstado;
}
