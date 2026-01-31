import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, PaymentStatus, Prisma, SaleStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { CreateCashSaleDto, CreateQrSaleDto, SaleItemInputDto } from './dto/create-sale.dto';
import { MercadoPagoInstoreService } from './services/mercadopago-instore.service';

@Injectable()
export class SalesService {
  private readonly paymentExpirationMinutes = 2;
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private mpService: MercadoPagoInstoreService,
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

    try {
      return await this.prisma.sale.create({
        data: {
          userId,
          total: roundedTotal,
          status: SaleStatus.APPROVED,
          paymentStatus: PaymentStatus.OK,
          paymentMethod: PaymentMethod.CASH,
          cashReceived,
          changeAmount,
          statusUpdatedAt: new Date(),
          paidAt: new Date(),
          items: {
            create: items,
          },
        },
        include: { items: { include: { product: true } } },
      });
    } catch (error) {
      this.handlePrismaError(error, 'crear la venta en efectivo');
    }
  }

  async createQrSale(userId: string, dto: CreateQrSaleDto) {
    const { items, total } = await this.buildSaleItems(dto.items);
    const roundedTotal = this.roundToCurrency(total);
    this.assertTotal(dto.total, roundedTotal);

    let sale;
    try {
      sale = await this.prisma.sale.create({
        data: {
          userId,
          total: roundedTotal,
          status: SaleStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: PaymentMethod.MP_QR,
          statusUpdatedAt: new Date(),
          paymentStartedAt: new Date(),
          items: {
            create: items,
          },
        },
        include: { items: { include: { product: true } }, user: true },
      });
    } catch (error) {
      this.handlePrismaError(error, 'crear la venta con QR');
    }

    const externalStoreId =
      sale.user.externalStoreId?.trim() ||
      this.config.get<string>('MP_DEFAULT_EXTERNAL_STORE_ID');
    const externalPosId =
      sale.user.externalPosId?.trim() || this.config.get<string>('MP_DEFAULT_EXTERNAL_POS_ID');
    if (!externalStoreId || !externalPosId) {
      throw new BadRequestException(
        'externalStoreId y externalPosId requeridos para Mercado Pago',
      );
    }

    const externalReference = `sale-${sale.id}`;
    const saleWithReference = await this.prisma.sale.update({
      where: { id: sale.id },
      data: {
        mpExternalReference: externalReference,
        statusUpdatedAt: new Date(),
      },
      include: { items: { include: { product: true } }, user: true },
    });

    try {
      await this.mpService.createOrUpdateOrder({
        externalStoreId,
        externalPosId,
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
      status: saleWithReference.status,
      startedAt: saleWithReference.paymentStartedAt,
    };
  }

  listSales() {
    return this.prisma.sale.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSaleById(
    saleId: string,
    requester: { id: string; role: string },
  ) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        user: { select: { id: true, name: true, externalPosId: true, externalStoreId: true } },
        items: { include: { product: true } },
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
    return { saleId: finalSale.id, status: finalSale.status, updatedAt: finalSale.statusUpdatedAt };
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
    return {
      saleId: finalSale.id,
      paymentStatus: finalSale.paymentStatus,
      mpStatus: finalSale.mpStatus,
      mpStatusDetail: finalSale.mpStatusDetail,
    };
  }

  async completeSale(saleId: string, requester: { id: string; role: string }) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { user: true, items: { include: { product: true } } },
    });
    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }
    this.assertCanAccessSale(sale, requester, 'POST /sales/:id/complete');
    if (sale.paymentStatus !== PaymentStatus.OK) {
      throw new BadRequestException('La venta todavía no tiene pago aprobado');
    }
    if (sale.status === SaleStatus.APPROVED) {
      return sale;
    }
    return this.prisma.sale.update({
      where: { id: saleId },
      data: {
        status: SaleStatus.APPROVED,
        statusUpdatedAt: new Date(),
        paidAt: sale.paidAt ?? new Date(),
      },
      include: { items: { include: { product: true } } },
    });
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

    const externalStoreId =
      sale.user.externalStoreId?.trim() ||
      this.config.get<string>('MP_DEFAULT_EXTERNAL_STORE_ID');
    const externalPosId =
      sale.user.externalPosId?.trim() || this.config.get<string>('MP_DEFAULT_EXTERNAL_POS_ID');
    if (!externalStoreId || !externalPosId) {
      throw new BadRequestException(
        'externalStoreId y externalPosId requeridos para Mercado Pago',
      );
    }

    await this.mpService.deleteOrder({
      externalStoreId,
      externalPosId,
    });

    const updatedSale = await this.prisma.sale.update({
      where: { id: saleId },
      data: {
        status: SaleStatus.CANCELLED,
        paymentStatus: PaymentStatus.FAILED,
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
    const requesterSub = requester.sub ?? requester.id;
    this.logger.debug(
      `${endpoint} auth check saleUserId=${sale.userId} requesterId=${requester.id} requesterSub=${requesterSub} requesterRole=${requester.role}`,
    );
    if (requester.role !== 'ADMIN' && sale.userId !== requester.id) {
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
      user: { externalPosId: string | null; externalStoreId: string | null };
    },
  ) {
    if (sale.status !== SaleStatus.PENDING || !sale.paymentStartedAt) {
      return null;
    }
    const cutoff = new Date(Date.now() - this.paymentExpirationMinutes * 60 * 1000);
    if (sale.paymentStartedAt > cutoff) {
      return null;
    }
    const externalStoreId =
      sale.user.externalStoreId?.trim() ||
      this.config.get<string>('MP_DEFAULT_EXTERNAL_STORE_ID');
    const externalPosId =
      sale.user.externalPosId?.trim() || this.config.get<string>('MP_DEFAULT_EXTERNAL_POS_ID');
    if (externalPosId && externalStoreId) {
      await this.mpService.deleteOrder({ externalStoreId, externalPosId });
    }
    return this.prisma.sale.update({
      where: { id: sale.id },
      data: {
        status: SaleStatus.EXPIRED,
        paymentStatus: PaymentStatus.FAILED,
        statusUpdatedAt: new Date(),
        expiredAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true, externalPosId: true, externalStoreId: true } },
        items: { include: { product: true } },
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

    const saleItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const price = Number(product.price);
      const subtotal = this.roundToCurrency(price * item.quantity);
      return {
        productId: item.productId,
        quantity: item.quantity,
        subtotal,
      };
    });

    const total = saleItems.reduce((sum, item) => sum + item.subtotal, 0);

    return { items: saleItems, total };
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
}
