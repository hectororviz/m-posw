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
var SalesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../common/prisma.service");
const mercadopago_instore_service_1 = require("./services/mercadopago-instore.service");
const mercadopago_query_service_1 = require("./services/mercadopago-query.service");
const mercadopago_webhook_utils_1 = require("./webhooks/mercadopago-webhook.utils");
let SalesService = SalesService_1 = class SalesService {
    constructor(prisma, config, mpService, mpQueryService) {
        this.prisma = prisma;
        this.config = config;
        this.mpService = mpService;
        this.mpQueryService = mpQueryService;
        this.paymentExpirationMinutes = 2;
        this.logger = new common_1.Logger(SalesService_1.name);
    }
    async createCashSale(userId, dto) {
        const { items, total } = await this.buildSaleItems(dto.items);
        const roundedTotal = this.roundToCurrency(total);
        this.assertTotal(dto.total, roundedTotal);
        const cashReceived = this.roundToCurrency(dto.cashReceived);
        if (cashReceived < roundedTotal) {
            throw new common_1.BadRequestException('El monto recibido es insuficiente');
        }
        const changeAmount = this.roundToCurrency(cashReceived - roundedTotal);
        try {
            const sale = await this.prisma.sale.create({
                data: {
                    userId,
                    total: roundedTotal,
                    status: client_1.SaleStatus.APPROVED,
                    paymentStatus: client_1.PaymentStatus.APPROVED,
                    paymentMethod: client_1.PaymentMethod.CASH,
                    cashReceived,
                    changeAmount,
                    statusUpdatedAt: new Date(),
                    paidAt: new Date(),
                    items: {
                        create: items,
                    },
                },
                include: { items: { include: { product: { include: { category: true } } } } },
            });
            await this.decrementStockForSale(sale.id);
            return sale;
        }
        catch (error) {
            this.handlePrismaError(error, 'crear la venta en efectivo');
        }
    }
    async createQrSale(userId, dto) {
        const { items, total } = await this.buildSaleItems(dto.items);
        const roundedTotal = this.roundToCurrency(total);
        this.assertTotal(dto.total, roundedTotal);
        let sale;
        try {
            sale = await this.prisma.sale.create({
                data: {
                    userId,
                    total: roundedTotal,
                    status: client_1.SaleStatus.PENDING,
                    paymentStatus: client_1.PaymentStatus.PENDING,
                    paymentMethod: client_1.PaymentMethod.MP_QR,
                    statusUpdatedAt: new Date(),
                    paymentStartedAt: new Date(),
                    items: {
                        create: items,
                    },
                },
                include: { items: { include: { product: { include: { category: true } } } }, user: true },
            });
        }
        catch (error) {
            this.handlePrismaError(error, 'crear la venta con QR');
        }
        const externalStoreId = sale.user.externalStoreId?.trim() ||
            this.config.get('MP_DEFAULT_EXTERNAL_STORE_ID');
        const externalPosId = sale.user.externalPosId?.trim() || this.config.get('MP_DEFAULT_EXTERNAL_POS_ID');
        if (!externalStoreId || !externalPosId) {
            throw new common_1.BadRequestException('externalStoreId y externalPosId requeridos para Mercado Pago');
        }
        const externalReference = `sale-${sale.id}`;
        const saleWithReference = await this.prisma.sale.update({
            where: { id: sale.id },
            data: {
                mpExternalReference: externalReference,
                statusUpdatedAt: new Date(),
            },
            include: { items: { include: { product: { include: { category: true } } } }, user: true },
        });
        try {
            await this.mpService.createOrUpdateOrder({
                externalStoreId,
                externalPosId,
                sale: saleWithReference,
            });
        }
        catch (error) {
            await this.prisma.sale.update({
                where: { id: sale.id },
                data: {
                    status: client_1.SaleStatus.REJECTED,
                    statusUpdatedAt: new Date(),
                },
            });
            throw error;
        }
        return {
            saleId: saleWithReference.id,
            orderNumber: saleWithReference.orderNumber,
            status: saleWithReference.status,
            startedAt: saleWithReference.paymentStartedAt,
        };
    }
    async listSales(requester) {
        const createdAtFilter = await this.getCurrentScopeFromLastClose(requester);
        return this.prisma.sale.findMany({
            where: createdAtFilter ? { createdAt: { gte: createdAtFilter } } : undefined,
            include: {
                user: { select: { id: true, name: true, email: true } },
                items: { include: { product: { include: { category: true } } } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async listManualMovements(requester) {
        const createdAtFilter = await this.getCurrentScopeFromLastClose(requester);
        return this.prisma.manualMovement.findMany({
            where: createdAtFilter ? { createdAt: { gte: createdAtFilter } } : undefined,
            orderBy: { createdAt: 'desc' },
        });
    }
    createManualMovement(userId, dto) {
        const reason = dto.reason.trim();
        if (!reason) {
            throw new common_1.BadRequestException('El motivo es obligatorio');
        }
        return this.prisma.manualMovement.create({
            data: {
                userId,
                type: dto.type,
                amount: this.roundToCurrency(dto.amount),
                reason,
            },
        });
    }
    async getCurrentScopeFromLastClose(requester) {
        if (!requester || requester.role === 'ADMIN') {
            return null;
        }
        const lastClose = await this.prisma.cashClose.findFirst({
            orderBy: { to: 'desc' },
            select: { to: true },
        });
        return lastClose?.to ?? null;
    }
    async getSaleById(saleId, requester) {
        const sale = await this.prisma.sale.findUnique({
            where: { id: saleId },
            include: {
                user: { select: { id: true, name: true, externalPosId: true, externalStoreId: true } },
                items: { include: { product: { include: { category: true } } } },
            },
        });
        if (!sale) {
            throw new common_1.NotFoundException('Venta no encontrada');
        }
        this.assertCanAccessSale(sale, requester, 'GET /sales/:id');
        const refreshed = await this.expireIfNeeded(sale);
        return refreshed ?? sale;
    }
    async getSaleStatus(saleId, requester) {
        const sale = await this.prisma.sale.findUnique({
            where: { id: saleId },
            include: { user: true },
        });
        if (!sale) {
            throw new common_1.NotFoundException('Venta no encontrada');
        }
        this.assertCanAccessSale(sale, requester, 'GET /sales/:id/status');
        const refreshed = await this.expireIfNeeded(sale);
        const finalSale = refreshed ?? sale;
        return { saleId: finalSale.id, orderNumber: finalSale.orderNumber, status: finalSale.status, updatedAt: finalSale.statusUpdatedAt };
    }
    async getPaymentStatus(saleId, requester) {
        const sale = await this.prisma.sale.findUnique({
            where: { id: saleId },
            include: { user: true },
        });
        if (!sale) {
            throw new common_1.NotFoundException('Venta no encontrada');
        }
        this.assertCanAccessSale(sale, requester, 'GET /sales/:id/payment-status');
        const refreshed = await this.expireIfNeeded(sale);
        const finalSale = refreshed ?? sale;
        let updatedSale = finalSale;
        let lastCheckedAt = null;
        if (finalSale.paymentStatus === client_1.PaymentStatus.PENDING) {
            const externalReference = `sale-${finalSale.id}`;
            lastCheckedAt = new Date();
            const searchResults = await this.mpQueryService.searchPaymentsByExternalReference(externalReference);
            const latestPayment = this.pickLatestPayment(searchResults);
            if (!latestPayment) {
                this.logger.log(`MP_SEARCH_NO_PAYMENT saleId=${finalSale.id} message=no payment yet`);
            }
            if (latestPayment) {
                const paymentId = latestPayment.id ? String(latestPayment.id) : null;
                const mpStatus = typeof latestPayment.status === 'string' ? latestPayment.status : null;
                const mpStatusDetail = typeof latestPayment.status_detail === 'string' ? latestPayment.status_detail : null;
                const mappedPaymentStatus = (0, mercadopago_webhook_utils_1.mapMpPaymentToPaymentStatus)(mpStatus, mpStatusDetail, (normalizedStatus, normalizedDetail) => {
                    this.logger.warn(`MP_SEARCH_STATUS_UNKNOWN saleId=${finalSale.id} status=${normalizedStatus ?? 'unknown'} detail=${normalizedDetail ?? 'unknown'}`);
                });
                const mappedSaleStatus = (0, mercadopago_webhook_utils_1.mapSaleStatus)(mappedPaymentStatus);
                if (mpStatus || mpStatusDetail || paymentId) {
                    updatedSale = await this.prisma.sale.update({
                        where: { id: finalSale.id },
                        data: {
                            paymentStatus: mappedPaymentStatus,
                            status: mappedSaleStatus && finalSale.status !== client_1.SaleStatus.APPROVED
                                ? mappedSaleStatus
                                : finalSale.status,
                            statusUpdatedAt: mappedSaleStatus && finalSale.status !== client_1.SaleStatus.APPROVED
                                ? new Date()
                                : finalSale.statusUpdatedAt,
                            paidAt: mappedPaymentStatus === client_1.PaymentStatus.APPROVED
                                ? finalSale.paidAt ?? new Date()
                                : finalSale.paidAt,
                            mpPaymentId: paymentId ?? finalSale.mpPaymentId,
                            mpStatus: mpStatus ?? finalSale.mpStatus,
                            mpStatusDetail: mpStatusDetail ?? finalSale.mpStatusDetail,
                            updatedAt: new Date(),
                        },
                        include: { user: true },
                    });
                }
            }
        }
        const resolvedStatus = updatedSale.status === client_1.SaleStatus.CANCELLED ? client_1.SaleStatus.CANCELLED : updatedSale.paymentStatus;
        return {
            saleId: finalSale.id,
            orderNumber: finalSale.orderNumber,
            status: resolvedStatus,
            mpStatus: updatedSale.mpStatus,
            mpStatusDetail: updatedSale.mpStatusDetail,
            paymentId: updatedSale.mpPaymentId ?? undefined,
            merchantOrderId: updatedSale.mpMerchantOrderId ?? undefined,
            updatedAt: updatedSale.updatedAt.toISOString(),
            lastCheckedAt: lastCheckedAt?.toISOString(),
        };
    }
    async completeSale(saleId, requester) {
        const sale = await this.prisma.sale.findUnique({
            where: { id: saleId },
            include: { user: true, items: { include: { product: { include: { category: true } } } } },
        });
        if (!sale) {
            throw new common_1.NotFoundException('Venta no encontrada');
        }
        this.assertCanAccessSale(sale, requester, 'POST /sales/:id/complete');
        if (sale.paymentStatus !== client_1.PaymentStatus.APPROVED) {
            throw new common_1.BadRequestException('La venta todavía no tiene pago aprobado');
        }
        if (sale.status === client_1.SaleStatus.APPROVED) {
            return sale;
        }
        const updatedSale = await this.prisma.sale.update({
            where: { id: saleId },
            data: {
                status: client_1.SaleStatus.APPROVED,
                statusUpdatedAt: new Date(),
                paidAt: sale.paidAt ?? new Date(),
            },
            include: { items: { include: { product: { include: { category: true } } } } },
        });
        await this.decrementStockForSale(saleId);
        return updatedSale;
    }
    async markTicketPrinted(saleId, requester) {
        const sale = await this.prisma.sale.findUnique({
            where: { id: saleId },
            include: { user: true },
        });
        if (!sale) {
            throw new common_1.NotFoundException('Venta no encontrada');
        }
        this.assertCanAccessSale(sale, requester, 'POST /sales/:id/ticket-printed');
        if (sale.ticketPrintedAt) {
            return { saleId: sale.id, ticketPrintedAt: sale.ticketPrintedAt, alreadyPrinted: true };
        }
        const updatedSale = await this.prisma.sale.update({
            where: { id: saleId },
            data: { ticketPrintedAt: new Date() },
        });
        return { saleId: updatedSale.id, ticketPrintedAt: updatedSale.ticketPrintedAt, alreadyPrinted: false };
    }
    async cancelQrSale(saleId, requester) {
        const sale = await this.prisma.sale.findUnique({
            where: { id: saleId },
            include: { user: true },
        });
        if (!sale) {
            throw new common_1.NotFoundException('Venta no encontrada');
        }
        this.assertCanAccessSale(sale, requester, 'POST /sales/:id/cancel');
        if (sale.status === client_1.SaleStatus.APPROVED) {
            throw new common_1.BadRequestException('La venta ya está aprobada');
        }
        const externalStoreId = sale.user.externalStoreId?.trim() ||
            this.config.get('MP_DEFAULT_EXTERNAL_STORE_ID');
        const externalPosId = sale.user.externalPosId?.trim() || this.config.get('MP_DEFAULT_EXTERNAL_POS_ID');
        if (!externalStoreId || !externalPosId) {
            throw new common_1.BadRequestException('externalStoreId y externalPosId requeridos para Mercado Pago');
        }
        await this.mpService.deleteOrder({
            externalStoreId,
            externalPosId,
        });
        const updatedSale = await this.prisma.sale.update({
            where: { id: saleId },
            data: {
                status: client_1.SaleStatus.CANCELLED,
                paymentStatus: client_1.PaymentStatus.REJECTED,
                statusUpdatedAt: new Date(),
                cancelledAt: new Date(),
            },
        });
        return { saleId: updatedSale.id, status: updatedSale.status };
    }
    assertCanAccessSale(sale, requester, endpoint) {
        const requesterId = requester.sub ?? requester.id;
        this.logger.debug(`${endpoint} auth check saleUserId=${sale.userId} requesterId=${requester.id} requesterSub=${requester.sub} resolvedId=${requesterId} requesterRole=${requester.role}`);
        if (requester.role !== 'ADMIN' && sale.userId !== requesterId) {
            throw new common_1.ForbiddenException('No tienes acceso a esta venta');
        }
    }
    handlePrismaError(error, action) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            this.logger.error(`Error Prisma al ${action}: ${error.code}`, error.message);
            throw new common_1.BadRequestException(`No se pudo ${action}. Verificá las migraciones de la base de datos.`);
        }
        throw error;
    }
    async expireIfNeeded(sale) {
        if (sale.status !== client_1.SaleStatus.PENDING || !sale.paymentStartedAt) {
            return null;
        }
        const cutoff = new Date(Date.now() - this.paymentExpirationMinutes * 60 * 1000);
        if (sale.paymentStartedAt > cutoff) {
            return null;
        }
        const externalStoreId = sale.user.externalStoreId?.trim() ||
            this.config.get('MP_DEFAULT_EXTERNAL_STORE_ID');
        const externalPosId = sale.user.externalPosId?.trim() || this.config.get('MP_DEFAULT_EXTERNAL_POS_ID');
        if (externalPosId && externalStoreId) {
            await this.mpService.deleteOrder({ externalStoreId, externalPosId });
        }
        return this.prisma.sale.update({
            where: { id: sale.id },
            data: {
                status: client_1.SaleStatus.EXPIRED,
                paymentStatus: client_1.PaymentStatus.EXPIRED,
                statusUpdatedAt: new Date(),
                expiredAt: new Date(),
            },
            include: {
                user: { select: { id: true, name: true, externalPosId: true, externalStoreId: true } },
                items: { include: { product: { include: { category: true } } } },
            },
        });
    }
    async buildSaleItems(items) {
        const productIds = items.map((item) => item.productId);
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds }, active: true },
        });
        if (products.length !== productIds.length) {
            throw new common_1.BadRequestException('Producto inválido o inactivo');
        }
        const saleItems = [];
        for (const item of items) {
            const product = products.find((p) => p.id === item.productId);
            const price = Number(product.price);
            const subtotal = this.roundToCurrency(price * item.quantity);
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
        const total = saleItems.reduce((sum, item) => sum + item.subtotal, 0);
        return { items: saleItems, total };
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
    roundToCurrency(value) {
        return Math.round(value * 100) / 100;
    }
    assertTotal(receivedTotal, computedTotal) {
        const roundedReceived = this.roundToCurrency(receivedTotal);
        if (Math.abs(roundedReceived - computedTotal) > 0.009) {
            throw new common_1.BadRequestException('El total no coincide con los items');
        }
    }
    pickLatestPayment(response) {
        if (!response || typeof response !== 'object') {
            return null;
        }
        const results = response.results;
        if (!Array.isArray(results) || results.length === 0) {
            return null;
        }
        return results
            .slice()
            .sort((left, right) => {
            const leftDate = typeof left.date_last_updated === 'string'
                ? Date.parse(left.date_last_updated)
                : typeof left.date_created === 'string'
                    ? Date.parse(left.date_created)
                    : 0;
            const rightDate = typeof right.date_last_updated === 'string'
                ? Date.parse(right.date_last_updated)
                : typeof right.date_created === 'string'
                    ? Date.parse(right.date_created)
                    : 0;
            return rightDate - leftDate;
        })[0];
    }
};
exports.SalesService = SalesService;
exports.SalesService = SalesService = SalesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        mercadopago_instore_service_1.MercadoPagoInstoreService,
        mercadopago_query_service_1.MercadoPagoQueryService])
], SalesService);
