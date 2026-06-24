import { IsEnum, IsISO8601, IsOptional, IsString, Length } from 'class-validator';
import { Sex } from '@prisma/client';

export class CreatePlayerDto {
  @IsString()
  @Length(1, 100)
  firstName: string;

  @IsString()
  @Length(1, 100)
  lastName: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  dni?: string;

  @IsISO8601()
  birthDate: string;

  @IsEnum(Sex)
  sex: Sex;
}
