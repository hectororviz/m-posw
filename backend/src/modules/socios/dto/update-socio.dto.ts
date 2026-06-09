import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { SocioEstado } from '@prisma/client';

const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

export class UpdateSocioDto {
  @IsOptional()
  @IsInt()
  @Transform(emptyToNull)
  nroSocio?: number;

  @IsOptional()
  @IsString()
  @Transform(emptyToNull)
  dni?: string;

  @IsOptional()
  @IsString()
  @Transform(emptyToNull)
  apellido?: string;

  @IsOptional()
  @IsString()
  @Transform(emptyToNull)
  nombre?: string;

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

  @IsOptional()
  @IsInt()
  @Transform(emptyToNull)
  socioTipoId?: number;

  @IsOptional()
  @IsDateString()
  @Transform(emptyToNull)
  fechaAlta?: string;

  @IsOptional()
  @IsEnum(SocioEstado)
  estado?: SocioEstado;
}
