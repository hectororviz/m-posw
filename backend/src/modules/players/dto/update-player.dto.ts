import { IsEnum, IsISO8601, IsOptional, IsString, Length } from 'class-validator';
import { Sex } from '@prisma/client';

export class UpdatePlayerDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  dni?: string;

  @IsOptional()
  @IsISO8601()
  birthDate?: string;

  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;
}
