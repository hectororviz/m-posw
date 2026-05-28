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

  async exchangeToken(code: string): Promise<{
    ok: boolean;
    detection: {
      status: 'already_configured' | 'no_stores' | 'found_stores';
      stores?: Array<{
        id: string;
        name: string;
        address: string;
        pos: Array<{ id: string; name: string; qrUrl: string }>;
      }>;
      storeId?: string;
      posId?: string;
      storeName?: string;
      posName?: string;
      qrUrl?: string;
    };
  }> {
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

    const detection = await this.detectStoresInternal();

    return { ok: true, detection };
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

  async detectStores(): Promise<{
    status: 'already_configured' | 'no_stores' | 'found_stores';
    stores?: Array<{
      id: string;
      name: string;
      address: string;
      pos: Array<{ id: string; name: string; qrUrl: string }>;
    }>;
    storeId?: string;
    posId?: string;
    storeName?: string;
    posName?: string;
    qrUrl?: string;
  }> {
    return this.detectStoresInternal();
  }

  private async detectStoresInternal(): Promise<{
    status: 'already_configured' | 'no_stores' | 'found_stores';
    stores?: Array<{
      id: string;
      name: string;
      address: string;
      pos: Array<{ id: string; name: string; qrUrl: string }>;
    }>;
    storeId?: string;
    posId?: string;
    storeName?: string;
    posName?: string;
    qrUrl?: string;
  }> {
    const setting = await this.prisma.setting.findUnique({
      where: { id: DEFAULT_SETTING_ID },
      select: { mpStoreId: true, mpPosId: true, mpStoreName: true, mpPosName: true, mpQrData: true },
    });

    if (setting?.mpStoreId && setting?.mpPosId) {
      return {
        status: 'already_configured',
        storeId: setting.mpStoreId,
        posId: setting.mpPosId,
        storeName: setting.mpStoreName ?? undefined,
        posName: setting.mpPosName ?? undefined,
        qrUrl: setting.mpQrData ?? undefined,
      };
    }

    const token = await this.mpConfig.getAccessToken();
    if (!token) {
      return { status: 'no_stores' };
    }

    const collectorId = await this.mpConfig.getCollectorId();
    if (!collectorId) {
      return { status: 'no_stores' };
    }

    const mpHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    if (process.env.MP_INTEGRATOR_ID) {
      mpHeaders['X-Integrator-Id'] = process.env.MP_INTEGRATOR_ID;
    }

    let storesData: Array<{
      id: string;
      name: string;
      location?: { address_line?: string };
    }> = [];

    try {
      const storesRes = await fetch(
        `https://api.mercadopago.com/users/${collectorId}/stores?limit=50`,
        { method: 'GET', headers: mpHeaders },
      );

      if (!storesRes.ok) {
        if (storesRes.status === 404) {
          return { status: 'no_stores' };
        }
        this.logger.error(`MP detect stores failed: HTTP ${storesRes.status}`);
        return { status: 'no_stores' };
      }

      const response = await storesRes.json();
      storesData = (response as { results?: typeof storesData })?.results ?? [];
      if (!Array.isArray(storesData) && Array.isArray(response)) {
        storesData = response as typeof storesData;
      }
    } catch (error) {
      this.logger.error(`MP detect stores network error: ${error}`);
      return { status: 'no_stores' };
    }

    if (!storesData || storesData.length === 0) {
      return { status: 'no_stores' };
    }

    const stores: Array<{
      id: string;
      name: string;
      address: string;
      pos: Array<{ id: string; name: string; qrUrl: string }>;
    }> = [];

    for (const store of storesData) {
      let posList: Array<{ id: string; name: string; qr?: { image?: string } }> = [];

      try {
        const posRes = await fetch(
          `https://api.mercadopago.com/pos?store_id=${store.id}`,
          { method: 'GET', headers: mpHeaders },
        );

        if (posRes.ok) {
          const posResponse = await posRes.json();
          posList = (posResponse as { results?: typeof posList })?.results ?? [];
          if (!Array.isArray(posList) && Array.isArray(posResponse)) {
            posList = posResponse as typeof posList;
          }
        }
      } catch (error) {
        this.logger.warn(`MP detect stores - failed to fetch POS for store ${store.id}: ${error}`);
      }

      stores.push({
        id: store.id,
        name: store.name,
        address: store.location?.address_line ?? '',
        pos: posList.map((p) => ({
          id: p.id,
          name: p.name,
          qrUrl: p.qr?.image ?? '',
        })),
      });
    }

    return { status: 'found_stores', stores };
  }

  async selectStore(
    storeId: string,
    posId: string,
  ): Promise<{ ok: boolean; qrUrl: string }> {
    const token = await this.mpConfig.getAccessToken();
    if (!token) {
      throw new HttpException('Sin access token de MercadoPago', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const collectorId = await this.mpConfig.getCollectorId();
    if (!collectorId) {
      throw new HttpException('Sin collectorId de MercadoPago', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const mpHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    if (process.env.MP_INTEGRATOR_ID) {
      mpHeaders['X-Integrator-Id'] = process.env.MP_INTEGRATOR_ID;
    }

    let storeName: string;

    try {
      const storeRes = await fetch(
        `https://api.mercadopago.com/users/${collectorId}/stores/${storeId}`,
        { method: 'GET', headers: mpHeaders },
      );

      if (!storeRes.ok) {
        this.logger.error(`MP select store - fetch store failed: HTTP ${storeRes.status}`);
        throw new HttpException('Error al obtener la tienda de MercadoPago', HttpStatus.BAD_REQUEST);
      }

      const storeData = (await storeRes.json()) as { name?: string };
      storeName = storeData.name ?? '';
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`MP select store - store network error: ${error}`);
      throw new HttpException('Error de red al obtener la tienda de MP', HttpStatus.BAD_GATEWAY);
    }

    let posName: string;
    let qrData: string;

    try {
      const posRes = await fetch(
        `https://api.mercadopago.com/pos/${posId}`,
        { method: 'GET', headers: mpHeaders },
      );

      if (!posRes.ok) {
        this.logger.error(`MP select store - fetch pos failed: HTTP ${posRes.status}`);
        throw new HttpException('Error al obtener el POS de MercadoPago', HttpStatus.BAD_REQUEST);
      }

      const posData = (await posRes.json()) as { name?: string; qr?: { image?: string } };
      posName = posData.name ?? '';
      qrData = posData.qr?.image ?? '';
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`MP select store - pos network error: ${error}`);
      throw new HttpException('Error de red al obtener el POS de MP', HttpStatus.BAD_GATEWAY);
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

    this.logger.log(`MP store/pos seleccionados: storeId=${storeId}, posId=${posId}`);

    return { ok: true, qrUrl: qrData };
  }

  async setupPos(
    storeName: string,
    posName: string,
    streetAddress: string,
    cityName: string,
    stateName: string,
    zipCode: string,
  ): Promise<{ ok: boolean; qrUrl: string }> {
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
            address_line: streetAddress,
            city_name: cityName,
            state_name: stateName,
            zip_code: zipCode,
            country_id: 'AR',
            latitude: -34.603722,
            longitude: -58.381592,
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
