import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

const DEFAULT_SETTING_ID = '941abb3e-8bf2-4f08-b443-b3c98bd0b5ca';

@Injectable()
export class MercadoPagoConfigService {
  private readonly logger = new Logger(MercadoPagoConfigService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async getAccessToken(): Promise<string> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { id: DEFAULT_SETTING_ID },
        select: { mpLinked: true, mpAccessToken: true },
      });

      if (setting?.mpLinked && setting.mpAccessToken) {
        return setting.mpAccessToken;
      }
    } catch (error) {
      this.logger.warn('No se pudo leer el token OAuth de la DB, usando fallback de .env');
    }

    const envToken = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!envToken) {
      this.logger.error('MP_ACCESS_TOKEN no configurado (ni en DB ni en .env)');
    }
    return envToken ?? '';
  }
}
