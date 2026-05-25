import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { AccountingMovementType } from '@prisma/client';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(AccountingMovementType)
  type: AccountingMovementType;
}
