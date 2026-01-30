import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdateSettingDto {
  @IsOptional()
  @IsString()
  storeName?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/)
  accentColor?: string;
}
