import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async get() {
    const setting = await this.prisma.setting.findFirst();
    if (setting) {
      return setting;
    }
    return this.prisma.setting.create({
      data: {
        storeName: 'MiBPS',
        logoUrl: null,
        faviconUrl: null,
        accentColor: '#0ea5e9',
      },
    });
  }

  async update(dto: UpdateSettingDto) {
    const existing = await this.prisma.setting.findFirst();
    if (!existing) {
      return this.prisma.setting.create({
        data: {
          storeName: dto.storeName || 'MiBPS',
          logoUrl: dto.logoUrl ?? null,
          faviconUrl: dto.faviconUrl ?? null,
          accentColor: dto.accentColor,
        },
      });
    }
    return this.prisma.setting.update({
      where: { id: existing.id },
      data: dto,
    });
  }
}
