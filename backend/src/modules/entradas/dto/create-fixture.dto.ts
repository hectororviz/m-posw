import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFixtureDto {
  @IsDateString()
  @IsNotEmpty()
  fecha!: string;

  @IsUUID()
  torneoId!: string;

  @IsUUID()
  rivalId!: string;

  @IsOptional()
  @IsDateString()
  ventanaDesde?: string;

  @IsOptional()
  @IsDateString()
  ventanaHasta?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateFixtureDto {
  @IsOptional()
  @IsDateString()
  ventanaDesde?: string;

  @IsOptional()
  @IsDateString()
  ventanaHasta?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsString()
  @IsUUID()
  torneoId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  rivalId?: string;
}
