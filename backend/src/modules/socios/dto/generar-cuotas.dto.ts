import { IsInt, Max, Min } from 'class-validator';

export class GenerarCuotasDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio: number;

  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;
}
