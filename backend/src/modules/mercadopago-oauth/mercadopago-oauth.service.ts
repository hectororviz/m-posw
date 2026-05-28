import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { MercadoPagoConfigService } from '../common/mp-config.service';
import { PrismaService } from '../common/prisma.service';

const DEFAULT_SETTING_ID = '941abb3e-8bf2-4f08-b443-b3c98bd0b5ca';

@Injectable()
export class MercadoPagoOauthService {
  private readonly logger = new Logger(MercadoPagoOauthService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private mpConfig: MercadoPagoConfigService,
  ) {}

  generateConnectUrl(): { url: string } {
    const clientId = this.config.get<string>('MP_CLIENT_ID');
    if (!clientId) {
      throw new HttpException('MP_CLIENT_ID no configurado', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const redirectUri = this.config.get<string>('MP_OAUTH_REDIRECT_URI');
    if (!redirectUri) {
      throw new HttpException('MP_OAUTH_REDIRECT_URI no configurado', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const subdomain = this.config.get<string>('INSTANCE_SUBDOMAIN') || 'default';

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      platform_id: 'mp',
      state: subdomain,
      redirect_uri: redirectUri,
      scope: 'read write offline_access',
    });

    const url = `https://auth.mercadopago.com/authorization?${params.toString()}`;
    return { url };
  }

  async exchangeToken(code: string): Promise<{ ok: boolean }> {
    const clientId = this.config.get<string>('MP_CLIENT_ID');
    const clientSecret = this.config.get<string>('MP_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('MP_OAUTH_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      throw new HttpException(
        'Faltan credenciales OAuth de MercadoPago (MP_CLIENT_ID, MP_CLIENT_SECRET, MP_OAUTH_REDIRECT_URI)',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    let tokenData: {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      user_id?: number;
    };

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

      tokenData = (await response.json()) as typeof tokenData;

      if (!response.ok || !tokenData.access_token) {
        this.logger.error(`MP OAuth token exchange failed: ${JSON.stringify(tokenData)}`);
        throw new HttpException(
          'Error al intercambiar el código por token de MercadoPago',
          HttpStatus.BAD_GATEWAY,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`MP OAuth token exchange network error: ${error}`);
      throw new HttpException(
        'Error de red al intercambiar el código por token de MercadoPago',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : undefined;

    await this.prisma.setting.upsert({
      where: { id: DEFAULT_SETTING_ID },
      create: {
        id: DEFAULT_SETTING_ID,
        storeName: 'MiBPS Demo',
        mpAccessToken: tokenData.access_token,
        mpRefreshToken: tokenData.refresh_token ?? null,
        mpTokenExpiresAt: expiresAt ?? null,
        mpCollectorId: tokenData.user_id !== undefined ? String(tokenData.user_id) : null,
        mpLinked: true,
      },
      update: {
        mpAccessToken: tokenData.access_token,
        mpRefreshToken: tokenData.refresh_token ?? null,
        mpTokenExpiresAt: expiresAt ?? null,
        mpCollectorId: tokenData.user_id !== undefined ? String(tokenData.user_id) : null,
        mpLinked: true,
      },
    });

    this.logger.log('MP OAuth token guardado correctamente en la BD');

    return { ok: true };
  }

  async getStatus(): Promise<{ linked: boolean; expiresAt: Date | null; mpPosId: string | null; mpQrData: string | null }> {
    const setting = await this.prisma.setting.findUnique({
      where: { id: DEFAULT_SETTING_ID },
      select: { mpLinked: true, mpTokenExpiresAt: true, mpPosId: true, mpQrData: true },
    });

    return {
      linked: setting?.mpLinked ?? false,
      expiresAt: setting?.mpTokenExpiresAt ?? null,
      mpPosId: setting?.mpPosId ?? null,
      mpQrData: setting?.mpQrData ?? null,
    };
  }

  async disconnect(): Promise<{ ok: boolean }> {
    await this.prisma.setting.upsert({
      where: { id: DEFAULT_SETTING_ID },
      create: {
        id: DEFAULT_SETTING_ID,
        storeName: 'MiBPS Demo',
        mpAccessToken: null,
        mpRefreshToken: null,
        mpTokenExpiresAt: null,
        mpLinked: false,
      },
      update: {
        mpAccessToken: null,
        mpRefreshToken: null,
        mpTokenExpiresAt: null,
        mpLinked: false,
      },
    });

    this.logger.log('MP OAuth desconectado, credenciales limpiadas de la BD');

    return { ok: true };
  }

  async setupPos(storeName: string, posName: string): Promise<{ ok: boolean; qrUrl: string }> {
    const token = await this.mpConfig.getAccessToken();
    if (!token) {
      throw new HttpException('Sin access token de MercadoPago', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const collectorId = await this.mpConfig.getCollectorId();
    if (!collectorId) {
      throw new HttpException('Sin collectorId de MercadoPago', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const subdomain = this.config.get<string>('INSTANCE_SUBDOMAIN') || 'default';

    const mpHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    if (process.env.MP_INTEGRATOR_ID) {
      mpHeaders['X-Integrator-Id'] = process.env.MP_INTEGRATOR_ID;
    }

    let storeId: string;

    try {
      const storeRes = await fetch(`https://api.mercadopago.com/users/${collectorId}/stores`, {
        method: 'POST',
        headers: mpHeaders,
        body: JSON.stringify({
          name: storeName,
          location: {
            street_name: '',
            street_number: '',
            city_name: '',
            state_name: '',
            country: 'AR',
          },
        }),
      });

      const storeData = (await storeRes.json()) as { id?: string; status?: number; message?: string };

      if (!storeRes.ok || !storeData.id) {
        this.logger.error(`MP POS setup - store creation failed: ${JSON.stringify(storeData)}`);
        throw new HttpException(
          storeData.message || 'Error al crear la tienda en MercadoPago',
          HttpStatus.BAD_REQUEST,
        );
      }

      storeId = storeData.id;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`MP POS setup - store network error: ${error}`);
      throw new HttpException('Error de red al crear la tienda en MP', HttpStatus.BAD_GATEWAY);
    }

    let posId: string;
    let qrData: string;

    try {
      const posRes = await fetch('https://api.mercadopago.com/pos', {
        method: 'POST',
        headers: mpHeaders,
        body: JSON.stringify({
          name: posName,
          store_id: storeId,
          category: 621102,
          external_id: `${subdomain}_pos`,
        }),
      });

      const posData = (await posRes.json()) as {
        id?: string;
        qr?: { image?: string };
        message?: string;
      };

      if (!posRes.ok || !posData.id) {
        this.logger.error(`MP POS setup - pos creation failed: ${JSON.stringify(posData)}`);
        throw new HttpException(
          posData.message || 'Error al crear el POS en MercadoPago',
          HttpStatus.BAD_REQUEST,
        );
      }

      posId = posData.id;
      qrData = posData.qr?.image ?? '';
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`MP POS setup - pos network error: ${error}`);
      throw new HttpException('Error de red al crear el POS en MP', HttpStatus.BAD_GATEWAY);
    }

    await this.prisma.setting.upsert({
      where: { id: DEFAULT_SETTING_ID },
      create: {
        id: DEFAULT_SETTING_ID,
        storeName: 'MiBPS Demo',
        mpStoreId: storeId,
        mpPosId: posId,
        mpStoreName: storeName,
        mpPosName: posName,
        mpQrData: qrData,
      },
      update: {
        mpStoreId: storeId,
        mpPosId: posId,
        mpStoreName: storeName,
        mpPosName: posName,
        mpQrData: qrData,
      },
    });

    this.logger.log(`MP POS configurado: storeId=${storeId}, posId=${posId}`);

    return { ok: true, qrUrl: qrData };
  }

  async getQr(): Promise<{ qrUrl: string }> {
    const setting = await this.prisma.setting.findUnique({
      where: { id: DEFAULT_SETTING_ID },
      select: { mpQrData: true },
    });

    if (!setting?.mpQrData) {
      throw new HttpException('QR no configurado', HttpStatus.NOT_FOUND);
    }

    return { qrUrl: setting.mpQrData };
  }

  async deletePosSetup(): Promise<{ ok: boolean }> {
    await this.prisma.setting.upsert({
      where: { id: DEFAULT_SETTING_ID },
      create: {
        id: DEFAULT_SETTING_ID,
        storeName: 'MiBPS Demo',
        mpStoreId: null,
        mpPosId: null,
        mpStoreName: null,
        mpPosName: null,
        mpQrData: null,
      },
      update: {
        mpStoreId: null,
        mpPosId: null,
        mpStoreName: null,
        mpPosName: null,
        mpQrData: null,
      },
    });

    this.logger.log('MP POS setup limpiado de la BD');

    return { ok: true };
  }

  @Cron('0 0 */6 * * *')
  async handleTokenRefresh() {
    this.logger.debug('Cron: verificando renovacion proactiva de token MP...');
    await this.mpConfig.tryRefreshToken();
  }
}
