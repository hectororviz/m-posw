"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MercadoPagoOauthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoPagoOauthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const mp_config_service_1 = require("../common/mp-config.service");
const prisma_service_1 = require("../common/prisma.service");
const DEFAULT_SETTING_ID = '941abb3e-8bf2-4f08-b443-b3c98bd0b5ca';
let MercadoPagoOauthService = MercadoPagoOauthService_1 = class MercadoPagoOauthService {
    constructor(prisma, config, mpConfig) {
        this.prisma = prisma;
        this.config = config;
        this.mpConfig = mpConfig;
        this.logger = new common_1.Logger(MercadoPagoOauthService_1.name);
    }
    generateConnectUrl() {
        const clientId = this.config.get('MP_CLIENT_ID');
        if (!clientId) {
            throw new common_1.HttpException('MP_CLIENT_ID no configurado', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        const redirectUri = this.config.get('MP_OAUTH_REDIRECT_URI');
        if (!redirectUri) {
            throw new common_1.HttpException('MP_OAUTH_REDIRECT_URI no configurado', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        const subdomain = this.config.get('INSTANCE_SUBDOMAIN') || 'default';
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
    async exchangeToken(code) {
        const clientId = this.config.get('MP_CLIENT_ID');
        const clientSecret = this.config.get('MP_CLIENT_SECRET');
        const redirectUri = this.config.get('MP_OAUTH_REDIRECT_URI');
        if (!clientId || !clientSecret || !redirectUri) {
            throw new common_1.HttpException('Faltan credenciales OAuth de MercadoPago (MP_CLIENT_ID, MP_CLIENT_SECRET, MP_OAUTH_REDIRECT_URI)', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        const body = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        });
        let tokenData;
        try {
            const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
            if (process.env.MP_INTEGRATOR_ID) {
                headers['X-Integrator-Id'] = process.env.MP_INTEGRATOR_ID;
            }
            const response = await fetch('https://api.mercadopago.com/oauth/token', {
                method: 'POST',
                headers,
                body: body.toString(),
            });
            tokenData = (await response.json());
            if (!response.ok || !tokenData.access_token) {
                this.logger.error(`MP OAuth token exchange failed: ${JSON.stringify(tokenData)}`);
                throw new common_1.HttpException('Error al intercambiar el código por token de MercadoPago', common_1.HttpStatus.BAD_GATEWAY);
            }
        }
        catch (error) {
            if (error instanceof common_1.HttpException)
                throw error;
            this.logger.error(`MP OAuth token exchange network error: ${error}`);
            throw new common_1.HttpException('Error de red al intercambiar el código por token de MercadoPago', common_1.HttpStatus.BAD_GATEWAY);
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
    async getStatus() {
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
    async disconnect() {
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
    async detectStores() {
        return this.detectStoresInternal();
    }
    async detectStoresInternal() {
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
        const mpHeaders = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
        if (process.env.MP_INTEGRATOR_ID) {
            mpHeaders['X-Integrator-Id'] = process.env.MP_INTEGRATOR_ID;
        }
        let posList = [];
        try {
            const posRes = await fetch('https://api.mercadopago.com/pos', {
                method: 'GET',
                headers: mpHeaders,
            });
            if (!posRes.ok) {
                this.logger.error(`MP detect stores - pos list failed: HTTP ${posRes.status}`);
                return { status: 'no_stores' };
            }
            const data = await posRes.json();
            posList = data.results ?? [];
            if (!Array.isArray(posList) && Array.isArray(data)) {
                posList = data;
            }
        }
        catch (error) {
            this.logger.error(`MP detect stores - pos list network error: ${error}`);
            return { status: 'no_stores' };
        }
        if (!posList || posList.length === 0) {
            return { status: 'no_stores' };
        }
        const storeMap = new Map();
        for (const pos of posList) {
            const storeId = pos.store_id;
            if (!storeMap.has(storeId)) {
                storeMap.set(storeId, {
                    id: storeId,
                    name: pos.external_store_id ? `Tienda ${pos.external_store_id}` : `Tienda ${storeId}`,
                    address: '',
                    pos: [],
                });
            }
            storeMap.get(storeId).pos.push({
                id: String(pos.id),
                name: pos.name,
                qrUrl: pos.qr?.image ?? '',
            });
        }
        return { status: 'found_stores', stores: Array.from(storeMap.values()) };
    }
    async selectStore(storeId, posId) {
        const token = await this.mpConfig.getAccessToken();
        if (!token) {
            throw new common_1.HttpException('Sin access token de MercadoPago', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        const mpHeaders = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
        if (process.env.MP_INTEGRATOR_ID) {
            mpHeaders['X-Integrator-Id'] = process.env.MP_INTEGRATOR_ID;
        }
        let posName;
        let qrData;
        let externalPosId;
        let externalStoreId;
        try {
            const posRes = await fetch(`https://api.mercadopago.com/pos/${posId}`, {
                method: 'GET',
                headers: mpHeaders,
            });
            if (!posRes.ok) {
                this.logger.error(`MP select store - fetch pos failed: HTTP ${posRes.status}`);
                throw new common_1.HttpException('Error al obtener el POS de MercadoPago', common_1.HttpStatus.BAD_REQUEST);
            }
            const posData = (await posRes.json());
            posName = posData.name ?? '';
            qrData = posData.qr?.image ?? '';
            externalPosId = posData.external_id ?? posId;
            externalStoreId = posData.external_store_id ?? storeId;
        }
        catch (error) {
            if (error instanceof common_1.HttpException)
                throw error;
            this.logger.error(`MP select store - pos network error: ${error}`);
            throw new common_1.HttpException('Error de red al obtener el POS de MP', common_1.HttpStatus.BAD_GATEWAY);
        }
        await this.prisma.setting.upsert({
            where: { id: DEFAULT_SETTING_ID },
            create: {
                id: DEFAULT_SETTING_ID,
                storeName: 'MiBPS Demo',
                mpStoreId: storeId,
                mpPosId: posId,
                mpStoreName: `Tienda ${storeId}`,
                mpPosName: posName,
                mpQrData: qrData,
                mpExternalPosId: externalPosId,
                mpExternalStoreId: externalStoreId,
            },
            update: {
                mpStoreId: storeId,
                mpPosId: posId,
                mpStoreName: `Tienda ${storeId}`,
                mpPosName: posName,
                mpQrData: qrData,
                mpExternalPosId: externalPosId,
                mpExternalStoreId: externalStoreId,
            },
        });
        this.logger.log(`MP store/pos seleccionados: storeId=${storeId}, posId=${posId}`);
        return { ok: true, qrUrl: qrData };
    }
    async setupPos(storeName, posName, streetName, streetNumber, cityName, stateName, zipCode) {
        const token = await this.mpConfig.getAccessToken();
        if (!token) {
            throw new common_1.HttpException('Sin access token de MercadoPago', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        const collectorId = await this.mpConfig.getCollectorId();
        if (!collectorId) {
            throw new common_1.HttpException('Sin collectorId de MercadoPago', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        const subdomain = this.config.get('INSTANCE_SUBDOMAIN') || 'default';
        const mpHeaders = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
        if (process.env.MP_INTEGRATOR_ID) {
            mpHeaders['X-Integrator-Id'] = process.env.MP_INTEGRATOR_ID;
        }
        let storeId;
        try {
            const storeRes = await fetch(`https://api.mercadopago.com/users/${collectorId}/stores`, {
                method: 'POST',
                headers: mpHeaders,
                body: JSON.stringify({
                    name: storeName,
                    location: {
                        street_name: streetName,
                        street_number: streetNumber,
                        city_name: cityName,
                        state_name: stateName,
                        zip_code: zipCode,
                        latitude: -34.603722,
                        longitude: -58.381592,
                    },
                }),
            });
            const storeData = (await storeRes.json());
            if (!storeRes.ok || !storeData.id) {
                this.logger.error(`MP POS setup - store creation failed: ${JSON.stringify(storeData)}`);
                throw new common_1.HttpException(storeData.message || 'Error al crear la tienda en MercadoPago', common_1.HttpStatus.BAD_REQUEST);
            }
            storeId = storeData.id;
        }
        catch (error) {
            if (error instanceof common_1.HttpException)
                throw error;
            this.logger.error(`MP POS setup - store network error: ${error}`);
            throw new common_1.HttpException('Error de red al crear la tienda en MP', common_1.HttpStatus.BAD_GATEWAY);
        }
        let posId;
        let qrData;
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
            const posData = (await posRes.json());
            if (!posRes.ok || !posData.id) {
                this.logger.error(`MP POS setup - pos creation failed: ${JSON.stringify(posData)}`);
                throw new common_1.HttpException(posData.message || 'Error al crear el POS en MercadoPago', common_1.HttpStatus.BAD_REQUEST);
            }
            posId = posData.id;
            qrData = posData.qr?.image ?? '';
        }
        catch (error) {
            if (error instanceof common_1.HttpException)
                throw error;
            this.logger.error(`MP POS setup - pos network error: ${error}`);
            throw new common_1.HttpException('Error de red al crear el POS en MP', common_1.HttpStatus.BAD_GATEWAY);
        }
        const externalPosId = `${subdomain}_pos`;
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
                mpExternalPosId: externalPosId,
                mpExternalStoreId: storeId,
            },
            update: {
                mpStoreId: storeId,
                mpPosId: posId,
                mpStoreName: storeName,
                mpPosName: posName,
                mpQrData: qrData,
                mpExternalPosId: externalPosId,
                mpExternalStoreId: storeId,
            },
        });
        this.logger.log(`MP POS configurado: storeId=${storeId}, posId=${posId}`);
        return { ok: true, qrUrl: qrData };
    }
    async getQr() {
        const setting = await this.prisma.setting.findUnique({
            where: { id: DEFAULT_SETTING_ID },
            select: { mpQrData: true },
        });
        if (!setting?.mpQrData) {
            throw new common_1.HttpException('QR no configurado', common_1.HttpStatus.NOT_FOUND);
        }
        return { qrUrl: setting.mpQrData };
    }
    async deletePosSetup() {
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
                mpExternalPosId: null,
                mpExternalStoreId: null,
            },
            update: {
                mpStoreId: null,
                mpPosId: null,
                mpStoreName: null,
                mpPosName: null,
                mpQrData: null,
                mpExternalPosId: null,
                mpExternalStoreId: null,
            },
        });
        this.logger.log('MP POS setup limpiado de la BD');
        return { ok: true };
    }
    async handleTokenRefresh() {
        this.logger.debug('Cron: verificando renovacion proactiva de token MP...');
        await this.mpConfig.tryRefreshToken();
    }
};
exports.MercadoPagoOauthService = MercadoPagoOauthService;
__decorate([
    (0, schedule_1.Cron)('0 0 */6 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MercadoPagoOauthService.prototype, "handleTokenRefresh", null);
exports.MercadoPagoOauthService = MercadoPagoOauthService = MercadoPagoOauthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        mp_config_service_1.MercadoPagoConfigService])
], MercadoPagoOauthService);
