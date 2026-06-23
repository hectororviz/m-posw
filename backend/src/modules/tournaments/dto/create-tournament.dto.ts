import { IsArray, IsEnum, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { AllowedSex } from '@prisma/client';

export class CreateTournamentDto {
  @IsString()
  @Length(1, 200)
  name: string;

  @IsInt()
  year: number;

  @IsEnum(AllowedSex)
  allowedSex: AllowedSex;

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
