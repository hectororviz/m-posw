import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

class CanjeItemDto {
  @IsUUID()
  socioBeneficioId: string;

  @IsNumber()
  @Min(0.01)
  montoDescontado: number;
}

export class CreateCanjesDto {
  @IsUUID()
  socioId: string;

  @IsUUID()
  ventaId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CanjeItemDto)
  canjes: CanjeItemDto[];
}
