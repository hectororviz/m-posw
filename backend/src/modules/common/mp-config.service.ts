import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

const DEFAULT_SETTING_ID = '941abb3e-8bf2-4f08-b443-b3c98bd0b5ca';
const RENEW_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutos

interface MpTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number;
}

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
        select: {
          mpLinked: true,
          mpAccessToken: true,
          mpRefreshToken: true,
          mpTokenExpiresAt: true,
        },
      });

      if (setting?.mpLinked && setting.mpAccessToken) {
        const needsRenewal =
          !setting.mpTokenExpiresAt ||
          setting.mpTokenExpiresAt.getTime() < Date.now() + RENEW_THRESHOLD_MS;

        if (needsRenewal && setting.mpRefreshToken) {
          this.logger.log('MP OAuth token proximo a expirar, renovando...');
          const newTokens = await this.callRefreshApi(setting.mpRefreshToken);
          if (newTokens) {
            return newTokens;
          }
          this.logger.warn('Renovacion de token MP fallida, usando token actual');
          return setting.mpAccessToken;
        }

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

  async getCollectorId(): Promise<string> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { id: DEFAULT_SETTING_ID },
        select: { mpLinked: true, mpCollectorId: true },
      });

      if (setting?.mpLinked && setting.mpCollectorId) {
        return setting.mpCollectorId;
      }
    } catch (error) {
      this.logger.warn('No se pudo leer mpCollectorId de la DB, usando fallback de .env');
    }

    const envCollectorId = this.config.get<string>('MP_COLLECTOR_ID');
    if (!envCollectorId) {
      this.logger.error('MP_COLLECTOR_ID no configurado (ni en DB ni en .env)');
    }
    return envCollectorId ?? '';
  }

  async tryRefreshToken(): Promise<void> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { id: DEFAULT_SETTING_ID },
        select: {
          mpLinked: true,
          mpRefreshToken: true,
          mpTokenExpiresAt: true,
        },
      });

      if (!setting?.mpLinked || !setting.mpRefreshToken) {
        return;
      }

      const expiresIn = setting.mpTokenExpiresAt
        ? setting.mpTokenExpiresAt.getTime() - Date.now()
        : 0;

      if (expiresIn > 24 * 60 * 60 * 1000) {
        return;
      }

      this.logger.log('Cron: renovando token MP proactivamente...');
      await this.callRefreshApi(setting.mpRefreshToken);
    } catch (error) {
      this.logger.warn(`Cron: renovacion de token MP fallida: ${error}`);
    }
  }

  private async callRefreshApi(refreshToken: string): Promise<string | null> {
    const clientId = this.config.get<string>('MP_CLIENT_ID');
    const clientSecret = this.config.get<string>('MP_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      this.logger.error('Faltan MP_CLIENT_ID o MP_CLIENT_SECRET para renovar token');
      return null;
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
      if (process.env.MP_INTEGRATOR_ID) {
        headers['X-Integrator-Id'] = process.env.MP_INTEGRATOR_ID;
      }
      const response = await fetch('https://api.mercadopago.com/oauth/token', {
        method: 'POST',
        headers,
        body: body.toString(),
      });

      const data = (await response.json()) as MpTokenResponse;

      if (!response.ok || !data.access_token) {
        this.logger.error(`MP OAuth refresh failed: ${JSON.stringify(data)}`);
        return null;
      }

      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined;

      const updateData: Record<string, unknown> = {
        mpAccessToken: data.access_token,
        mpRefreshToken: data.refresh_token ?? refreshToken,
        mpTokenExpiresAt: expiresAt ?? null,
        mpLinked: true,
      };

      if (data.user_id !== undefined) {
        updateData.mpCollectorId = String(data.user_id);
      }

      await this.prisma.setting.upsert({
        where: { id: DEFAULT_SETTING_ID },
        create: {
          id: DEFAULT_SETTING_ID,
          storeName: 'MiBPS Demo',
          ...updateData,
        } as any,
        update: updateData as any,
      });

      this.logger.log('MP OAuth token renovado exitosamente');

      return data.access_token;
    } catch (error) {
      this.logger.error(`MP OAuth refresh network error: ${error}`);
      return null;
    }
  }
}
