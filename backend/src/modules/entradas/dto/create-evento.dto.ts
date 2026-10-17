import { IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEventoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  titulo!: string;

  @IsDateString()
  @IsNotEmpty()
  fecha!: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  precio!: number;

  @IsOptional()
  @IsDateString()
  ventanaDesde?: string;

  @IsOptional()
  @IsDateString()
  ventanaHasta?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateEventoDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  titulo?: string;

  @IsOptional()
  @IsDateString()
  ventanaDesde?: string;

  @IsOptional()
  @IsDateString()
  ventanaHasta?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  precio?: number;
}
