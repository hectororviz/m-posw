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
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../common/prisma.service");
let PaymentsService = PaymentsService_1 = class PaymentsService {
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
        this.baseUrl = 'https://api.mercadopago.com';
        this.timeoutMs = 8000;
        this.logger = new common_1.Logger(PaymentsService_1.name);
        this.seenPaymentIds = new Set();
    }
    async pollTransfer(montoEsperado, userId) {
        const token = this.config.get('MP_ACCESS_TOKEN');
        if (!token) {
            throw new Error('MP_ACCESS_TOKEN no configurado');
        }
        const now = new Date();
        const beginDate = new Date(now.getTime() - 2 * 60 * 1000);
        const beginDateISO = beginDate.toISOString();
        const endDateISO = now.toISOString();
        const url = new URL(`${this.baseUrl}/v1/payments/search`);
        url.searchParams.append('range', 'date_created');
        url.searchParams.append('begin_date', beginDateISO);
        url.searchParams.append('end_date', endDateISO);
        url.searchParams.append('sort', 'date_created');
        url.searchParams.append('criteria', 'desc');
        url.searchParams.append('limit', '10');
        url.searchParams.append('status', 'approved');
        this.logger.debug(`Polling MP transfers: ${url.toString()}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` },
                signal: controller.signal,
            });
            const data = (await response.json());
            if (!response.ok) {
                this.logger.error(`MP API error: ${response.status}`, data);
                throw new Error(`MercadoPago API error: ${response.status}`);
            }
            const payments = data.results || [];
            const transferPayments = payments.filter((payment) => {
                const isTransfer = payment.payment_method_id === 'cvu' ||
                    payment.operation_type === 'money_transfer';
                if (!isTransfer)
                    return false;
                const paymentId = String(payment.id);
                if (this.seenPaymentIds.has(paymentId))
                    return false;
                return true;
            });
            if (transferPayments.length === 0) {
                return { hay_pago: false };
            }
            const payment = transferPayments[0];
            const paymentId = String(payment.id);
            const existing = await this.prisma.movimientoMP.findUnique({
                where: { paymentId },
            });
            if (existing?.notificado) {
                this.seenPaymentIds.add(paymentId);
                return { hay_pago: false };
            }
            const payerName = payment.payer
                ? [payment.payer.first_name, payment.payer.last_name].filter(Boolean).join(' ') || payment.payer.email
                : undefined;
            this.logger.log(`Found transfer payment: ${paymentId}, amount: ${payment.transaction_amount}`);
            return {
                hay_pago: true,
                monto: payment.transaction_amount,
                pagador: payerName,
                tipo: payment.payment_method_id === 'cvu' ? 'cvu' : 'transferencia',
                fecha: payment.date_approved || payment.date_created,
                payment_id: paymentId,
            };
        }
        catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Timeout consultando MercadoPago');
            }
            throw error;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async confirmTransfer(paymentId, montoRecibido, montoEsperado, userId, items) {
        const existing = await this.prisma.movimientoMP.findUnique({
            where: { paymentId },
            include: { sale: true },
        });
        if (existing?.procesado && existing.saleId) {
            return {
                success: true,
                saleId: existing.saleId,
                orderNumber: existing.sale?.orderNumber,
                message: 'Pago ya procesado',
            };
        }
        const roundedTotal = Math.round(montoEsperado * 100) / 100;
        const roundedReceived = Math.round(montoRecibido * 100) / 100;
        const productIds = items.map((item) => item.productId);
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds }, active: true },
        });
        if (products.length !== productIds.length) {
            throw new Error('Producto inválido o inactivo');
        }
        const saleItems = [];
        for (const item of items) {
            const product = products.find((p) => p.id === item.productId);
            if (!product)
                continue;
            const price = Number(product.price);
            const subtotal = Math.round(price * item.quantity * 100) / 100;
            const counter = await this.prisma.productOrderCounter.upsert({
                where: { productId: item.productId },
                update: { lastOrderNumber: { increment: 1 } },
                create: { productId: item.productId, lastOrderNumber: 1 },
            });
            saleItems.push({
                productId: item.productId,
                quantity: item.quantity,
                subtotal,
                orderNumber: counter.lastOrderNumber,
            });
        }
        const result = await this.prisma.$transaction(async (tx) => {
            const sale = await tx.sale.create({
                data: {
                    userId,
                    total: roundedTotal,
                    status: 'APPROVED',
                    paymentStatus: 'APPROVED',
                    paymentMethod: 'TRANSFER',
                    cashReceived: roundedReceived,
                    changeAmount: 0,
                    statusUpdatedAt: new Date(),
                    paidAt: new Date(),
                    items: {
                        create: saleItems,
                    },
                },
                include: { items: true },
            });
            await tx.movimientoMP.upsert({
                where: { paymentId },
                create: {
                    saleId: sale.id,
                    paymentId,
                    monto: roundedReceived,
                    montoEsperado: roundedTotal,
                    pagador: null,
                    tipo: 'cvu',
                    fecha: new Date(),
                    notificado: true,
                    procesado: true,
                },
                update: {
                    saleId: sale.id,
                    notificado: true,
                    procesado: true,
                },
            });
            return sale;
        });
        return {
            success: true,
            saleId: result.id,
            orderNumber: result.orderNumber,
        };
    }
    clearSeenPayments() {
        this.seenPaymentIds.clear();
        this.logger.log('Cleared seen payment IDs cache');
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], PaymentsService);
