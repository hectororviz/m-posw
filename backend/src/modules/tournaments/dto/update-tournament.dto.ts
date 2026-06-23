import { IsArray, IsEnum, IsInt, IsOptional, IsString, Length } from 'class-validator';
import { AllowedSex } from '@prisma/client';

export class UpdateTournamentDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsEnum(AllowedSex)
  allowedSex?: AllowedSex;

  @IsOptional()
  @IsInt()
  birthYearMin?: number;

  @IsOptional()
  @IsInt()
  birthYearMax?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  categoryIds?: number[];
}
