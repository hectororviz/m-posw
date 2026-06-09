import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { SocioEstado } from '@prisma/client';

export class CreateSocioDto {
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
  fechaNacimiento?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsInt()
  socioTipoId: number;

  @IsDateString()
  fechaAlta: string;

  @IsOptional()
  @IsEnum(SocioEstado)
  estado?: SocioEstado;
}
