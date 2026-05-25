import { AccountingMovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateMovementDto {
  @IsEnum(AccountingMovementType)
  type: AccountingMovementType;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  description: string;

  @Type(() => Date)
  @IsDate()
  date: Date;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsUUID('4', { message: 'refMovementId debe ser un UUID válido' })
  refMovementId?: string;
}
