import { IsArray, IsEnum, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ModuleKey, ModuleAccess } from '@prisma/client';

class PermissionInput {
  @IsEnum(ModuleKey)
  module: ModuleKey;

  @IsEnum(ModuleAccess)
  access: ModuleAccess;
}

export class CreateUserDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  homeModule?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionInput)
  permissions?: PermissionInput[];
}
