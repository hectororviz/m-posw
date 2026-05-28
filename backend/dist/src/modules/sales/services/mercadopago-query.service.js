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
var MercadoPagoQueryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoPagoQueryService = void 0;
const common_1 = require("@nestjs/common");
const mp_config_service_1 = require("../../common/mp-config.service");
let MercadoPagoQueryService = MercadoPagoQueryService_1 = class MercadoPagoQueryService {
    constructor(mpConfig) {
        this.mpConfig = mpConfig;
        this.baseUrl = 'https://api.mercadopago.com';
        this.timeoutMs = 8000;
        this.logger = new common_1.Logger(MercadoPagoQueryService_1.name);
    }
    getPayment(paymentId) {
        return this.request('GET', `${this.baseUrl}/v1/payments/${paymentId}`);
    }
    getMerchantOrder(merchantOrderId) {
        return this.request('GET', `${this.baseUrl}/merchant_orders/${merchantOrderId}`);
    }
    getMerchantOrderByResource(resource, fallbackId) {
        const resolvedUrl = this.resolveMerchantOrderUrl(resource);
        if (resolvedUrl) {
            return this.request('GET', resolvedUrl);
        }
        if (fallbackId) {
            return this.getMerchantOrder(fallbackId);
        }
        throw new common_1.HttpException('Merchant order resource no configurado', common_1.HttpStatus.BAD_REQUEST);
    }
    searchPaymentsByExternalReference(externalReference) {
        const encoded = encodeURIComponent(externalReference);
        return this.request('GET', `${this.baseUrl}/v1/payments/search?external_reference=${encoded}`);
    }
    async request(method, url) {
        const token = await this.mpConfig.getAccessToken();
        if (!token) {
            throw new common_1.HttpException('MP_ACCESS_TOKEN no configurado', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        this.logger.debug(`Mercado Pago query: ${method} ${url}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const headers = { Authorization: `Bearer ${token}` };
            if (process.env.MP_INTEGRATOR_ID) {
                headers['X-Integrator-Id'] = process.env.MP_INTEGRATOR_ID;
            }
            const response = await fetch(url, {
                method,
                headers,
                signal: controller.signal,
            });
            const text = await response.text();
            if (!response.ok) {
                this.logger.error(`Mercado Pago query error ${response.status}: ${text}`);
                throw new common_1.HttpException(`Mercado Pago error ${response.status} en ${method} ${url}: ${text}`, common_1.HttpStatus.BAD_GATEWAY);
            }
            return (text ? JSON.parse(text) : {});
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`No se pudo comunicar con Mercado Pago al llamar ${method} ${url}`, common_1.HttpStatus.BAD_GATEWAY);
        }
        finally {
            clearTimeout(timeout);
        }
    }
    resolveMerchantOrderUrl(resource) {
        if (!resource) {
            return null;
        }
        const trimmed = resource.trim();
        if (!trimmed) {
            return null;
        }
        try {
            const url = new URL(trimmed);
            if (this.isAllowedMerchantOrderHost(url.hostname) && url.pathname.includes('/merchant_orders/')) {
                return url.toString();
            }
        }
        catch {
        }
        const match = trimmed.match(/merchant_orders\/(\d+)/);
        if (match?.[1]) {
            return `${this.baseUrl}/merchant_orders/${match[1]}`;
        }
        return null;
    }
    isAllowedMerchantOrderHost(hostname) {
        return hostname.endsWith('mercadopago.com') || hostname.endsWith('mercadolibre.com');
    }
};
exports.MercadoPagoQueryService = MercadoPagoQueryService;
exports.MercadoPagoQueryService = MercadoPagoQueryService = MercadoPagoQueryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mp_config_service_1.MercadoPagoConfigService])
], MercadoPagoQueryService);
