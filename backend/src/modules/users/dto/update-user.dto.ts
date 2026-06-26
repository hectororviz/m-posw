import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ModuleKey, ModuleAccess } from '@prisma/client';

class PermissionInput {
  @IsEnum(ModuleKey)
  module: ModuleKey;

  @IsEnum(ModuleAccess)
  access: ModuleAccess;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  homeModule?: string;

  @IsOptional()
  @IsString()
  homeSmartphoneModule?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionInput)
  permissions?: PermissionInput[];

  @IsOptional()
  @IsString()
  externalPosId?: string;

  @IsOptional()
  @IsString()
  externalStoreId?: string;
}
