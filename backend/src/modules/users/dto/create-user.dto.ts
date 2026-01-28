import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  name: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsOptional()
  @IsString()
  externalPosId?: string;

  @IsOptional()
  @IsString()
  externalStoreId?: string;
}
