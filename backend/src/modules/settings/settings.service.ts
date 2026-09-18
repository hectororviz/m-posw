import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

const DEFAULT_SETTING_ID = '941abb3e-8bf2-4f08-b443-b3c98bd0b5ca';
const DEFAULT_STORE_NAME = 'MiBPS Demo';
const DEFAULT_ACCENT_COLOR = '#0ea5e9';
const DEFAULT_CLUB_NAME = '';
const DEFAULT_OK_ANIMATION_URL = '/animations/ok.json';
const DEFAULT_ERROR_ANIMATION_URL = '/animations/error.json';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getPublic() {
    const settings = await this.prisma.setting.findFirst();
    return {
      storeName: settings?.storeName ?? DEFAULT_STORE_NAME,
      clubName: settings?.clubName ?? DEFAULT_CLUB_NAME,
      logoUrl: settings?.logoUrl ?? null,
      faviconUrl: settings?.faviconUrl ?? null,
      okAnimationUrl: settings?.okAnimationUrl ?? DEFAULT_OK_ANIMATION_URL,
      errorAnimationUrl: settings?.errorAnimationUrl ?? DEFAULT_ERROR_ANIMATION_URL,
      accentColor: settings?.accentColor ?? DEFAULT_ACCENT_COLOR,
    };
  }

  async get() {
    const settings = await this.prisma.setting.upsert({
      where: { id: DEFAULT_SETTING_ID },
      create: {
        id: DEFAULT_SETTING_ID,
        storeName: DEFAULT_STORE_NAME,
        clubName: DEFAULT_CLUB_NAME,
        enableTicketPrinting: false,
        logoUrl: null,
        faviconUrl: null,
        okAnimationUrl: null,
        errorAnimationUrl: null,
        accentColor: DEFAULT_ACCENT_COLOR,
        enableCashPayment: true,
        enableQrPayment: true,
        enableTransferPayment: true,
        enableFiadoPayment: false,
        enableSociosModule: true,
        enableTreasuryModule: true,
        enableAcreedoresModule: true,
        enableInternetModule: false,
        enableLigasModule: false,
        enablePlayersModule: false,
        enablePatrimonioModule: true,
        enableNotificationsModule: false,
        whatsappUseApi: true,
        whatsappWebMessage: null,
      movementInReasons: [],
        movementOutReasons: [],
      },
      update: {},
    });
    return {
      storeName: settings.storeName,
      clubName: settings.clubName,
      enableTicketPrinting: settings.enableTicketPrinting,
      logoUrl: settings.logoUrl,
      faviconUrl: settings.faviconUrl,
      okAnimationUrl: settings.okAnimationUrl ?? DEFAULT_OK_ANIMATION_URL,
      errorAnimationUrl: settings.errorAnimationUrl ?? DEFAULT_ERROR_ANIMATION_URL,
      accentColor: settings.accentColor,
      enableCashPayment: settings.enableCashPayment,
      enableQrPayment: settings.enableQrPayment,
      enableTransferPayment: settings.enableTransferPayment,
      enableFiadoPayment: settings.enableFiadoPayment,
      enableSociosModule: settings.enableSociosModule,
      enableTreasuryModule: settings.enableTreasuryModule,
      enableAcreedoresModule: settings.enableAcreedoresModule,
      enableInternetModule: settings.enableInternetModule,
      enableLigasModule: settings.enableLigasModule,
      enablePlayersModule: settings.enablePlayersModule,
      enablePatrimonioModule: settings.enablePatrimonioModule,
      enableNotificationsModule: settings.enableNotificationsModule,
      interesAcreedoresHabilitado: settings.interesAcreedoresHabilitado,
      tasaInteresMensualAcreedores: settings.tasaInteresMensualAcreedores != null ? Number(settings.tasaInteresMensualAcreedores) : null,
      whatsappUseApi: settings.whatsappUseApi,
      whatsappWebMessage: settings.whatsappWebMessage,
      whatsappPhoneNumberId: settings.whatsappPhoneNumberId,
      whatsappBusinessAccountId: settings.whatsappBusinessAccountId,
      clubAlias: settings.clubAlias,
      whatsappVariableOrder: settings.whatsappVariableOrder,
      whatsappTemplateName: settings.whatsappTemplateName,
      hasAccessToken: !!settings.whatsappAccessToken,
      hasAppSecret: !!settings.whatsappAppSecret,
      hasWebhookVerifyToken: !!settings.whatsappWebhookVerifyToken,
      movementInReasons: settings.movementInReasons,
      movementOutReasons: settings.movementOutReasons,
    };
  }

  async update(dto: UpdateSettingDto) {
    const secretFields = [
      'whatsappAccessToken',
      'whatsappAppSecret',
      'whatsappWebhookVerifyToken',
    ] as const;
    for (const field of secretFields) {
      const value = (dto as Record<string, unknown>)[field];
      if (typeof value === 'string' && value.trim() === '') {
        delete (dto as Record<string, unknown>)[field];
      }
    }
    await this.prisma.setting.upsert({
      where: { id: DEFAULT_SETTING_ID },
      create: {
        id: DEFAULT_SETTING_ID,
        storeName: dto.storeName ?? DEFAULT_STORE_NAME,
        clubName: dto.clubName ?? DEFAULT_CLUB_NAME,
        enableTicketPrinting: dto.enableTicketPrinting ?? false,
        logoUrl: dto.logoUrl ?? null,
        faviconUrl: dto.faviconUrl ?? null,
        okAnimationUrl: dto.okAnimationUrl ?? null,
        errorAnimationUrl: dto.errorAnimationUrl ?? null,
        accentColor: dto.accentColor ?? DEFAULT_ACCENT_COLOR,
        enableCashPayment: dto.enableCashPayment ?? true,
        enableQrPayment: dto.enableQrPayment ?? true,
        enableTransferPayment: dto.enableTransferPayment ?? true,
        enableFiadoPayment: dto.enableFiadoPayment ?? false,
        enableSociosModule: dto.enableSociosModule ?? true,
        enableTreasuryModule: dto.enableTreasuryModule ?? true,
        enableAcreedoresModule: dto.enableAcreedoresModule ?? true,
        enableInternetModule: dto.enableInternetModule ?? false,
        enableLigasModule: dto.enableLigasModule ?? false,
        enablePlayersModule: dto.enablePlayersModule ?? false,
        enablePatrimonioModule: dto.enablePatrimonioModule ?? true,
        enableNotificationsModule: dto.enableNotificationsModule ?? false,
        whatsappUseApi: dto.whatsappUseApi ?? true,
        whatsappWebMessage: dto.whatsappWebMessage ?? null,
        movementInReasons: dto.movementInReasons ?? [],
        movementOutReasons: dto.movementOutReasons ?? [],
      },
      update: {
        ...(dto.storeName !== undefined ? { storeName: dto.storeName } : {}),
        ...(dto.clubName !== undefined ? { clubName: dto.clubName } : {}),
        ...(dto.enableTicketPrinting !== undefined
          ? { enableTicketPrinting: dto.enableTicketPrinting }
          : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.faviconUrl !== undefined ? { faviconUrl: dto.faviconUrl } : {}),
        ...(dto.okAnimationUrl !== undefined ? { okAnimationUrl: dto.okAnimationUrl } : {}),
        ...(dto.errorAnimationUrl !== undefined ? { errorAnimationUrl: dto.errorAnimationUrl } : {}),
        ...(dto.accentColor !== undefined ? { accentColor: dto.accentColor } : {}),
        ...(dto.enableCashPayment !== undefined ? { enableCashPayment: dto.enableCashPayment } : {}),
        ...(dto.enableQrPayment !== undefined ? { enableQrPayment: dto.enableQrPayment } : {}),
        ...(dto.enableTransferPayment !== undefined ? { enableTransferPayment: dto.enableTransferPayment } : {}),
        ...(dto.enableFiadoPayment !== undefined ? { enableFiadoPayment: dto.enableFiadoPayment } : {}),
        ...(dto.enableSociosModule !== undefined ? { enableSociosModule: dto.enableSociosModule } : {}),
        ...(dto.enableTreasuryModule !== undefined ? { enableTreasuryModule: dto.enableTreasuryModule } : {}),
        ...(dto.enableAcreedoresModule !== undefined ? { enableAcreedoresModule: dto.enableAcreedoresModule } : {}),
        ...(dto.enableInternetModule !== undefined ? { enableInternetModule: dto.enableInternetModule } : {}),
        ...(dto.enableLigasModule !== undefined ? { enableLigasModule: dto.enableLigasModule } : {}),
        ...(dto.enablePlayersModule !== undefined ? { enablePlayersModule: dto.enablePlayersModule } : {}),
        ...(dto.enablePatrimonioModule !== undefined ? { enablePatrimonioModule: dto.enablePatrimonioModule } : {}),
        ...(dto.enableNotificationsModule !== undefined ? { enableNotificationsModule: dto.enableNotificationsModule } : {}),
        ...(dto.interesAcreedoresHabilitado !== undefined ? { interesAcreedoresHabilitado: dto.interesAcreedoresHabilitado } : {}),
        ...(dto.tasaInteresMensualAcreedores !== undefined ? { tasaInteresMensualAcreedores: dto.tasaInteresMensualAcreedores } : {}),
        ...(dto.whatsappUseApi !== undefined ? { whatsappUseApi: dto.whatsappUseApi } : {}),
        ...(dto.whatsappWebMessage !== undefined ? { whatsappWebMessage: dto.whatsappWebMessage } : {}),
        ...(dto.whatsappPhoneNumberId !== undefined ? { whatsappPhoneNumberId: dto.whatsappPhoneNumberId } : {}),
        ...(dto.whatsappAccessToken !== undefined ? { whatsappAccessToken: dto.whatsappAccessToken } : {}),
        ...(dto.whatsappBusinessAccountId !== undefined ? { whatsappBusinessAccountId: dto.whatsappBusinessAccountId } : {}),
        ...(dto.whatsappWebhookVerifyToken !== undefined ? { whatsappWebhookVerifyToken: dto.whatsappWebhookVerifyToken } : {}),
        ...(dto.clubAlias !== undefined ? { clubAlias: dto.clubAlias } : {}),
        ...(dto.whatsappVariableOrder !== undefined ? { whatsappVariableOrder: dto.whatsappVariableOrder } : {}),
        ...(dto.whatsappTemplateName !== undefined ? { whatsappTemplateName: dto.whatsappTemplateName } : {}),
        ...(dto.whatsappAppSecret !== undefined ? { whatsappAppSecret: dto.whatsappAppSecret } : {}),
        ...(dto.movementInReasons !== undefined ? { movementInReasons: dto.movementInReasons } : {}),
        ...(dto.movementOutReasons !== undefined ? { movementOutReasons: dto.movementOutReasons } : {}),
      },
    });

    if (dto.enableInternetModule !== undefined) {
      await this.prisma.category.updateMany({
        where: { name: 'Internet' },
        data: { active: dto.enableInternetModule },
      });
    }

    return this.get();
  }
}
