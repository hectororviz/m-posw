import { IsString, MinLength } from 'class-validator';

export class VoidCashMovementDto {
  @IsString()
  @MinLength(1)
  voidReason: string;
}
