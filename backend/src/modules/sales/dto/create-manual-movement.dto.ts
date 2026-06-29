import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateManualMovementDto {
  @IsString()
  @IsIn(['ENTRADA', 'SALIDA'])
  type: 'ENTRADA' | 'SALIDA';

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  description?: string;
}
