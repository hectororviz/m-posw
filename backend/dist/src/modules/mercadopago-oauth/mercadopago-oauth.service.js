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
const ML_TO_MP_STATE = {
    'Bs.As. Costa Atlántica': 'Buenos Aires',
    'Bs.As. G.B.A. Norte': 'Buenos Aires',
    'Bs.As. G.B.A. Oeste': 'Buenos Aires',
    'Bs.As. G.B.A. Sur': 'Buenos Aires',
    'Buenos Aires Interior': 'Buenos Aires',
};
function normalizeStateName(name) {
    return ML_TO_MP_STATE[name] || name;
}
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
                const { access_token, refresh_token, ...safeData } = tokenData;
                this.logger.error(`MP OAuth token exchange failed: ${JSON.stringify(safeData)}`);
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
                mpStoreId: String(storeId),
                mpPosId: String(posId),
                mpStoreName: `Tienda ${storeId}`,
                mpPosName: posName,
                mpQrData: qrData,
                mpExternalPosId: externalPosId,
                mpExternalStoreId: externalStoreId,
            },
            update: {
                mpStoreId: String(storeId),
                mpPosId: String(posId),
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
    async setupPos(storeName, posName, streetName, streetNumber, cityName, stateName, zipCode, latitude, longitude) {
        let resolvedCityName = cityName;
        let resolvedStateName = stateName;
        let mpCityMapping = await this.prisma.mpCityMapping.findUnique({
            where: { zipCode },
        });
        if (!mpCityMapping) {
            const numeric = zipCode.match(/\d{4}/);
            if (numeric) {
                mpCityMapping = await this.prisma.mpCityMapping.findUnique({
                    where: { zipCode: numeric[0] },
                });
            }
        }
        if (mpCityMapping) {
            resolvedCityName = mpCityMapping.cityName;
            resolvedStateName = normalizeStateName(mpCityMapping.stateName);
            this.logger.log(`[MpCityMapping] CP ${zipCode} resuelto a ciudad: ${resolvedCityName}`);
        }
        else {
            this.logger.warn(`[MpCityMapping] CP ${zipCode} no encontrado en tabla, usando ciudad del frontend: ${cityName}`);
        }
        const numericZipMatch = zipCode.match(/\d{4}/);
        const mpZipCode = numericZipMatch ? numericZipMatch[0] : zipCode;
        const token = await this.mpConfig.getAccessToken();
        if (!token) {
            throw new common_1.HttpException('Sin access token de MercadoPago', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        const collectorId = await this.mpConfig.getCollectorId();
        if (!collectorId) {
            throw new common_1.HttpException('Sin collectorId de MercadoPago', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        const subdomain = this.config.get('INSTANCE_SUBDOMAIN') || 'default';
        const safeSubdomain = subdomain.replace(/[^a-zA-Z0-9]/g, '');
        const externalPosId = `${safeSubdomain}pos${Math.floor(Date.now() / 1000)}`;
        this.logger.log(`[MpSetup] Generando POS con external_id: ${externalPosId}`);
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
                        city_name: resolvedCityName,
                        state_name: resolvedStateName,
                        zip_code: mpZipCode,
                        ...(latitude !== undefined && { latitude }),
                        ...(longitude !== undefined && { longitude }),
                    },
                }),
            });
            const storeData = (await storeRes.json());
            if (!storeRes.ok || !storeData.id) {
                this.logger.error(`MP POS setup - store creation failed: ${JSON.stringify(storeData)}`);
                const causeMessages = storeData.causes
                    ?.map((c) => c.description)
                    ?.join('; ');
                throw new common_1.HttpException(causeMessages || storeData.message || 'Error al crear la tienda en MercadoPago', common_1.HttpStatus.BAD_REQUEST);
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
                    external_id: externalPosId,
                }),
            });
            const posData = (await posRes.json());
            if (!posRes.ok || !posData.id) {
                this.logger.error(`MP POS setup - pos creation failed (external_id=${externalPosId}): ${JSON.stringify(posData)}`);
                const causeMessages = posData.causes
                    ?.map((c) => c.description)
                    ?.join('; ');
                throw new common_1.HttpException(causeMessages || posData.message || `Error al crear el POS en MercadoPago (external_id=${externalPosId})`, common_1.HttpStatus.BAD_REQUEST);
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
        await this.prisma.setting.upsert({
            where: { id: DEFAULT_SETTING_ID },
            create: {
                id: DEFAULT_SETTING_ID,
                storeName: 'MiBPS Demo',
                mpStoreId: String(storeId),
                mpPosId: String(posId),
                mpStoreName: storeName,
                mpPosName: posName,
                mpQrData: qrData,
                mpExternalPosId: externalPosId,
                mpExternalStoreId: String(storeId),
            },
            update: {
                mpStoreId: String(storeId),
                mpPosId: String(posId),
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
    async cityByZip(zipCode) {
        let mapping = await this.prisma.mpCityMapping.findUnique({
            where: { zipCode },
            select: { cityName: true, stateName: true },
        });
        if (!mapping) {
            const numeric = zipCode.match(/\d{4}/);
            if (numeric) {
                mapping = await this.prisma.mpCityMapping.findUnique({
                    where: { zipCode: numeric[0] },
                    select: { cityName: true, stateName: true },
                });
            }
        }
        return mapping ? { cityName: mapping.cityName, stateName: normalizeStateName(mapping.stateName) } : null;
    }
    async searchCities(query) {
        const rows = await this.prisma.$queryRawUnsafe(`SELECT DISTINCT city_name AS "cityName", state_name AS "stateName"
       FROM mp_city_mappings
       WHERE unaccent(city_name) ILIKE unaccent($1)
       ORDER BY city_name ASC
       LIMIT 20`, `%${query}%`);
        return rows.map((r) => ({ cityName: r.cityName, stateName: normalizeStateName(r.stateName) }));
    }
    async getMpCityList() {
        const rows = await this.prisma.mpCityMapping.findMany({
            distinct: ['cityName'],
            select: { cityName: true, stateName: true },
            orderBy: { cityName: 'asc' },
        });
        return rows.map((r) => ({
            cityName: normalizeStateName(r.cityName),
            stateName: normalizeStateName(r.stateName),
        }));
    }
    async getCityZipcodes(cityName) {
        const rows = await this.prisma.mpCityMapping.findMany({
            where: {
                OR: [
                    { cityName: { equals: cityName, mode: 'insensitive' } },
                    { cityName: { equals: cityName.replace(/[áéíóúÁÉÍÓÚ]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U' })[c]), mode: 'insensitive' } },
                ],
            },
            select: { zipCode: true },
            orderBy: { zipCode: 'asc' },
        });
        const zipCodes = rows.map((r) => r.zipCode);
        return { zipCodes };
    }
    async getCities(stateName) {
        const stateMap = {
            'Buenos Aires': 'AR-B',
            'Capital Federal': 'AR-C',
            'Catamarca': 'AR-K',
            'Chaco': 'AR-H',
            'Chubut': 'AR-U',
            'Cordoba': 'AR-X',
            'Corrientes': 'AR-W',
            'Entre Rios': 'AR-E',
            'Formosa': 'AR-P',
            'Jujuy': 'AR-Y',
            'La Pampa': 'AR-L',
            'La Rioja': 'AR-F',
            'Mendoza': 'AR-M',
            'Misiones': 'AR-N',
            'Neuquen': 'AR-Q',
            'Rio Negro': 'AR-R',
            'Salta': 'AR-A',
            'San Juan': 'AR-J',
            'San Luis': 'AR-D',
            'Santa Cruz': 'AR-Z',
            'Santa Fe': 'AR-S',
            'Santiago del Estero': 'AR-G',
            'Tierra del Fuego': 'AR-V',
            'Tucuman': 'AR-T',
        };
        const stateIds = stateName && stateMap[stateName]
            ? [stateMap[stateName]]
            : Object.values(stateMap);
        try {
            const allCities = [];
            for (const stateId of stateIds) {
                const res = await fetch(`https://api.mercadolibre.com/classified_locations/states/${stateId}`);
                if (!res.ok)
                    continue;
                const data = (await res.json());
                if (data.cities) {
                    for (const c of data.cities) {
                        allCities.push(c.name);
                    }
                }
            }
            const unique = [...new Set(allCities)].sort((a, b) => a.localeCompare(b, 'es'));
            return { cities: unique };
        }
        catch (error) {
            this.logger.error(`MP getCities error: ${error}`);
            return { cities: [] };
        }
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
