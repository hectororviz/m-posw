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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MercadoPagoWebhookController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoPagoWebhookController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mercadopago_webhook_processor_service_1 = require("../services/mercadopago-webhook-processor.service");
const mercadopago_webhook_utils_1 = require("./mercadopago-webhook.utils");
let MercadoPagoWebhookController = MercadoPagoWebhookController_1 = class MercadoPagoWebhookController {
    constructor(config, processor) {
        this.config = config;
        this.processor = processor;
        this.logger = new common_1.Logger(MercadoPagoWebhookController_1.name);
    }
    async handleWebhook(headers, body, query, request, response) {
        this.logger.log(`WEBHOOK_RECEIVED ${JSON.stringify({
            method: request.method,
            url: request.originalUrl ?? request.url,
            query,
            headers,
            body,
        })}`);
        const resourceId = (0, mercadopago_webhook_utils_1.getResourceId)({ query, body });
        if (!resourceId) {
            this.logger.warn('WEBHOOK_MP_PAYMENT_ID_MISSING');
            response.status(200).json({ ok: true });
            return;
        }
        const topic = (typeof body?.topic === 'string' && body.topic) ||
            (typeof body?.type === 'string' && body.type) ||
            query?.topic ||
            query?.type ||
            'unknown';
        const manifestId = (0, mercadopago_webhook_utils_1.getManifestId)({ topic, body, query });
        const signatureResult = this.verifySignature({ headers, body }, manifestId, resourceId, topic);
        if (!signatureResult.isValid && signatureResult.shouldReject) {
            response.status(401).json({ ok: false });
            return;
        }
        response.status(200).json({ ok: true });
        setImmediate(() => {
            void this.processor
                .processWebhook({
                body,
                query,
                resourceId,
                requestId: signatureResult.requestId,
                topic,
            })
                .catch((error) => {
                const message = error instanceof Error ? error.stack ?? error.message : String(error);
                this.logger.error(`WEBHOOK_PROCESSING_FAILED ${message}`);
            });
        });
    }
    verifySignature(req, manifestId, resourceId, topic) {
        const isProduction = this.config.get('NODE_ENV') === 'production';
        const secret = this.config.get('MP_WEBHOOK_SECRET');
        const strictPayment = this.isStrictPaymentEnabled();
        if (!secret) {
            if (isProduction) {
                this.logger.error('WEBHOOK_MP_SECRET_MISSING');
                if (topic === 'payment' && strictPayment) {
                    return { isValid: false, shouldReject: true };
                }
                return { isValid: false, shouldReject: false };
            }
            this.logger.warn('WEBHOOK_MP_SECRET_MISSING_NON_STRICT');
            return { isValid: true, requestId: undefined, shouldReject: false };
        }
        const result = (0, mercadopago_webhook_utils_1.verifySignature)({ headers: req.headers }, manifestId, secret);
        const receivedSignatureSnippet = result.v1?.slice(0, 8) ?? 'unknown';
        const calculatedHashSnippet = result.digest?.slice(0, 8) ?? 'unknown';
        const manifestHash = result.manifestHash ?? null;
        this.logger.debug(`WEBHOOK_MP_SIGNATURE_DEBUG received=${receivedSignatureSnippet} calculated=${calculatedHashSnippet} manifestSha256=${manifestHash ?? 'unknown'}`);
        if (!result.isValid) {
            this.logger.warn(`WEBHOOK_MP_SIGNATURE_INVALID ts=${result.ts ?? 'unknown'} received=${receivedSignatureSnippet} calculated=${calculatedHashSnippet} resourceId=${resourceId} requestId=${result.requestId ?? 'unknown'}`);
            if (topic === 'merchant_order') {
                this.logger.warn(`WEBHOOK_MP_SIGNATURE_INVALID_NON_STRICT topic=merchant_order requestId=${result.requestId ?? 'unknown'}`);
                return { isValid: false, requestId: result.requestId, shouldReject: false };
            }
            return {
                isValid: false,
                requestId: result.requestId,
                shouldReject: topic === 'payment' && strictPayment,
            };
        }
        if (topic === 'merchant_order') {
            this.logger.log(`WEBHOOK_MP_SIGNATURE_VALID topic=merchant_order requestId=${result.requestId ?? 'unknown'}`);
        }
        return { isValid: true, requestId: result.requestId, shouldReject: false };
    }
    isStrictPaymentEnabled() {
        const raw = this.config.get('MP_WEBHOOK_STRICT_PAYMENT');
        if (raw === true || raw === 'true' || raw === '1') {
            return true;
        }
        if (raw === false || raw === 'false' || raw === '0' || raw === undefined || raw === null) {
            return false;
        }
        return Boolean(raw);
    }
};
exports.MercadoPagoWebhookController = MercadoPagoWebhookController;
__decorate([
    (0, common_1.Post)('mercadopago'),
    __param(0, (0, common_1.Headers)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)()),
    __param(3, (0, common_1.Req)()),
    __param(4, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], MercadoPagoWebhookController.prototype, "handleWebhook", null);
exports.MercadoPagoWebhookController = MercadoPagoWebhookController = MercadoPagoWebhookController_1 = __decorate([
    (0, common_1.Controller)('webhooks'),
    __metadata("design:paramtypes", [config_1.ConfigService,
        mercadopago_webhook_processor_service_1.MercadoPagoWebhookProcessorService])
], MercadoPagoWebhookController);
