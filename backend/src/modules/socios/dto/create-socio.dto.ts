import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { SocioEstado } from '@prisma/client';

const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

export class CreateSocioDto {
  @Type(() => Number)
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

  @Type(() => Number)
  @IsInt()
  socioTipoId: number;

  @IsDateString()
  fechaAlta: string;

  @IsOptional()
  @IsEnum(SocioEstado)
  estado?: SocioEstado;
}
