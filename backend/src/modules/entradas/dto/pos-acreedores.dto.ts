import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/** Alta mínima desde terminal POS: solo nombre (sin teléfono/línea). */
export class PosCreateAcreedorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nombre: string;
}

/** Pago en efectivo desde terminal POS: solo registro, fecha = hoy en servidor. */
export class PosPagoAcreedorDto {
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  monto: number;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().slice(0, 280) : value,
  )
  notas?: string;
}
