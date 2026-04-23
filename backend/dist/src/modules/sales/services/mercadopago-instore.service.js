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
var MercadoPagoInstoreService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoPagoInstoreService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let MercadoPagoInstoreService = MercadoPagoInstoreService_1 = class MercadoPagoInstoreService {
    constructor(config) {
        this.config = config;
        this.baseUrl = 'https://api.mercadopago.com';
        this.timeoutMs = 15000;
        this.logger = new common_1.Logger(MercadoPagoInstoreService_1.name);
        this.notificationUrl = 'https://pos.csdsoler.com.ar/api/webhooks/mercadopago';
    }
    async createOrUpdateOrder(input) {
        const url = this.buildOrdersUrl(input.externalStoreId, input.externalPosId);
        this.assertExternalId('externalStoreId', input.externalStoreId);
        this.assertExternalId('externalPosId', input.externalPosId);
        const payload = this.buildPayload(input.sale);
        const itemsTotal = payload.items.reduce((sum, item) => sum + item.total_amount, 0);
        this.logger.debug(`Mercado Pago payload summary: total_amount=${payload.total_amount} items_len=${payload.items.length} items_sum=${this.roundToCurrency(itemsTotal)}`);
        this.logger.debug(`Mercado Pago payload titles: title=${payload.title} first_item_title=${payload.items[0]?.title ?? 'n/a'}`);
        this.logger.debug(`Mercado Pago request: PUT ${url} (collectorId=${this.getCollectorId()}, externalStoreId=${input.externalStoreId}, externalPosId=${input.externalPosId})`);
        await this.request('PUT', url, payload);
    }
    async deleteOrder(input) {
        const url = this.buildPosOrdersUrl(input.externalPosId);
        this.assertExternalId('externalStoreId', input.externalStoreId);
        this.assertExternalId('externalPosId', input.externalPosId);
        this.logger.debug(`Mercado Pago request: DELETE ${url} (collectorId=${this.getCollectorId()}, externalStoreId=${input.externalStoreId}, externalPosId=${input.externalPosId})`);
        await this.request('DELETE', url);
    }
    async getPayment(paymentId) {
        const url = `${this.baseUrl}/v1/payments/${paymentId}`;
        return this.request('GET', url);
    }
    async getPosInfo(posId) {
        const url = `${this.baseUrl}/pos/${posId}`;
        return this.request('GET', url);
    }
    buildPayload(sale) {
        this.parseNumber(sale.total, 'total');
        const currencyId = this.getCurrencyId();
        const saleIdLabel = sale.id ? String(sale.id).trim() : '';
        const saleTitle = this.ensureNonEmptyText(saleIdLabel ? `Venta ${saleIdLabel}` : 'Venta POS', 'title');
        const saleDescription = this.ensureNonEmptyText(saleIdLabel ? `Sale ${saleIdLabel}` : 'Sale POS', 'description');
        const items = sale.items.map((item) => {
            const quantityValue = this.parseNumber(item.quantity, 'quantity');
            const quantity = Math.trunc(quantityValue);
            if (!Number.isFinite(quantityValue) || quantity <= 0 || quantity !== quantityValue) {
                throw new common_1.HttpException('Cantidad inválida en los items de la venta', common_1.HttpStatus.BAD_REQUEST);
            }
            const hasSubtotal = item.subtotal !== null && item.subtotal !== undefined;
            const unitPrice = hasSubtotal
                ? this.parseNumber(item.subtotal, 'subtotal') / quantity
                : this.parseNumber(item.product?.price, 'price');
            if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
                throw new common_1.HttpException('Precio inválido en los items de la venta', common_1.HttpStatus.BAD_REQUEST);
            }
            const title = this.normalizeText(item.product?.name, 'Item');
            const description = this.normalizeText(item.product?.name, 'Producto');
            const skuNumber = this.toSkuNumber(item.productId, item.id);
            const totalAmount = this.roundToCurrency(unitPrice * quantity);
            return {
                sku_number: skuNumber,
                category: 'POS',
                title,
                description,
                quantity,
                unit_price: unitPrice,
                unit_measure: 'unit',
                currency_id: currencyId,
                total_amount: totalAmount,
            };
        });
        const totalAmount = this.roundToCurrency(items.reduce((sum, item) => sum + item.total_amount, 0));
        if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
            throw new common_1.HttpException(`total_amount inválido en la venta (valor=${totalAmount})`, common_1.HttpStatus.BAD_REQUEST);
        }
        return {
            external_reference: `sale-${sale.id}`,
            title: saleTitle,
            description: saleDescription,
            total_amount: totalAmount,
            items,
            notification_url: this.notificationUrl,
        };
    }
    buildOrdersUrl(externalStoreId, externalPosId) {
        return `${this.baseUrl}/instore/qr/seller/collectors/${this.getCollectorId()}/stores/${externalStoreId}/pos/${externalPosId}/orders`;
    }
    buildPosOrdersUrl(externalPosId) {
        return `${this.baseUrl}/instore/qr/seller/collectors/${this.getCollectorId()}/pos/${externalPosId}/orders`;
    }
    getCollectorId() {
        const collectorId = this.config.get('MP_COLLECTOR_ID');
        if (!collectorId) {
            throw new common_1.HttpException('MP_COLLECTOR_ID no configurado', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        return collectorId;
    }
    getCurrencyId() {
        return this.config.get('MP_CURRENCY_ID') || 'ARS';
    }
    async request(method, url, payload) {
        const token = this.config.get('MP_ACCESS_TOKEN');
        if (!token) {
            throw new common_1.HttpException('MP_ACCESS_TOKEN no configurado', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        const isRecord = (value) => typeof value === 'object' && value !== null;
        const hasBody = typeof payload !== 'undefined';
        const payloadRecord = isRecord(payload) ? payload : undefined;
        const payloadSummary = payloadRecord
            ? {
                total_amount: payloadRecord.total_amount,
                items_length: Array.isArray(payloadRecord.items)
                    ? payloadRecord.items.length
                    : undefined,
                total_amount_type: typeof payloadRecord.total_amount,
            }
            : undefined;
        this.logger.debug(`Mercado Pago request dispatch: ${method} ${url} payload=${payloadSummary ? JSON.stringify(payloadSummary) : 'none'}`);
        const controller = new AbortController();
        let didTimeout = false;
        const timeout = setTimeout(() => {
            didTimeout = true;
            controller.abort();
        }, this.timeoutMs);
        const jsonBody = hasBody ? JSON.stringify(payload) : undefined;
        if (hasBody && !jsonBody) {
            throw new common_1.HttpException('Payload inválido para Mercado Pago', common_1.HttpStatus.BAD_REQUEST);
        }
        if (jsonBody) {
            const parsedBody = JSON.parse(jsonBody);
            if (isRecord(parsedBody)) {
                const jsonBodySummary = {
                    total_amount: parsedBody.total_amount,
                    items_length: Array.isArray(parsedBody.items) ? parsedBody.items.length : undefined,
                    total_amount_type: typeof parsedBody.total_amount,
                };
                this.logger.debug(`Mercado Pago jsonBody summary: ${JSON.stringify(jsonBodySummary)}`);
                if (parsedBody.total_amount === null || typeof parsedBody.total_amount === 'undefined') {
                    throw new common_1.HttpException('total_amount ausente en el payload para Mercado Pago', common_1.HttpStatus.BAD_REQUEST);
                }
            }
        }
        try {
            const headers = {
                Authorization: `Bearer ${token}`,
            };
            if (hasBody) {
                headers['Content-Type'] = 'application/json';
            }
            this.logger.debug(`Mercado Pago request config: ${method} ${url} body=${jsonBody ?? 'none'}`);
            const response = await fetch(url, {
                method,
                headers,
                body: jsonBody,
                signal: controller.signal,
            });
            const text = await response.text();
            if (!response.ok) {
                const error = {
                    response: { status: response.status, data: text },
                };
                throw error;
            }
            const bodyPreview = this.truncateText(text, 1024);
            const parsed = text ? this.safeJsonParse(text) : null;
            const keyFields = this.extractKeyFields(parsed);
            if (method === 'PUT' && url.includes('/instore/qr/')) {
                this.logger.log(`MP instore order OK status=${response.status} body_preview=${bodyPreview} key_fields=${JSON.stringify(keyFields)}`);
            }
            else {
                this.logger.debug(`Mercado Pago response OK status=${response.status} body_preview=${bodyPreview}`);
            }
            return (parsed ?? text);
        }
        catch (error) {
            if (typeof error === 'object' &&
                error !== null &&
                'response' in error &&
                error.response) {
                const response = error.response;
                this.logger.error(`Mercado Pago response error status=${response.status} data=${response.data}`);
                throw new common_1.HttpException(`Mercado Pago error ${response.status} en ${method} ${url}: ${response.data}`, common_1.HttpStatus.BAD_GATEWAY);
            }
            if (didTimeout) {
                this.logger.error(`Mercado Pago timeout after ${this.timeoutMs}ms on ${method} ${url}`);
            }
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            const errorCode = typeof error === 'object' && error !== null && 'code' in error
                ? String(error.code)
                : 'UNKNOWN';
            const errorMessage = typeof error === 'object' && error !== null && 'message' in error
                ? String(error.message)
                : String(error);
            this.logger.error(`Mercado Pago network error code=${errorCode} message=${errorMessage}`);
            throw new common_1.HttpException(`Mercado Pago network error: ${errorCode} ${errorMessage}`, common_1.HttpStatus.BAD_GATEWAY);
        }
        finally {
            clearTimeout(timeout);
        }
    }
    safeJsonParse(text) {
        try {
            return JSON.parse(text);
        }
        catch {
            return null;
        }
    }
    extractKeyFields(payload) {
        if (!payload) {
            return {};
        }
        const keyFields = {};
        const keys = [
            'id',
            'status',
            'status_detail',
            'external_reference',
            'qr_data',
            'merchant_order_id',
            'collector_id',
        ];
        keys.forEach((key) => {
            if (typeof payload[key] !== 'undefined') {
                keyFields[key] = payload[key];
            }
        });
        return keyFields;
    }
    truncateText(text, maxLength) {
        if (!text) {
            return '';
        }
        if (text.length <= maxLength) {
            return text;
        }
        return `${text.slice(0, maxLength)}...`;
    }
    parseNumber(value, field) {
        const parsed = this.toNumber(value);
        if (!Number.isFinite(parsed)) {
            throw new common_1.HttpException(`${field} inválido en la venta`, common_1.HttpStatus.BAD_REQUEST);
        }
        return parsed;
    }
    normalizeText(value, fallback) {
        const normalized = String(value ?? '').trim();
        if (normalized) {
            return normalized;
        }
        return fallback.trim() || fallback;
    }
    ensureNonEmptyText(value, field) {
        const normalized = String(value ?? '').trim();
        if (!normalized) {
            throw new common_1.HttpException(`${field} requerido en el payload de Mercado Pago`, common_1.HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }
    toSkuNumber(productId, itemId) {
        const raw = productId ? String(productId) : `saleitem${itemId}`;
        const sanitized = raw.replace(/[^a-zA-Z0-9]/g, '');
        if (!sanitized) {
            throw new common_1.HttpException('sku_number inválido en los items de la venta', common_1.HttpStatus.BAD_REQUEST);
        }
        return sanitized;
    }
    toNumber(value) {
        if (value && typeof value === 'object' && 'toNumber' in value) {
            const maybeDecimal = value;
            if (typeof maybeDecimal.toNumber === 'function') {
                return maybeDecimal.toNumber();
            }
        }
        if (typeof value === 'string') {
            return Number(value);
        }
        return Number(value);
    }
    roundToCurrency(value) {
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }
    assertExternalId(field, value) {
        const normalized = String(value ?? '').trim();
        if (!normalized) {
            throw new common_1.HttpException(`${field} requerido: configurá external IDs (external_pos_id/external_store_id)`, common_1.HttpStatus.BAD_REQUEST);
        }
        if (/^\d+$/.test(normalized)) {
            throw new common_1.HttpException(`${field} inválido: parece un ID numérico. Configurá el external_id correspondiente en Mercado Pago`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
};
exports.MercadoPagoInstoreService = MercadoPagoInstoreService;
exports.MercadoPagoInstoreService = MercadoPagoInstoreService = MercadoPagoInstoreService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MercadoPagoInstoreService);
