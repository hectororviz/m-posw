import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { EntradaPayMethod, EntradaSector } from '@prisma/client';

export class CreateIntentDto {
  @IsUUID()
  fixtureId!: string;

  @IsEnum(EntradaSector)
  sector!: EntradaSector;

  @IsInt()
  @Min(1)
  @Max(10)
  cantidad!: number;

  @IsEnum(EntradaPayMethod)
  paymentMethod!: EntradaPayMethod;

  @IsOptional()
  @IsString()
  socioUuid?: string | null;
}
