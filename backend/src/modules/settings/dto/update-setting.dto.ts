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
  enableLigasModule?: boolean;

  @IsOptional()
  @IsBoolean()
  enablePlayersModule?: boolean;

  @IsOptional()
  @IsBoolean()
  enablePatrimonioModule?: boolean;

  @IsOptional()
  @IsBoolean()
  enableNotificationsModule?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappUseApi?: boolean;

  @IsOptional()
  @IsString()
  whatsappWebMessage?: string;

  @IsOptional()
  @IsString()
  whatsappPhoneNumberId?: string;

  @IsOptional()
  @IsString()
  whatsappAccessToken?: string;

  @IsOptional()
  @IsString()
  whatsappBusinessAccountId?: string;

  @IsOptional()
  @IsString()
  whatsappWebhookVerifyToken?: string;

  @IsOptional()
  @IsString()
  whatsappTemplateName?: string;

  @IsOptional()
  @IsString()
  whatsappAppSecret?: string;

  @IsOptional()
  @IsString()
  clubAlias?: string;

  @IsOptional()
  whatsappVariableOrder?: Record<string, number>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  movementInReasons?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  movementOutReasons?: string[];
}
