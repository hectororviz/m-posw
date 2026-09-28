import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, PaymentStatus, ProductType, SaleStatus } from '@prisma/client';
import { MercadoPagoConfig, PaymentRefund } from 'mercadopago';
import { MercadoPagoConfigService } from '../../common/mp-config.service';
import { PrismaService } from '../../common/prisma.service';
import { InternetVouchersService } from '../../internet-vouchers/internet-vouchers.service';
import { toJsonValue } from '../webhooks/mercadopago-webhook.utils';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private prisma: PrismaService,
    private mpConfig: MercadoPagoConfigService,
    private internetVouchers: InternetVouchersService,
  ) {}

  async refundSale(saleId: string, requester: { id: string; role: string }) {
    if (requester.role !== 'ADMIN') {
      throw new ForbiddenException('Solo un administrador puede reembolsar ventas');
    }

    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: {
          include: {
            product: { include: { recipeAsComposite: true } },
          },
        },
      },
    });
    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }
    if (sale.paymentMethod !== PaymentMethod.MP_QR) {
      throw new BadRequestException('Solo se pueden reembolsar ventas con QR de Mercado Pago');
    }
    if (
      sale.refundedAt ||
      sale.paymentStatus === PaymentStatus.REFUNDED ||
      sale.paymentStatus === PaymentStatus.CHARGEBACK
    ) {
      throw new ConflictException('La venta ya fue reembolsada');
    }
    if (sale.paymentStatus !== PaymentStatus.APPROVED || sale.status !== SaleStatus.APPROVED) {
      throw new BadRequestException('Solo se pueden reembolsar ventas aprobadas');
    }
    if (!sale.mpPaymentId) {
      throw new BadRequestException('La venta no tiene payment_id de Mercado Pago asociado');
    }

    const token = await this.mpConfig.getAccessToken();
    if (!token) {
      throw new HttpException('MP access token no configurado', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    let refundResponse: unknown = null;
    try {
      const client = new PaymentRefund(new MercadoPagoConfig({ accessToken: token }));
      refundResponse = await client.create({
        payment_id: sale.mpPaymentId,
        requestOptions: { idempotencyKey: `refund:${sale.id}` },
      });
    } catch (error) {
      throw this.mapRefundError(error, sale.id);
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.sale.findUnique({ where: { id: saleId } });
      if (!current) {
        throw new NotFoundException('Venta no encontrada');
      }
      if (current.refundedAt || current.paymentStatus === PaymentStatus.REFUNDED) {
        throw new ConflictException('La venta ya fue reembolsada');
      }
      return tx.sale.update({
        where: { id: saleId },
        data: {
          paymentStatus: PaymentStatus.REFUNDED,
          status: SaleStatus.REJECTED,
          statusUpdatedAt: now,
          refundedAt: now,
          mpStatus: 'refunded',
          mpRaw: toJsonValue({ ...(typeof current.mpRaw === 'object' && current.mpRaw !== null ? current.mpRaw : {}), refund: refundResponse, refundedBy: requester.id, refundedAt: now.toISOString() }),
        },
      });
    });

    await this.incrementStockForSale(saleId);

    try {
      await this.internetVouchers.deactivateBySale(saleId);
    } catch (error) {
      this.logger.warn(`Refund sale=${saleId}: no se pudieron desactivar vouchers: ${error}`);
    }

    this.logger.log(`Venta reembolsada saleId=${saleId} by=${requester.id}`);
    return updated;
  }

  private async incrementStockForSale(saleId: string) {
    const saleItems = await this.prisma.saleItem.findMany({
      where: { saleId },
      include: {
        product: { include: { recipeAsComposite: true } },
      },
    });
    for (const item of saleItems) {
      const product = item.product;
      if (!product) {
        continue;
      }
      if (product.type === ProductType.COMPOSITE) {
        for (const ingredient of product.recipeAsComposite) {
          const qty = Number(ingredient.quantity);
          const totalQty = qty * item.quantity;
          await this.prisma.product.update({
            where: { id: ingredient.rawMaterialId },
            data: { stock: { increment: totalQty } },
          });
        }
      } else {
        await this.prisma.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
    this.logger.log(`[STOCK] Venta ${saleId} revertida por reembolso`);
  }

  private mapRefundError(error: unknown, saleId: string): HttpException {
    const message = error instanceof Error ? error.message : String(error);
    const status =
      typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status?: unknown }).status)
        : undefined;
    this.logger.error(`MP refund failed saleId=${saleId} status=${status ?? 'unknown'} message=${message}`);
    if (/already.*refund|refund.*already|already.*return/i.test(message) || status === 400) {
      return new ConflictException('Mercado Pago indica que el pago ya fue reembolsado o no admite devolución');
    }
    return new HttpException(
      `Mercado Pago error al reembolsar${status ? ` (${status})` : ''}: ${message}`,
      HttpStatus.BAD_GATEWAY,
    );
  }
}
