import { Body, Controller, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SaleStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { MercadoPagoInstoreService } from '../services/mercadopago-instore.service';

@Controller('webhooks')
export class MercadoPagoWebhookController {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private mpService: MercadoPagoInstoreService,
  ) {}

  @Post('mercadopago')
  async handleWebhook(@Body() body: Record<string, any>, @Query('secret') secret?: string) {
    const expectedSecret = this.config.get<string>('MP_WEBHOOK_SECRET');
    if (expectedSecret && secret !== expectedSecret) {
      throw new UnauthorizedException('Webhook inválido');
    }

    const paymentId =
      body?.data?.id?.toString?.() ||
      body?.payment_id?.toString?.() ||
      body?.id?.toString?.();

    if (!paymentId) {
      return { received: true };
    }

    const payment = await this.mpService.getPayment(paymentId);
    const externalReference = payment?.external_reference;
    if (!externalReference) {
      return { received: true };
    }

    const sale = await this.prisma.sale.findUnique({ where: { id: externalReference } });
    if (!sale) {
      return { received: true };
    }

    const status = payment?.status ?? 'unknown';
    const approvedAt = payment?.date_approved ? new Date(payment.date_approved) : null;

    await this.prisma.mercadoPagoPayment.create({
      data: {
        saleId: sale.id,
        paymentId: paymentId.toString(),
        status: status.toString(),
        approvedAt,
        payload: payment,
      },
    });

    if (status === 'approved' && sale.status !== SaleStatus.PAID) {
      await this.prisma.sale.update({
        where: { id: sale.id },
        data: {
          status: SaleStatus.PAID,
          statusUpdatedAt: new Date(),
          paidAt: approvedAt ?? new Date(),
        },
      });
    }

    return { received: true };
  }
}
