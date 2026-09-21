import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTorneoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre!: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  precio!: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
