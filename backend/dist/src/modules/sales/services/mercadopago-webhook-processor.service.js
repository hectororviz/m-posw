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
var MercadoPagoWebhookProcessorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoPagoWebhookProcessorService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const mercadopago_query_service_1 = require("./mercadopago-query.service");
const sales_gateway_1 = require("../websockets/sales.gateway");
const mercadopago_webhook_utils_1 = require("../webhooks/mercadopago-webhook.utils");
let MercadoPagoWebhookProcessorService = MercadoPagoWebhookProcessorService_1 = class MercadoPagoWebhookProcessorService {
    constructor(prisma, mpQueryService, salesGateway) {
        this.prisma = prisma;
        this.mpQueryService = mpQueryService;
        this.salesGateway = salesGateway;
        this.logger = new common_1.Logger(MercadoPagoWebhookProcessorService_1.name);
        this.paymentRetryDelaysMs = [3000, 10000, 20000];
    }
    async processWebhook(payload) {
        const { topic, resourceId, requestId } = payload;
        const eventResourceId = resourceId ?? 'unknown';
        const shouldProcess = await this.ensureIdempotency(topic, eventResourceId);
        if (!shouldProcess) {
            return;
        }
        if (topic === 'merchant_order') {
            const resourceUrl = typeof payload.body?.resource === 'string' ? payload.body.resource : null;
            await this.processMerchantOrder(eventResourceId, resourceUrl, requestId);
            return;
        }
        if (topic !== 'payment') {
            this.logger.warn(`WEBHOOK_MP_TOPIC_UNSUPPORTED topic=${topic} resourceId=${eventResourceId}`);
            return;
        }
        await this.processPayment(eventResourceId, requestId, null);
    }
    async processMerchantOrder(merchantOrderId, resourceUrl, requestId) {
        if (!merchantOrderId || merchantOrderId === 'unknown') {
            this.logger.warn('WEBHOOK_MP_MERCHANT_ORDER_ID_MISSING');
            return;
        }
        try {
            const merchantOrder = await this.mpQueryService.getMerchantOrderByResource(resourceUrl, merchantOrderId);
            const merchantOrderPayload = (0, mercadopago_webhook_utils_1.isRecord)(merchantOrder) ? merchantOrder : null;
            const externalReference = (0, mercadopago_webhook_utils_1.extractExternalReference)(merchantOrderPayload);
            const payments = Array.isArray(merchantOrderPayload?.payments)
                ? (merchantOrderPayload?.payments).filter(mercadopago_webhook_utils_1.isRecord)
                : [];
            const selectedPayment = this.selectPaymentFromMerchantOrder(payments);
            const paymentIdValue = selectedPayment?.id ? String(selectedPayment.id) : null;
            this.logger.log(`WEBHOOK_MP_MERCHANT_ORDER_FETCHED merchantOrderId=${merchantOrderId} payments_len=${payments.length} requestId=${requestId ?? 'unknown'}`);
            if (!paymentIdValue) {
                await this.handleMerchantOrderWithoutPayments(merchantOrderId, externalReference, resourceUrl, merchantOrderPayload, requestId);
                return;
            }
            this.logger.log(`WEBHOOK_MP_MERCHANT_ORDER_PAYMENT_SELECTED merchantOrderId=${merchantOrderId} paymentId=${paymentIdValue} status=${selectedPayment?.status ?? 'unknown'} requestId=${requestId ?? 'unknown'}`);
            const saleOverride = await this.findSaleForMerchantOrder(externalReference, merchantOrderId, paymentIdValue);
            await this.processPayment(paymentIdValue, requestId, merchantOrderId, saleOverride, 'merchant_order');
        }
        catch (error) {
            this.logger.warn(`WEBHOOK_MP_MERCHANT_ORDER_LOOKUP_FAILED merchantOrderId=${merchantOrderId} requestId=${requestId ?? 'unknown'}`);
            if (error instanceof Error) {
                this.logger.debug(error.message);
            }
        }
    }
    async processPayment(paymentId, requestId, merchantOrderId, saleOverride, contextTopic = 'payment') {
        let mpData;
        try {
            mpData = await this.mpQueryService.getPayment(paymentId);
        }
        catch (error) {
            if (this.isPaymentNotFoundError(error)) {
                this.logger.warn(`WEBHOOK_IGNORED_PAYMENT_NOT_FOUND topic=${contextTopic} paymentId=${paymentId} requestId=${requestId ?? 'unknown'}`);
                return;
            }
            throw error;
        }
        const mpPayload = (0, mercadopago_webhook_utils_1.isRecord)(mpData) ? mpData : null;
        const externalReference = (0, mercadopago_webhook_utils_1.extractExternalReference)(mpPayload);
        const sale = saleOverride ||
            (externalReference
                ? await this.findSaleByExternalReference(externalReference, merchantOrderId ?? null, paymentId)
                : null) ||
            (paymentId
                ? await this.prisma.sale.findFirst({
                    where: { mpPaymentId: paymentId },
                })
                : null);
        if (!sale) {
            this.logger.warn(`WEBHOOK_MP_SALE_NOT_FOUND topic=${contextTopic} paymentId=${paymentId} requestId=${requestId ?? 'unknown'}`);
            return;
        }
        const mpStatus = typeof mpPayload?.status === 'string' ? mpPayload.status : null;
        const mpStatusDetail = typeof mpPayload?.status_detail === 'string' ? mpPayload.status_detail : null;
        const approvedAt = typeof mpPayload?.date_approved === 'string' ? new Date(mpPayload.date_approved) : null;
        const merchantOrderIdFromPayment = (0, mercadopago_webhook_utils_1.extractMerchantOrderId)(mpPayload);
        const nextPaymentStatus = (0, mercadopago_webhook_utils_1.mapMpPaymentToPaymentStatus)(mpStatus, mpStatusDetail, (normalizedStatus, normalizedDetail) => {
            this.logger.warn(`WEBHOOK_MP_STATUS_UNKNOWN topic=${contextTopic} paymentId=${paymentId} saleId=${sale.id} status=${normalizedStatus ?? 'unknown'} detail=${normalizedDetail ?? 'unknown'} requestId=${requestId ?? 'unknown'}`);
        });
        const nextSaleStatus = (0, mercadopago_webhook_utils_1.mapSaleStatus)(nextPaymentStatus);
        const finalMerchantOrderId = merchantOrderId ?? merchantOrderIdFromPayment ?? sale.mpMerchantOrderId ?? null;
        const resolvedSaleStatus = sale.status === client_1.SaleStatus.APPROVED ? client_1.SaleStatus.APPROVED : nextSaleStatus;
        const shouldUpdate = sale.paymentStatus !== nextPaymentStatus || sale.status !== resolvedSaleStatus;
        if (!shouldUpdate) {
            this.logger.log(`WEBHOOK_MP_STATUS_IDEMPOTENT topic=${contextTopic} paymentId=${paymentId} saleId=${sale.id} status=${sale.status} requestId=${requestId ?? 'unknown'}`);
            return;
        }
        const wasNotApproved = sale.status !== client_1.SaleStatus.APPROVED;
        const updateData = {
            paymentStatus: nextPaymentStatus,
            status: resolvedSaleStatus,
            paidAt: nextPaymentStatus === client_1.PaymentStatus.APPROVED
                ? approvedAt ?? new Date()
                : sale.paidAt,
            mpPaymentId: paymentId,
            mpMerchantOrderId: finalMerchantOrderId ?? undefined,
            mpStatus,
            mpStatusDetail,
            updatedAt: new Date(),
            mpRaw: (0, mercadopago_webhook_utils_1.toJsonValue)(mpPayload ?? mpData),
        };
        if (resolvedSaleStatus !== sale.status) {
            updateData.statusUpdatedAt = new Date();
        }
        const updatedSale = await this.prisma.sale.update({
            where: { id: sale.id },
            data: updateData,
        });
        if (wasNotApproved && resolvedSaleStatus === client_1.SaleStatus.APPROVED) {
            await this.decrementStockForSale(sale.id);
        }
        this.salesGateway.notifyPaymentStatusChanged({
            saleId: updatedSale.id,
            paymentStatus: updatedSale.paymentStatus,
            mpStatus: updatedSale.mpStatus,
            mpStatusDetail: updatedSale.mpStatusDetail,
        });
        this.logger.log(`WEBHOOK_MP_STATUS_UPDATED topic=${contextTopic} saleId=${updatedSale.id} merchantOrderId=${finalMerchantOrderId ?? 'unknown'} paymentId=${paymentId} status=${updatedSale.status} requestId=${requestId ?? 'unknown'}`);
    }
    async handleMerchantOrderWithoutPayments(merchantOrderId, externalReference, resourceUrl, merchantOrderPayload, requestId) {
        this.logger.log(`WEBHOOK_MP_MERCHANT_ORDER_NO_PAYMENTS merchantOrderId=${merchantOrderId} requestId=${requestId ?? 'unknown'}`);
        const sale = await this.findSaleForMerchantOrder(externalReference, merchantOrderId, null);
        if (!sale) {
            this.logger.warn(`WEBHOOK_MP_SALE_NOT_FOUND topic=merchant_order merchantOrderId=${merchantOrderId} requestId=${requestId ?? 'unknown'}`);
            this.schedulePaymentRetries({
                merchantOrderId,
                resourceUrl,
                externalReference,
                requestId,
            });
            return;
        }
        const resolvedSaleStatus = sale.status === client_1.SaleStatus.APPROVED ? client_1.SaleStatus.APPROVED : client_1.SaleStatus.PENDING;
        const shouldUpdate = sale.paymentStatus !== client_1.PaymentStatus.PENDING ||
            sale.status !== resolvedSaleStatus ||
            sale.mpMerchantOrderId !== merchantOrderId;
        if (!shouldUpdate) {
            this.logger.log(`WEBHOOK_MP_STATUS_IDEMPOTENT topic=merchant_order saleId=${sale.id} status=${sale.status} requestId=${requestId ?? 'unknown'}`);
            return;
        }
        const updateData = {
            paymentStatus: client_1.PaymentStatus.PENDING,
            status: resolvedSaleStatus,
            mpMerchantOrderId: merchantOrderId,
            updatedAt: new Date(),
            mpRaw: (0, mercadopago_webhook_utils_1.toJsonValue)(merchantOrderPayload),
        };
        if (resolvedSaleStatus !== sale.status) {
            updateData.statusUpdatedAt = new Date();
        }
        const updatedSale = await this.prisma.sale.update({
            where: { id: sale.id },
            data: updateData,
        });
        this.logger.log(`WEBHOOK_MP_STATUS_UPDATED topic=merchant_order saleId=${updatedSale.id} merchantOrderId=${merchantOrderId} paymentId=none status=${updatedSale.status} requestId=${requestId ?? 'unknown'}`);
        this.schedulePaymentRetries({
            merchantOrderId,
            resourceUrl,
            externalReference,
            requestId,
        });
    }
    selectPaymentFromMerchantOrder(payments) {
        const normalizedPayments = payments
            .map((payment) => ({
            id: payment?.id,
            status: typeof payment?.status === 'string' ? payment.status : null,
            statusDetail: typeof payment?.status_detail === 'string' ? payment.status_detail : null,
            dateApproved: typeof payment?.date_approved === 'string' ? payment.date_approved : null,
            dateCreated: typeof payment?.date_created === 'string' ? payment.date_created : null,
            lastModified: typeof payment?.last_modified === 'string' ? payment.last_modified : null,
        }))
            .filter((payment) => payment.id !== undefined && payment.id !== null);
        if (normalizedPayments.length === 0) {
            return null;
        }
        const approvedCandidates = normalizedPayments.filter((payment) => {
            const status = payment.status?.toLowerCase();
            const detail = payment.statusDetail?.toLowerCase();
            return status === 'approved' || status === 'accredited' || detail === 'accredited';
        });
        const candidates = approvedCandidates.length > 0 ? approvedCandidates : normalizedPayments;
        const sorted = candidates.sort((a, b) => {
            const timeA = this.resolvePaymentTimestamp(a) ?? 0;
            const timeB = this.resolvePaymentTimestamp(b) ?? 0;
            return timeB - timeA;
        });
        return sorted[0] ?? null;
    }
    resolvePaymentTimestamp(payment) {
        const dates = [payment.dateApproved, payment.lastModified, payment.dateCreated];
        for (const entry of dates) {
            if (!entry) {
                continue;
            }
            const parsed = Date.parse(entry);
            if (!Number.isNaN(parsed)) {
                return parsed;
            }
        }
        return null;
    }
    async findSaleForMerchantOrder(externalReference, merchantOrderId, paymentId) {
        if (externalReference) {
            return this.findSaleByExternalReference(externalReference, merchantOrderId, paymentId);
        }
        if (merchantOrderId) {
            return this.prisma.sale.findFirst({
                where: { mpMerchantOrderId: merchantOrderId },
            });
        }
        if (paymentId) {
            return this.prisma.sale.findFirst({
                where: { mpPaymentId: paymentId },
            });
        }
        return null;
    }
    async findSaleByExternalReference(externalReference, merchantOrderId, paymentId) {
        const saleIdFromReference = (0, mercadopago_webhook_utils_1.normalizeSaleId)(externalReference);
        return ((saleIdFromReference
            ? await this.prisma.sale.findUnique({ where: { id: saleIdFromReference } })
            : null) ||
            (merchantOrderId
                ? await this.prisma.sale.findFirst({
                    where: { mpMerchantOrderId: merchantOrderId },
                })
                : null) ||
            (paymentId
                ? await this.prisma.sale.findFirst({
                    where: { mpPaymentId: paymentId },
                })
                : null));
    }
    async ensureIdempotency(topic, resourceId) {
        try {
            await this.prisma.paymentEvent.create({
                data: {
                    provider: 'MP',
                    topic,
                    resourceId,
                },
            });
            return true;
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                return false;
            }
            throw error;
        }
    }
    isPaymentNotFoundError(error) {
        if (!(error instanceof common_1.HttpException)) {
            return false;
        }
        const response = error.getResponse();
        const responseText = typeof response === 'string' ? response : JSON.stringify(response);
        return (responseText.includes('Mercado Pago error 404') &&
            responseText.includes('Payment not found'));
    }
    schedulePaymentRetries(input) {
        if (!input.merchantOrderId) {
            return;
        }
        const state = { resolved: false };
        for (const delay of this.paymentRetryDelaysMs) {
            const timer = setTimeout(() => {
                void this.retryPaymentConfirmation(state, input, delay);
            }, delay);
            if (typeof timer.unref === 'function') {
                timer.unref();
            }
        }
    }
    async retryPaymentConfirmation(state, input, delay) {
        if (state.resolved) {
            return;
        }
        const { merchantOrderId, resourceUrl, externalReference, requestId } = input;
        const merchantOrderPayload = await this.safeFetchMerchantOrder(resourceUrl, merchantOrderId, requestId, delay);
        const payments = Array.isArray(merchantOrderPayload?.payments)
            ? (merchantOrderPayload?.payments).filter(mercadopago_webhook_utils_1.isRecord)
            : [];
        let paymentIdValue = this.extractPaymentIdFromPayments(payments);
        if (!paymentIdValue && externalReference) {
            paymentIdValue = await this.findPaymentIdByExternalReference(externalReference, requestId, delay);
        }
        if (!paymentIdValue) {
            this.logger.log(`WEBHOOK_MP_RETRY_NO_PAYMENT merchantOrderId=${merchantOrderId} delayMs=${delay} requestId=${requestId ?? 'unknown'}`);
            return;
        }
        state.resolved = true;
        this.logger.log(`WEBHOOK_MP_RETRY_PAYMENT_FOUND merchantOrderId=${merchantOrderId} paymentId=${paymentIdValue} delayMs=${delay} requestId=${requestId ?? 'unknown'}`);
        await this.processPayment(paymentIdValue, requestId, merchantOrderId, null, 'payment');
    }
    extractPaymentIdFromPayments(payments) {
        const selectedPayment = this.selectPaymentFromMerchantOrder(payments);
        return selectedPayment?.id ? String(selectedPayment.id) : null;
    }
    async safeFetchMerchantOrder(resourceUrl, merchantOrderId, requestId, delayMs) {
        try {
            const merchantOrder = await this.mpQueryService.getMerchantOrderByResource(resourceUrl, merchantOrderId);
            return (0, mercadopago_webhook_utils_1.isRecord)(merchantOrder) ? merchantOrder : null;
        }
        catch (error) {
            this.logger.warn(`WEBHOOK_MP_RETRY_MERCHANT_ORDER_FAILED merchantOrderId=${merchantOrderId} delayMs=${delayMs ?? 0} requestId=${requestId ?? 'unknown'}`);
            if (error instanceof Error) {
                this.logger.debug(error.message);
            }
            return null;
        }
    }
    async findPaymentIdByExternalReference(externalReference, requestId, delayMs) {
        try {
            const searchResult = await this.mpQueryService.searchPaymentsByExternalReference(externalReference);
            const payments = this.extractSearchResults(searchResult);
            return this.extractPaymentIdFromPayments(payments);
        }
        catch (error) {
            this.logger.warn(`WEBHOOK_MP_RETRY_SEARCH_FAILED externalReference=${externalReference} delayMs=${delayMs ?? 0} requestId=${requestId ?? 'unknown'}`);
            if (error instanceof Error) {
                this.logger.debug(error.message);
            }
            return null;
        }
    }
    extractSearchResults(payload) {
        if (Array.isArray(payload)) {
            return payload.filter(mercadopago_webhook_utils_1.isRecord);
        }
        if ((0, mercadopago_webhook_utils_1.isRecord)(payload) && Array.isArray(payload.results)) {
            return payload.results.filter(mercadopago_webhook_utils_1.isRecord);
        }
        return [];
    }
    async decrementStockForSale(saleId) {
        const saleItems = await this.prisma.saleItem.findMany({
            where: { saleId },
            select: { productId: true, quantity: true },
        });
        for (const item of saleItems) {
            await this.prisma.product.update({
                where: { id: item.productId },
                data: { stock: { decrement: item.quantity } },
            });
        }
    }
};
exports.MercadoPagoWebhookProcessorService = MercadoPagoWebhookProcessorService;
exports.MercadoPagoWebhookProcessorService = MercadoPagoWebhookProcessorService = MercadoPagoWebhookProcessorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mercadopago_query_service_1.MercadoPagoQueryService,
        sales_gateway_1.SalesGateway])
], MercadoPagoWebhookProcessorService);
