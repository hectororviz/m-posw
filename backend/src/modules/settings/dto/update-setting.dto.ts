import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateSettingDto {
  @IsOptional()
  @IsString()
  storeName?: string;

  @IsOptional()
  @IsString()
  clubName?: string;

  @IsOptional()
  @IsBoolean()
  enableTicketPrinting?: boolean;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @IsOptional()
  @IsString()
  okAnimationUrl?: string;

  @IsOptional()
  @IsString()
  errorAnimationUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/)
  accentColor?: string;
}
