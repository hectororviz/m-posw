import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Min, Max } from 'class-validator';
import { PlayerCategoryType } from '@prisma/client';

export class UpdatePlayerCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsEnum(PlayerCategoryType)
  restrictionType?: PlayerCategoryType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  ageMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  ageMax?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  ageCutoffMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  ageCutoffDay?: number;

  @IsOptional()
  @IsInt()
  birthYear?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
