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
      movementInReasons: settings.movementInReasons,
      movementOutReasons: settings.movementOutReasons,
    };
  }

  async update(dto: UpdateSettingDto) {
    return this.prisma.setting.upsert({
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
        ...(dto.movementInReasons !== undefined ? { movementInReasons: dto.movementInReasons } : {}),
        ...(dto.movementOutReasons !== undefined ? { movementOutReasons: dto.movementOutReasons } : {}),
      },
    });
  }
}
