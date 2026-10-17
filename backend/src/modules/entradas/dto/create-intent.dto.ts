import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { EntradaPayMethod, EntradaSector } from '@prisma/client';

export class CreateIntentDto {
  @IsOptional()
  @IsUUID()
  fixtureId?: string;

  @IsOptional()
  @IsUUID()
  eventoId?: string;

  @IsOptional()
  @IsEnum(EntradaSector)
  sector?: EntradaSector;

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
