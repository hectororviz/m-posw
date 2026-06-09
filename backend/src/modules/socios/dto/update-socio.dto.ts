import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { SocioEstado } from '@prisma/client';

export class UpdateSocioDto {
  @IsOptional()
  @IsInt()
  nroSocio?: number;

  @IsOptional()
  @IsString()
  dni?: string;

  @IsOptional()
  @IsString()
  apellido?: string;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsInt()
  socioTipoId?: number;

  @IsOptional()
  @IsDateString()
  fechaAlta?: string;

  @IsOptional()
  @IsEnum(SocioEstado)
  estado?: SocioEstado;
}
