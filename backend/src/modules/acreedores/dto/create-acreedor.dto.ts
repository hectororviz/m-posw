import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAcreedorDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  limiteDeuda?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  advertenciaDeuda?: number;
}
