import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MovementType, PaymentMethod, PaymentStatus, Prisma, ProductType, SaleStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { JournalEntriesService } from '../treasury/journal-entries.service';
import { CreateManualMovementDto } from './dto/create-manual-movement.dto';
import { CreateCashSaleDto, CreateFiadoSaleDto, CreateQrSaleDto, SaleItemInputDto } from './dto/create-sale.dto';
import { MercadoPagoInstoreService } from './services/mercadopago-instore.service';
import { MercadoPagoQueryService } from './services/mercadopago-query.service';
import { InternetVouchersService } from '../internet-vouchers/internet-vouchers.service';
import {
  mapMpPaymentToPaymentStatus,
} from './webhooks/mercadopago-webhook.utils';

@Injectable()
export class SalesService {
  private readonly paymentExpirationMinutes = 10;
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private mpService: MercadoPagoInstoreService,
    private mpQueryService: MercadoPagoQueryService,
    private journalEntriesService: JournalEntriesService,
    private internetVouchers: InternetVouchersService,
  ) {}

  async createCashSale(userId: string, dto: CreateCashSaleDto) {
    const { items, total } = await this.buildSaleItems(dto.items);
    const roundedTotal = this.roundToCurrency(total);
    this.assertTotal(dto.total, roundedTotal);
    const cashReceived = this.roundToCurrency(dto.cashReceived);
    if (cashReceived < roundedTotal) {
      throw new BadRequestException('El monto recibido es insuficiente');
    }
    const changeAmount = this.roundToCurrency(cashReceived - roundedTotal);

    const setting = await this.prisma.setting.findFirst();

    try {
      if (!setting?.enableAutoJournalPos) {
        const sale = await this.prisma.sale.create({
          data: {
            userId,
            total: roundedTotal,
            status: SaleStatus.APPROVED,
            paymentStatus: PaymentStatus.APPROVED,
            paymentMethod: PaymentMethod.CASH,
            cashReceived,
            changeAmount,
            statusUpdatedAt: new Date(),
            paidAt: new Date(),
            items: { create: items },
          },
          include: { items: { include: { product: { include: { category: true } } } } },
        });
        this.logger.log(`Venta en efectivo creada saleId=${sale.id}, decrementando stock...`);
        await this.decrementStockForSale(sale.id);
        this.logger.log(`Stock decrementado para saleId=${sale.id}`);
        const vouchers = await this.internetVouchers.generateVouchersForSale(sale.id);
        if (vouchers.length > 0) {
          return this.prisma.sale.findUnique({
            where: { id: sale.id },
            include: {
              items: { include: { product: { include: { category: true } } } },
              vouchers: { include: { plan: true } },
            },
          });
        }
        return sale;
      }

      const pma = await this.prisma.paymentMethodAccount.findUnique({
        where: { paymentMethod: 'CASH' },
      });
      if (!pma) throw new BadRequestException('No hay cuenta contable configurada para CASH');

      const ingresosAccount = await this.prisma.ledgerAccount.findUnique({
        where: { code: '4.1.01' },
      });
      if (!ingresosAccount) throw new BadRequestException('Cuenta contable 4.1.01 no encontrada');

      const result = await this.prisma.$transaction(async (tx) => {
        const sale = await tx.sale.create({
          data: {
            userId,
            total: roundedTotal,
            status: SaleStatus.APPROVED,
            paymentStatus: PaymentStatus.APPROVED,
            paymentMethod: PaymentMethod.CASH,
            cashReceived,
            changeAmount,
            statusUpdatedAt: new Date(),
            paidAt: new Date(),
            items: { create: items },
          },
          include: { items: { include: { product: { include: { category: true } } } } },
        });

        const entry = await this.journalEntriesService.createAutomatedEntry(tx, userId, {
          date: new Date(),
          description: `Venta POS - CASH - Venta #${sale.id}`,
          lines: [
            { accountId: pma.ledgerAccountId, debit: roundedTotal, credit: 0 },
            { accountId: ingresosAccount.id, debit: 0, credit: roundedTotal },
          ],
          sourceType: 'VENTA_POS',
          sourceId: sale.orderNumber,
        });

        await tx.sale.update({
          where: { id: sale.id },
          data: { journalEntryId: entry.id },
        });

        return sale;
      });

      this.logger.log(`Venta en efectivo creada saleId=${result.id}, decrementando stock...`);
      await this.decrementStockForSale(result.id);
      this.logger.log(`Stock decrementado para saleId=${result.id}`);

      const vouchers = await this.internetVouchers.generateVouchersForSale(result.id);
      if (vouchers.length > 0) {
        return this.prisma.sale.findUnique({
          where: { id: result.id },
          include: {
            items: { include: { product: { include: { category: true } } } },
            vouchers: { include: { plan: true } },
          },
        });
      }

      return result;
    } catch (error) {
      this.handlePrismaError(error, 'crear la venta en efectivo');
    }
  }

  async createQrSale(userId: string, dto: CreateQrSaleDto) {
    const { items, total } = await this.buildSaleItems(dto.items);
    const roundedTotal = this.roundToCurrency(total);
    this.assertTotal(dto.total, roundedTotal);

    const setting = await this.prisma.setting.findFirst();

    let sale;
    try {
      if (!setting?.enableAutoJournalPos) {
        const s = await this.prisma.sale.create({
          data: {
            userId,
            total: roundedTotal,
            status: SaleStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
            paymentMethod: PaymentMethod.MP_QR,
            statusUpdatedAt: new Date(),
            paymentStartedAt: new Date(),
            items: { create: items },
          },
        });
        sale = s;
      } else {
        const pma = await this.prisma.paymentMethodAccount.findUnique({
          where: { paymentMethod: 'MP_QR' },
        });
        if (!pma) throw new BadRequestException('No hay cuenta contable configurada para MP_QR');

        const ingresosAccount = await this.prisma.ledgerAccount.findUnique({
          where: { code: '4.1.01' },
        });
        if (!ingresosAccount) throw new BadRequestException('Cuenta contable 4.1.01 no encontrada');

        const result = await this.prisma.$transaction(async (tx) => {
          const s = await tx.sale.create({
            data: {
              userId,
              total: roundedTotal,
              status: SaleStatus.PENDING,
              paymentStatus: PaymentStatus.PENDING,
              paymentMethod: PaymentMethod.MP_QR,
              statusUpdatedAt: new Date(),
              paymentStartedAt: new Date(),
              items: { create: items },
            },
          });

          const entry = await this.journalEntriesService.createAutomatedEntry(tx, userId, {
            date: new Date(),
            description: `Venta POS - MP_QR - Venta #${s.id}`,
            lines: [
              { accountId: pma.ledgerAccountId, debit: roundedTotal, credit: 0 },
              { accountId: ingresosAccount.id, debit: 0, credit: roundedTotal },
            ],
            sourceType: 'VENTA_POS',
            sourceId: s.orderNumber,
            status: 'DRAFT',
          });

          await tx.sale.update({
            where: { id: s.id },
            data: { journalEntryId: entry.id },
          });

          return s;
        });
        sale = result;
      }
    } catch (error) {
      this.handlePrismaError(error, 'crear la venta con QR');
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
        sale: saleWithReference,
      });
    } catch (error) {
      await this.prisma.sale.update({
        where: { id: sale.id },
        data: {
          status: SaleStatus.REJECTED,
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

  async createFiadoSale(userId: string, dto: CreateFiadoSaleDto) {
    const { items, total } = await this.buildSaleItems(dto.items);
    const roundedTotal = this.roundToCurrency(total);
    this.assertTotal(dto.total, roundedTotal);

    const acreedor = await this.prisma.acreedor.findFirst({
      where: { id: dto.acreedorId, activo: true },
    });

    if (!acreedor) {
      throw new NotFoundException('Acreedor no encontrado o inactivo');
    }

    const setting = await this.prisma.setting.findFirst();

    try {
      if (!setting?.enableAutoJournalPos) {
        const sale = await this.prisma.sale.create({
          data: {
            userId,
            total: roundedTotal,
            status: SaleStatus.APPROVED,
            paymentStatus: PaymentStatus.APPROVED,
            paymentMethod: PaymentMethod.FIADO,
            cashReceived: 0,
            changeAmount: 0,
            statusUpdatedAt: new Date(),
            paidAt: new Date(),
            items: { create: items },
          },
          include: { items: { include: { product: { include: { category: true } } } } },
        });

        await this.prisma.fiadoVenta.create({
          data: {
            ventaId: sale.id,
            acreedorId: dto.acreedorId,
            monto: roundedTotal,
          },
        });

        this.logger.log(`Venta fiado creada saleId=${sale.id}, acreedorId=${dto.acreedorId}, decrementando stock...`);
        await this.decrementStockForSale(sale.id);
        this.logger.log(`Stock decrementado para saleId=${sale.id}`);

        const vouchers = await this.internetVouchers.generateVouchersForSale(sale.id);
        if (vouchers.length > 0) {
          return this.prisma.sale.findUnique({
            where: { id: sale.id },
            include: {
              items: { include: { product: { include: { category: true } } } },
              vouchers: { include: { plan: true } },
            },
          });
        }

        return sale;
      }

      const deudoresFiadosAccount = await this.prisma.ledgerAccount.findUnique({
        where: { code: '1.2.03' },
      });
      if (!deudoresFiadosAccount) throw new BadRequestException('Cuenta contable 1.2.03 no encontrada');

      const ingresosAccount = await this.prisma.ledgerAccount.findUnique({
        where: { code: '4.1.01' },
      });
      if (!ingresosAccount) throw new BadRequestException('Cuenta contable 4.1.01 no encontrada');

      const result = await this.prisma.$transaction(async (tx) => {
        const sale = await tx.sale.create({
          data: {
            userId,
            total: roundedTotal,
            status: SaleStatus.APPROVED,
            paymentStatus: PaymentStatus.APPROVED,
            paymentMethod: PaymentMethod.FIADO,
            cashReceived: 0,
            changeAmount: 0,
            statusUpdatedAt: new Date(),
            paidAt: new Date(),
            items: { create: items },
          },
          include: { items: { include: { product: { include: { category: true } } } } },
        });

        const fiadoVenta = await tx.fiadoVenta.create({
          data: {
            ventaId: sale.id,
            acreedorId: dto.acreedorId,
            monto: roundedTotal,
          },
        });

        const entry = await this.journalEntriesService.createAutomatedEntry(tx, userId, {
          date: new Date(),
          description: `Venta fiada - ${acreedor.nombre} (acreedor #${acreedor.id}) - ${items.length} items`,
          lines: [
            { accountId: deudoresFiadosAccount.id, debit: roundedTotal, credit: 0 },
            { accountId: ingresosAccount.id, debit: 0, credit: roundedTotal },
          ],
          sourceType: 'FIADO_VENTA',
          sourceId: fiadoVenta.id,
        });

        await tx.fiadoVenta.update({
          where: { id: fiadoVenta.id },
          data: { journalEntryId: entry.id },
        });

        return sale;
      });

      this.logger.log(`Venta fiado creada saleId=${result.id}, acreedorId=${dto.acreedorId}, decrementando stock...`);
      await this.decrementStockForSale(result.id);
      this.logger.log(`Stock decrementado para saleId=${result.id}`);

      const vouchers = await this.internetVouchers.generateVouchersForSale(result.id);
      if (vouchers.length > 0) {
        return this.prisma.sale.findUnique({
          where: { id: result.id },
          include: {
            items: { include: { product: { include: { category: true } } } },
            vouchers: { include: { plan: true } },
          },
        });
      }

      return result;
    } catch (error) {
      this.handlePrismaError(error, 'crear la venta fiado');
    }
  }

  async listSales(requester?: { id: string; role: string }) {
    const createdAtFilter = await this.getCurrentScopeFromLastClose(requester);

    return this.prisma.sale.findMany({
      where: createdAtFilter ? { createdAt: { gte: createdAtFilter } } : undefined,
      include: {
        user: { select: { id: true, username: true } },
        items: { include: { product: { include: { category: true } } } },
        vouchers: { include: { plan: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }


  async listManualMovements(requester?: { id: string; role: string }) {
    const createdAtFilter = await this.getCurrentScopeFromLastClose(requester);

    return this.prisma.manualMovement.findMany({
      where: createdAtFilter ? { createdAt: { gte: createdAtFilter } } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  createManualMovement(userId: string, dto: CreateManualMovementDto) {
    const reason = dto.reason.trim();
    if (!reason) {
      throw new BadRequestException('El motivo es obligatorio');
    }

    return this.prisma.manualMovement.create({
      data: {
        userId,
        type: dto.type as MovementType,
        amount: this.roundToCurrency(dto.amount),
        reason,
        description: dto.description?.trim() || null,
      },
    });
  }


  private async getCurrentScopeFromLastClose(requester?: { id: string; role: string }) {
    if (!requester || requester.role === 'ADMIN') {
      return null;
    }

    const lastClose = await this.prisma.cashClose.findFirst({
      orderBy: { to: 'desc' },
      select: { to: true },
    });

    return lastClose?.to ?? null;
  }

  async getSaleById(
    saleId: string,
    requester: { id: string; role: string },
  ) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        user: { select: { id: true, username: true } },
        items: { include: { product: { include: { category: true } } } },
        vouchers: { include: { plan: true } },
      },
    });
    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }
    this.assertCanAccessSale(sale, requester, 'GET /sales/:id');
    const refreshed = await this.expireIfNeeded(sale);
    return refreshed ?? sale;
  }

  async getSaleStatus(saleId: string, requester: { id: string; role: string }) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { user: true },
    });
    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }
    this.assertCanAccessSale(sale, requester, 'GET /sales/:id/status');
    const refreshed = await this.expireIfNeeded(sale);
    const finalSale = refreshed ?? sale;
    return { saleId: finalSale.id, orderNumber: finalSale.orderNumber, status: finalSale.status, updatedAt: finalSale.statusUpdatedAt };
  }

  async getPaymentStatus(saleId: string, requester: { id: string; role: string }) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { user: true },
    });
    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }
    this.assertCanAccessSale(sale, requester, 'GET /sales/:id/payment-status');
    const refreshed = await this.expireIfNeeded(sale);
    const finalSale = refreshed ?? sale;
    let updatedSale = finalSale;
    let lastCheckedAt: Date | null = null;
    if (finalSale.paymentStatus === PaymentStatus.PENDING) {
      const externalReference = `sale-${finalSale.id}`;
      lastCheckedAt = new Date();
      const searchResults =
        await this.mpQueryService.searchPaymentsByExternalReference(externalReference);
      const latestPayment = this.pickLatestPayment(searchResults);
      if (!latestPayment) {
        this.logger.log(`MP_SEARCH_NO_PAYMENT saleId=${finalSale.id} message=no payment yet`);
      }
      if (latestPayment) {
        const paymentId = latestPayment.id ? String(latestPayment.id) : null;
        const mpStatus = typeof latestPayment.status === 'string' ? latestPayment.status : null;
        const mpStatusDetail =
          typeof latestPayment.status_detail === 'string' ? latestPayment.status_detail : null;
        const mappedPaymentStatus = mapMpPaymentToPaymentStatus(
          mpStatus,
          mpStatusDetail,
          (normalizedStatus, normalizedDetail) => {
            this.logger.warn(
              `MP_SEARCH_STATUS_UNKNOWN saleId=${finalSale.id} status=${normalizedStatus ?? 'unknown'} detail=${normalizedDetail ?? 'unknown'}`,
            );
          },
        );
        if (mpStatus || mpStatusDetail || paymentId) {
          updatedSale = await this.prisma.sale.update({
            where: { id: finalSale.id },
            data: {
              paymentStatus: mappedPaymentStatus,
              paidAt:
                mappedPaymentStatus === PaymentStatus.APPROVED
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
    const resolvedStatus =
      updatedSale.status === SaleStatus.CANCELLED ? SaleStatus.CANCELLED : updatedSale.paymentStatus;
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

  async completeSale(saleId: string, requester: { id: string; role: string }) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { user: true, items: { include: { product: { include: { category: true } } } } },
    });
    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }
    this.assertCanAccessSale(sale, requester, 'POST /sales/:id/complete');
    if (sale.paymentStatus !== PaymentStatus.APPROVED) {
      throw new BadRequestException('La venta todavía no tiene pago aprobado');
    }
    if (sale.status === SaleStatus.APPROVED) {
      this.logger.warn(`Venta ${saleId} ya está aprobada, no se decrementa stock`);
      return sale;
    }
    
    this.logger.log(`Completando venta ${saleId}, estado actual: ${sale.status}`);
    
    const updatedSale = await this.prisma.$transaction(async (tx) => {
      const s = await tx.sale.update({
        where: { id: saleId },
        data: {
          status: SaleStatus.APPROVED,
          statusUpdatedAt: new Date(),
          paidAt: sale.paidAt ?? new Date(),
        },
      });

      if (s.journalEntryId) {
        await tx.journalEntry.update({
          where: { id: s.journalEntryId },
          data: { status: 'POSTED', postedAt: new Date() },
        });
      }

      return s;
    });

    this.logger.log(`Venta ${saleId} completada, decrementando stock...`);
    await this.decrementStockForSale(saleId);
    this.logger.log(`Stock decrementado para venta ${saleId}`);

    this.internetVouchers.generateVouchersForSale(saleId).catch(err => this.logger.error(`Error generando vouchers para sale ${saleId}: ${err}`));

    return updatedSale;
  }

  async markTicketPrinted(saleId: string, requester: { id: string; role: string }) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { user: true },
    });
    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
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

  async cancelQrSale(saleId: string, requester: { id: string; role: string }) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { user: true },
    });
    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }
    this.assertCanAccessSale(sale, requester, 'POST /sales/:id/cancel');
    if (sale.status === SaleStatus.APPROVED) {
      throw new BadRequestException('La venta ya está aprobada');
    }

    await this.mpService.deleteOrder();

    const updatedSale = await this.prisma.sale.update({
      where: { id: saleId },
      data: {
        status: SaleStatus.CANCELLED,
        paymentStatus: PaymentStatus.REJECTED,
        statusUpdatedAt: new Date(),
        cancelledAt: new Date(),
      },
    });

    return { saleId: updatedSale.id, status: updatedSale.status };
  }

  private assertCanAccessSale(
    sale: { userId: string },
    requester: { id: string; role: string; sub?: string },
    endpoint: string,
  ) {
    const requesterId = requester.sub ?? requester.id;
    this.logger.debug(
      `${endpoint} auth check saleUserId=${sale.userId} requesterId=${requester.id} requesterSub=${requester.sub} resolvedId=${requesterId} requesterRole=${requester.role}`,
    );
    if (requester.role !== 'ADMIN' && sale.userId !== requesterId) {
      throw new ForbiddenException('No tienes acceso a esta venta');
    }
  }

  private handlePrismaError(error: unknown, action: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error(`Error Prisma al ${action}: ${error.code}`, error.message);
      throw new BadRequestException(
        `No se pudo ${action}. Verificá las migraciones de la base de datos.`,
      );
    }
    throw error;
  }

  private async expireIfNeeded(
    sale: {
      id: string;
      status: SaleStatus;
      paymentStartedAt: Date | null;
      user: unknown;
    },
  ) {
    if (sale.status !== SaleStatus.PENDING || !sale.paymentStartedAt) {
      return null;
    }
    const cutoff = new Date(Date.now() - this.paymentExpirationMinutes * 60 * 1000);
    if (sale.paymentStartedAt > cutoff) {
      return null;
    }
    await this.mpService.deleteOrder();
    return this.prisma.sale.update({
      where: { id: sale.id },
      data: {
        status: SaleStatus.EXPIRED,
        paymentStatus: PaymentStatus.EXPIRED,
        statusUpdatedAt: new Date(),
        expiredAt: new Date(),
      },
      include: {
        user: { select: { id: true, username: true } },
        items: { include: { product: { include: { category: true } } } },
      },
    });
  }

  private async buildSaleItems(items: SaleItemInputDto[]) {
    const productIds = items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('Producto inválido o inactivo');
    }

    // Validar que no se vendan RAW_MATERIAL
    for (const product of products) {
      if (product.type === ProductType.RAW_MATERIAL) {
        throw new BadRequestException(`No se puede vender ${product.name}: es una materia prima`);
      }
    }

    // Get or create counters for each product and assign order numbers
    const saleItems = [];
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      const price = Number(product.price);
      const subtotal = this.roundToCurrency(price * item.quantity);

      // Get or create counter for this product
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

  async decrementStockForSale(saleId: string) {
    this.logger.log(`[STOCK] Procesando venta ${saleId}`);
    
    const saleItems = await this.prisma.saleItem.findMany({
      where: { saleId },
      include: {
        product: {
          include: {
            recipeAsComposite: {
              include: {
                rawMaterial: true,
              },
            },
          },
        },
      },
    });

    if (saleItems.length === 0) {
      this.logger.warn(`[STOCK] Venta ${saleId} sin items`);
      return;
    }

    for (const item of saleItems) {
      const product = item.product;
      
      if (!product) {
        this.logger.error(`[STOCK] Item sin producto`);
        continue;
      }

      if (product.type === ProductType.COMPOSITE) {
        for (const ingredient of product.recipeAsComposite) {
          const qty = Number(ingredient.quantity);
          const totalQty = qty * item.quantity;

          await this.prisma.product.update({
            where: { id: ingredient.rawMaterialId },
            data: { stock: { decrement: totalQty } },
          });

          this.logger.log(`[STOCK] ${ingredient.rawMaterial.name}: decrementado ${totalQty}`);
        }
      } else {
        await this.prisma.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });

        this.logger.log(`[STOCK] ${product.name}: decrementado ${item.quantity}`);
      }
    }
  }

  private roundToCurrency(value: number) {
    return Math.round(value * 100) / 100;
  }

  private assertTotal(receivedTotal: number, computedTotal: number) {
    const roundedReceived = this.roundToCurrency(receivedTotal);
    if (Math.abs(roundedReceived - computedTotal) > 0.009) {
      throw new BadRequestException('El total no coincide con los items');
    }
  }

  private pickLatestPayment(response: unknown) {
    if (!response || typeof response !== 'object') {
      return null;
    }
    const results = (response as { results?: Array<Record<string, unknown>> }).results;
    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }
    return results
      .slice()
      .sort((left, right) => {
        const leftDate =
          typeof left.date_last_updated === 'string'
            ? Date.parse(left.date_last_updated)
            : typeof left.date_created === 'string'
              ? Date.parse(left.date_created)
              : 0;
        const rightDate =
          typeof right.date_last_updated === 'string'
            ? Date.parse(right.date_last_updated)
            : typeof right.date_created === 'string'
              ? Date.parse(right.date_created)
              : 0;
        return rightDate - leftDate;
      })[0];
  }

}
