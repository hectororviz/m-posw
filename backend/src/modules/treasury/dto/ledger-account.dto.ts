import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LedgerAccountType } from '@prisma/client';

export class CreateLedgerAccountDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(LedgerAccountType)
  type: LedgerAccountType;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsBoolean()
  @IsOptional()
  acceptsEntries?: boolean;

  @IsString()
  @IsOptional()
  parentId?: string;
}

export class UpdateLedgerAccountDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(LedgerAccountType)
  @IsOptional()
  type?: LedgerAccountType;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsBoolean()
  @IsOptional()
  acceptsEntries?: boolean;

  @IsString()
  @IsOptional()
  parentId?: string;
}
