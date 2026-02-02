import { HttpException, Injectable, Logger } from '@nestjs/common';
import { PaymentStatus, Prisma, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { MercadoPagoQueryService } from './mercadopago-query.service';
import { SalesGateway } from '../websockets/sales.gateway';
import {
  extractExternalReference,
  extractMerchantOrderId,
  isRecord,
  mapPaymentStatus,
  mapSaleStatus,
  normalizeSaleId,
  toJsonValue,
} from '../webhooks/mercadopago-webhook.utils';

type WebhookPayload = {
  body: Record<string, unknown>;
  query: Record<string, string>;
  resourceId: string | null;
  requestId?: string;
  topic: string;
};

@Injectable()
export class MercadoPagoWebhookProcessorService {
  private readonly logger = new Logger(MercadoPagoWebhookProcessorService.name);

  constructor(
    private prisma: PrismaService,
    private mpQueryService: MercadoPagoQueryService,
    private salesGateway: SalesGateway,
  ) {}

  async processWebhook(payload: WebhookPayload) {
    const { topic, resourceId, requestId } = payload;
    const eventResourceId = resourceId ?? 'unknown';
    const shouldProcess = await this.ensureIdempotency(topic, eventResourceId);
    if (!shouldProcess) {
      return;
    }

    if (topic === 'merchant_order') {
      await this.processMerchantOrder(eventResourceId, requestId);
      return;
    }

    if (topic !== 'payment') {
      this.logger.warn(`WEBHOOK_MP_TOPIC_UNSUPPORTED topic=${topic} resourceId=${eventResourceId}`);
      return;
    }

    await this.processPayment(eventResourceId, requestId, null);
  }

  private async processMerchantOrder(merchantOrderId: string, requestId?: string) {
    if (!merchantOrderId || merchantOrderId === 'unknown') {
      this.logger.warn('WEBHOOK_MP_MERCHANT_ORDER_ID_MISSING');
      return;
    }

    try {
      const merchantOrder = await this.mpQueryService.getMerchantOrder(merchantOrderId);
      const merchantOrderPayload = isRecord(merchantOrder) ? merchantOrder : null;
      const externalReference = extractExternalReference(merchantOrderPayload);
      const payments = merchantOrderPayload?.payments as Array<{
        id?: string | number;
        status?: string;
      }>;
      const paymentId = payments?.find((payment) => payment?.id)?.id;
      const paymentIdValue = paymentId ? String(paymentId) : null;

      if (externalReference) {
        await this.processMerchantOrderByExternalReference(
          externalReference,
          paymentIdValue,
          merchantOrderId,
          requestId,
        );
        return;
      }

      if (paymentIdValue) {
        await this.processPayment(paymentIdValue, requestId, merchantOrderId, null, 'merchant_order');
        return;
      }

      this.logger.warn(
        `WEBHOOK_MP_PAYMENT_ID_MISSING merchantOrderId=${merchantOrderId} requestId=${requestId ?? 'unknown'}`,
      );
    } catch (error) {
      this.logger.warn(
        `WEBHOOK_MP_MERCHANT_ORDER_LOOKUP_FAILED merchantOrderId=${merchantOrderId} requestId=${requestId ?? 'unknown'}`,
      );
      if (error instanceof Error) {
        this.logger.debug(error.message);
      }
    }
  }

  private async processMerchantOrderByExternalReference(
    externalReference: string,
    paymentId: string | null,
    merchantOrderId: string,
    requestId?: string,
  ) {
    const sale = await this.findSaleByExternalReference(
      externalReference,
      merchantOrderId,
      paymentId,
    );
    if (!sale) {
      this.logger.warn(
        `WEBHOOK_MP_SALE_NOT_FOUND topic=merchant_order merchantOrderId=${merchantOrderId} requestId=${requestId ?? 'unknown'}`,
      );
      return;
    }

    if (!paymentId) {
      this.logger.warn(
        `WEBHOOK_MP_PAYMENT_ID_MISSING merchantOrderId=${merchantOrderId} saleId=${sale.id} requestId=${requestId ?? 'unknown'}`,
      );
      return;
    }

    await this.processPayment(paymentId, requestId, merchantOrderId, sale, 'merchant_order');
  }

  private async processPayment(
    paymentId: string,
    requestId?: string,
    merchantOrderId?: string | null,
    saleOverride?: {
      id: string;
      status: SaleStatus;
      paymentStatus: PaymentStatus | null;
      mpMerchantOrderId?: string | null;
      paidAt?: Date | null;
    } | null,
    contextTopic: 'payment' | 'merchant_order' = 'payment',
  ) {
    let mpData: unknown;
    try {
      mpData = await this.mpQueryService.getPayment(paymentId);
    } catch (error) {
      if (this.isPaymentNotFoundError(error)) {
        this.logger.warn(
          `WEBHOOK_IGNORED_PAYMENT_NOT_FOUND topic=${contextTopic} paymentId=${paymentId} requestId=${requestId ?? 'unknown'}`,
        );
        return;
      }
      throw error;
    }

    const mpPayload = isRecord(mpData) ? mpData : null;
    const externalReference = extractExternalReference(mpPayload);
    const sale =
      saleOverride ||
      (externalReference
        ? await this.findSaleByExternalReference(
            externalReference,
            merchantOrderId ?? null,
            paymentId,
          )
        : null) ||
      (paymentId
        ? await this.prisma.sale.findFirst({
            where: { mpPaymentId: paymentId },
          })
        : null);

    if (!sale) {
      this.logger.warn(
        `WEBHOOK_MP_SALE_NOT_FOUND topic=${contextTopic} paymentId=${paymentId} requestId=${requestId ?? 'unknown'}`,
      );
      return;
    }

    const mpStatus = typeof mpPayload?.status === 'string' ? mpPayload.status : null;
    const mpStatusDetail =
      typeof mpPayload?.status_detail === 'string' ? mpPayload.status_detail : null;
    const approvedAt =
      typeof mpPayload?.date_approved === 'string' ? new Date(mpPayload.date_approved) : null;
    const merchantOrderIdFromPayment = extractMerchantOrderId(mpPayload);
    const nextPaymentStatus = mapPaymentStatus(mpStatus);
    const nextSaleStatus = mapSaleStatus(nextPaymentStatus);
    const finalMerchantOrderId =
      merchantOrderId ?? merchantOrderIdFromPayment ?? sale.mpMerchantOrderId ?? null;

    if (!nextPaymentStatus || !nextSaleStatus) {
      this.logger.warn(
        `WEBHOOK_MP_STATUS_UNKNOWN topic=${contextTopic} paymentId=${paymentId} saleId=${sale.id} requestId=${requestId ?? 'unknown'}`,
      );
      return;
    }

    const resolvedSaleStatus =
      sale.status === SaleStatus.APPROVED ? SaleStatus.APPROVED : nextSaleStatus;
    const shouldUpdate =
      sale.paymentStatus !== nextPaymentStatus || sale.status !== resolvedSaleStatus;
    if (!shouldUpdate) {
      this.logger.log(
        `WEBHOOK_MP_STATUS_IDEMPOTENT topic=${contextTopic} paymentId=${paymentId} saleId=${sale.id} status=${sale.status} requestId=${requestId ?? 'unknown'}`,
      );
      return;
    }

    const updateData: Prisma.SaleUpdateInput = {
      paymentStatus: nextPaymentStatus,
      status: resolvedSaleStatus,
      paidAt: nextPaymentStatus === PaymentStatus.OK ? approvedAt ?? new Date() : sale.paidAt,
      mpPaymentId: paymentId,
      mpMerchantOrderId: finalMerchantOrderId ?? undefined,
      mpStatus,
      mpStatusDetail,
      updatedAt: new Date(),
      mpRaw: toJsonValue(mpPayload ?? mpData),
    };

    if (resolvedSaleStatus !== sale.status) {
      updateData.statusUpdatedAt = new Date();
    }

    const updatedSale = await this.prisma.sale.update({
      where: { id: sale.id },
      data: updateData,
    });

    this.salesGateway.notifyPaymentStatusChanged({
      saleId: updatedSale.id,
      paymentStatus: updatedSale.paymentStatus,
      mpStatus: updatedSale.mpStatus,
      mpStatusDetail: updatedSale.mpStatusDetail,
    });

    this.logger.log(
      `WEBHOOK_MP_STATUS_UPDATED topic=${contextTopic} saleId=${updatedSale.id} merchantOrderId=${finalMerchantOrderId ?? 'unknown'} paymentId=${paymentId} status=${updatedSale.status} requestId=${requestId ?? 'unknown'}`,
    );
  }

  private async findSaleByExternalReference(
    externalReference: string,
    merchantOrderId: string | null,
    paymentId: string | null,
  ) {
    const saleIdFromReference = normalizeSaleId(externalReference);

    return (
      (saleIdFromReference
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
        : null)
    );
  }

  private async ensureIdempotency(topic: string, resourceId: string) {
    try {
      await this.prisma.paymentEvent.create({
        data: {
          provider: 'MP',
          topic,
          resourceId,
        },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }

  private isPaymentNotFoundError(error: unknown) {
    if (!(error instanceof HttpException)) {
      return false;
    }
    const response = error.getResponse();
    const responseText = typeof response === 'string' ? response : JSON.stringify(response);
    return (
      responseText.includes('Mercado Pago error 404') &&
      responseText.includes('Payment not found')
    );
  }
}
