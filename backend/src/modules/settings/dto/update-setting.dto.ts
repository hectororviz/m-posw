import { IsArray, IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

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

  @IsOptional()
  @IsBoolean()
  enableCashPayment?: boolean;

  @IsOptional()
  @IsBoolean()
  enableQrPayment?: boolean;

  @IsOptional()
  @IsBoolean()
  enableTransferPayment?: boolean;

  @IsOptional()
  @IsBoolean()
  enableFiadoPayment?: boolean;

  @IsOptional()
  @IsBoolean()
  enableSociosModule?: boolean;

  @IsOptional()
  @IsBoolean()
  enableTreasuryModule?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAcreedoresModule?: boolean;

  @IsOptional()
  @IsBoolean()
  enableInternetModule?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAutoJournalPos?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAutoJournalAcreedores?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAutoJournalSocios?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  movementInReasons?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  movementOutReasons?: string[];
}
