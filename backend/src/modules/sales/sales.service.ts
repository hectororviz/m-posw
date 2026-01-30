import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SaleStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { MercadoPagoInstoreService } from './services/mercadopago-instore.service';

const NON_PAYABLE_STATUSES = new Set<SaleStatus>([
  SaleStatus.CANCELLED,
  SaleStatus.EXPIRED,
  SaleStatus.FAILED,
]);

@Injectable()
export class SalesService {
  private readonly paymentExpirationMinutes = 10;
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private mpService: MercadoPagoInstoreService,
  ) {}

  async createSale(userId: string, dto: CreateSaleDto) {
    const productIds = dto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('Producto inválido o inactivo');
    }

    const items = dto.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const price = Number(product.price);
      return {
        productId: item.productId,
        quantity: item.quantity,
        subtotal: price * item.quantity,
      };
    });

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);

    return this.prisma.sale.create({
      data: {
        userId,
        total,
        status: SaleStatus.OPEN,
        statusUpdatedAt: new Date(),
        items: {
          create: items,
        },
      },
      include: { items: { include: { product: true } } },
    });
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

  async startMercadoPagoPayment(
    saleId: string,
    requester: { id: string; role: string; sub?: string },
    endpoint: string,
  ) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: { include: { product: true } }, user: true },
    });
    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }
    this.assertCanAccessSale(sale, requester, endpoint);
    if (sale.status === SaleStatus.PAID) {
      throw new BadRequestException('La venta ya está pagada');
    }
    if (NON_PAYABLE_STATUSES.has(sale.status)) {
      throw new BadRequestException('La venta no puede cobrarse en este estado');
    }
    const externalPosId = sale.user.externalPosId?.trim();
    if (!externalPosId) {
      throw new BadRequestException('La caja no tiene externalPosId configurado');
    }
    const externalStoreId =
      sale.user.externalStoreId?.trim() || this.config.get<string>('MP_DEFAULT_EXTERNAL_STORE_ID');
    if (!externalStoreId) {
      throw new BadRequestException('externalStoreId requerido para Mercado Pago');
    }

    const updatedSale = await this.prisma.sale.update({
      where: { id: saleId },
      data: {
        status: SaleStatus.PENDING_PAYMENT,
        statusUpdatedAt: new Date(),
        paymentStartedAt: new Date(),
      },
      include: { items: { include: { product: true } }, user: true },
    });

    try {
      await this.mpService.createOrUpdateOrder({
        externalStoreId,
        externalPosId,
        sale: updatedSale,
      });
    } catch (error) {
      await this.prisma.sale.update({
        where: { id: saleId },
        data: {
          status: SaleStatus.FAILED,
          statusUpdatedAt: new Date(),
          failedAt: new Date(),
        },
      });
      throw error;
    }

    return {
      saleId: updatedSale.id,
      status: updatedSale.status,
      startedAt: updatedSale.paymentStartedAt,
    };
  }

  async cancelMercadoPagoPayment(
    saleId: string,
    requester: { id: string; role: string; sub?: string },
    endpoint: string,
  ) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { user: true },
    });
    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }
    this.assertCanAccessSale(sale, requester, endpoint);
    if (sale.status === SaleStatus.PAID) {
      throw new BadRequestException('La venta ya está pagada');
    }
    const externalPosId = sale.user.externalPosId?.trim();
    if (!externalPosId) {
      throw new BadRequestException('La caja no tiene externalPosId configurado');
    }
    const externalStoreId =
      sale.user.externalStoreId?.trim() || this.config.get<string>('MP_DEFAULT_EXTERNAL_STORE_ID');
    if (!externalStoreId) {
      throw new BadRequestException('externalStoreId requerido para Mercado Pago');
    }

    await this.mpService.deleteOrder({
      externalStoreId,
      externalPosId,
    });

    const updatedSale = await this.prisma.sale.update({
      where: { id: saleId },
      data: {
        status: SaleStatus.CANCELLED,
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

  private async expireIfNeeded(
    sale: {
      id: string;
      status: SaleStatus;
      paymentStartedAt: Date | null;
      user: { externalPosId: string | null; externalStoreId: string | null };
    },
  ) {
    if (sale.status !== SaleStatus.PENDING_PAYMENT || !sale.paymentStartedAt) {
      return null;
    }
    const cutoff = new Date(Date.now() - this.paymentExpirationMinutes * 60 * 1000);
    if (sale.paymentStartedAt > cutoff) {
      return null;
    }
    const externalPosId = sale.user.externalPosId;
    const externalStoreId =
      sale.user.externalStoreId?.trim() || this.config.get<string>('MP_DEFAULT_EXTERNAL_STORE_ID');
    if (externalPosId && externalStoreId) {
      await this.mpService.deleteOrder({ externalStoreId, externalPosId });
    }
    return this.prisma.sale.update({
      where: { id: sale.id },
      data: {
        status: SaleStatus.EXPIRED,
        statusUpdatedAt: new Date(),
        expiredAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true, externalPosId: true, externalStoreId: true } },
        items: { include: { product: true } },
      },
    });
  }
}
