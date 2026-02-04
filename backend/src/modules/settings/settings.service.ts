import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

const DEFAULT_SETTING_ID = '941abb3e-8bf2-4f08-b443-b3c98bd0b5ca';
const DEFAULT_STORE_NAME = 'MiBPS Demo';
const DEFAULT_ACCENT_COLOR = '#0ea5e9';
const DEFAULT_CLUB_NAME = '';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async get() {
    return this.prisma.setting.upsert({
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
      },
      update: {},
    });
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
      },
    });
  }
}
