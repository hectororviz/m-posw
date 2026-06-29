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
var MercadoPagoConfigService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoPagoConfigService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("./prisma.service");
const DEFAULT_SETTING_ID = '941abb3e-8bf2-4f08-b443-b3c98bd0b5ca';
const RENEW_THRESHOLD_MS = 5 * 60 * 1000;
let MercadoPagoConfigService = MercadoPagoConfigService_1 = class MercadoPagoConfigService {
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
        this.logger = new common_1.Logger(MercadoPagoConfigService_1.name);
    }
    async getAccessToken() {
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
                const needsRenewal = !setting.mpTokenExpiresAt ||
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
        }
        catch (error) {
            this.logger.warn('No se pudo leer el token OAuth de la DB, usando fallback de .env');
        }
        const envToken = this.config.get('MP_ACCESS_TOKEN');
        if (!envToken) {
            this.logger.error('MP_ACCESS_TOKEN no configurado (ni en DB ni en .env)');
        }
        return envToken ?? '';
    }
    async getCollectorId() {
        try {
            const setting = await this.prisma.setting.findUnique({
                where: { id: DEFAULT_SETTING_ID },
                select: { mpLinked: true, mpCollectorId: true },
            });
            if (setting?.mpLinked && setting.mpCollectorId) {
                return setting.mpCollectorId;
            }
        }
        catch (error) {
            this.logger.warn('No se pudo leer mpCollectorId de la DB, usando fallback de .env');
        }
        const envCollectorId = this.config.get('MP_COLLECTOR_ID');
        if (!envCollectorId) {
            this.logger.error('MP_COLLECTOR_ID no configurado (ni en DB ni en .env)');
        }
        return envCollectorId ?? '';
    }
    async tryRefreshToken() {
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
        }
        catch (error) {
            this.logger.warn(`Cron: renovacion de token MP fallida: ${error}`);
        }
    }
    async callRefreshApi(refreshToken) {
        const clientId = this.config.get('MP_CLIENT_ID');
        const clientSecret = this.config.get('MP_CLIENT_SECRET');
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
            const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
            if (process.env.MP_INTEGRATOR_ID) {
                headers['X-Integrator-Id'] = process.env.MP_INTEGRATOR_ID;
            }
            const response = await fetch('https://api.mercadopago.com/oauth/token', {
                method: 'POST',
                headers,
                body: body.toString(),
            });
            const data = (await response.json());
            if (!response.ok || !data.access_token) {
                const { access_token, refresh_token, ...safeData } = data;
                this.logger.error(`MP OAuth refresh failed: ${JSON.stringify(safeData)}`);
                return null;
            }
            const expiresAt = data.expires_in
                ? new Date(Date.now() + data.expires_in * 1000)
                : undefined;
            const updateData = {
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
                },
                update: updateData,
            });
            this.logger.log('MP OAuth token renovado exitosamente');
            return data.access_token;
        }
        catch (error) {
            this.logger.error(`MP OAuth refresh network error: ${error}`);
            return null;
        }
    }
};
exports.MercadoPagoConfigService = MercadoPagoConfigService;
exports.MercadoPagoConfigService = MercadoPagoConfigService = MercadoPagoConfigService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], MercadoPagoConfigService);
