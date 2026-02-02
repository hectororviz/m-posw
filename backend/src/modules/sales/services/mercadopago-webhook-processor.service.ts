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
  private readonly paymentRetryDelaysMs = [3000, 10000, 20000];

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

  private async processMerchantOrder(
    merchantOrderId: string,
    resourceUrl: string | null,
    requestId?: string,
  ) {
    if (!merchantOrderId || merchantOrderId === 'unknown') {
      this.logger.warn('WEBHOOK_MP_MERCHANT_ORDER_ID_MISSING');
      return;
    }

    try {
      const merchantOrder = await this.mpQueryService.getMerchantOrderByResource(
        resourceUrl,
        merchantOrderId,
      );
      const merchantOrderPayload = isRecord(merchantOrder) ? merchantOrder : null;
      const externalReference = extractExternalReference(merchantOrderPayload);
      const payments = Array.isArray(merchantOrderPayload?.payments)
        ? (merchantOrderPayload?.payments as Array<unknown>).filter(isRecord)
        : [];
      const selectedPayment = this.selectPaymentFromMerchantOrder(payments);
      const paymentIdValue = selectedPayment?.id ? String(selectedPayment.id) : null;

      this.logger.log(
        `WEBHOOK_MP_MERCHANT_ORDER_FETCHED merchantOrderId=${merchantOrderId} payments_len=${payments.length} requestId=${requestId ?? 'unknown'}`,
      );

      if (!paymentIdValue) {
        await this.handleMerchantOrderWithoutPayments(
          merchantOrderId,
          externalReference,
          resourceUrl,
          merchantOrderPayload,
          requestId,
        );
        return;
      }

      this.logger.log(
        `WEBHOOK_MP_MERCHANT_ORDER_PAYMENT_SELECTED merchantOrderId=${merchantOrderId} paymentId=${paymentIdValue} status=${selectedPayment?.status ?? 'unknown'} requestId=${requestId ?? 'unknown'}`,
      );

      const saleOverride = await this.findSaleForMerchantOrder(
        externalReference,
        merchantOrderId,
        paymentIdValue,
      );
      await this.processPayment(
        paymentIdValue,
        requestId,
        merchantOrderId,
        saleOverride,
        'merchant_order',
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

  private async handleMerchantOrderWithoutPayments(
    merchantOrderId: string,
    externalReference: string | null,
    resourceUrl: string | null,
    merchantOrderPayload: Record<string, unknown> | null,
    requestId?: string,
  ) {
    this.logger.log(
      `WEBHOOK_MP_MERCHANT_ORDER_NO_PAYMENTS merchantOrderId=${merchantOrderId} requestId=${requestId ?? 'unknown'}`,
    );

    const sale = await this.findSaleForMerchantOrder(
      externalReference,
      merchantOrderId,
      null,
    );
    if (!sale) {
      this.logger.warn(
        `WEBHOOK_MP_SALE_NOT_FOUND topic=merchant_order merchantOrderId=${merchantOrderId} requestId=${requestId ?? 'unknown'}`,
      );
      this.schedulePaymentRetries({
        merchantOrderId,
        resourceUrl,
        externalReference,
        requestId,
      });
      return;
    }

    const resolvedSaleStatus =
      sale.status === SaleStatus.APPROVED ? SaleStatus.APPROVED : SaleStatus.PENDING;
    const shouldUpdate =
      sale.paymentStatus !== PaymentStatus.PENDING ||
      sale.status !== resolvedSaleStatus ||
      sale.mpMerchantOrderId !== merchantOrderId;
    if (!shouldUpdate) {
      this.logger.log(
        `WEBHOOK_MP_STATUS_IDEMPOTENT topic=merchant_order saleId=${sale.id} status=${sale.status} requestId=${requestId ?? 'unknown'}`,
      );
      return;
    }

    const updateData: Prisma.SaleUpdateInput = {
      paymentStatus: PaymentStatus.PENDING,
      status: resolvedSaleStatus,
      mpMerchantOrderId: merchantOrderId,
      updatedAt: new Date(),
      mpRaw: toJsonValue(merchantOrderPayload),
    };

    if (resolvedSaleStatus !== sale.status) {
      updateData.statusUpdatedAt = new Date();
    }

    const updatedSale = await this.prisma.sale.update({
      where: { id: sale.id },
      data: updateData,
    });

    this.logger.log(
      `WEBHOOK_MP_STATUS_UPDATED topic=merchant_order saleId=${updatedSale.id} merchantOrderId=${merchantOrderId} paymentId=none status=${updatedSale.status} requestId=${requestId ?? 'unknown'}`,
    );

    this.schedulePaymentRetries({
      merchantOrderId,
      resourceUrl,
      externalReference,
      requestId,
    });
  }

  private selectPaymentFromMerchantOrder(payments: Array<Record<string, unknown>>) {
    const normalizedPayments = payments
      .map((payment) => ({
        id: payment?.id,
        status: typeof payment?.status === 'string' ? payment.status : null,
        statusDetail: typeof payment?.status_detail === 'string' ? payment.status_detail : null,
        dateApproved:
          typeof payment?.date_approved === 'string' ? payment.date_approved : null,
        dateCreated: typeof payment?.date_created === 'string' ? payment.date_created : null,
        lastModified:
          typeof payment?.last_modified === 'string' ? payment.last_modified : null,
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

  private resolvePaymentTimestamp(payment: {
    dateApproved: string | null;
    dateCreated: string | null;
    lastModified: string | null;
  }) {
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

  private async findSaleForMerchantOrder(
    externalReference: string | null,
    merchantOrderId: string,
    paymentId: string | null,
  ) {
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

  private schedulePaymentRetries(input: {
    merchantOrderId: string;
    resourceUrl: string | null;
    externalReference: string | null;
    requestId?: string;
  }) {
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

  private async retryPaymentConfirmation(
    state: { resolved: boolean },
    input: {
      merchantOrderId: string;
      resourceUrl: string | null;
      externalReference: string | null;
      requestId?: string;
    },
    delay: number,
  ) {
    if (state.resolved) {
      return;
    }
    const { merchantOrderId, resourceUrl, externalReference, requestId } = input;

    const merchantOrderPayload = await this.safeFetchMerchantOrder(
      resourceUrl,
      merchantOrderId,
      requestId,
      delay,
    );
    const payments = Array.isArray(merchantOrderPayload?.payments)
      ? (merchantOrderPayload?.payments as Array<unknown>).filter(isRecord)
      : [];
    let paymentIdValue = this.extractPaymentIdFromPayments(payments);

    if (!paymentIdValue && externalReference) {
      paymentIdValue = await this.findPaymentIdByExternalReference(
        externalReference,
        requestId,
        delay,
      );
    }

    if (!paymentIdValue) {
      this.logger.log(
        `WEBHOOK_MP_RETRY_NO_PAYMENT merchantOrderId=${merchantOrderId} delayMs=${delay} requestId=${requestId ?? 'unknown'}`,
      );
      return;
    }

    state.resolved = true;
    this.logger.log(
      `WEBHOOK_MP_RETRY_PAYMENT_FOUND merchantOrderId=${merchantOrderId} paymentId=${paymentIdValue} delayMs=${delay} requestId=${requestId ?? 'unknown'}`,
    );
    await this.processPayment(paymentIdValue, requestId, merchantOrderId, null, 'payment');
  }

  private extractPaymentIdFromPayments(payments: Array<Record<string, unknown>>) {
    const selectedPayment = this.selectPaymentFromMerchantOrder(payments);
    return selectedPayment?.id ? String(selectedPayment.id) : null;
  }

  private async safeFetchMerchantOrder(
    resourceUrl: string | null,
    merchantOrderId: string,
    requestId?: string,
    delayMs?: number,
  ) {
    try {
      const merchantOrder = await this.mpQueryService.getMerchantOrderByResource(
        resourceUrl,
        merchantOrderId,
      );
      return isRecord(merchantOrder) ? merchantOrder : null;
    } catch (error) {
      this.logger.warn(
        `WEBHOOK_MP_RETRY_MERCHANT_ORDER_FAILED merchantOrderId=${merchantOrderId} delayMs=${delayMs ?? 0} requestId=${requestId ?? 'unknown'}`,
      );
      if (error instanceof Error) {
        this.logger.debug(error.message);
      }
      return null;
    }
  }

  private async findPaymentIdByExternalReference(
    externalReference: string,
    requestId?: string,
    delayMs?: number,
  ) {
    try {
      const searchResult = await this.mpQueryService.searchPaymentsByExternalReference(
        externalReference,
      );
      const payments = this.extractSearchResults(searchResult);
      return this.extractPaymentIdFromPayments(payments);
    } catch (error) {
      this.logger.warn(
        `WEBHOOK_MP_RETRY_SEARCH_FAILED externalReference=${externalReference} delayMs=${delayMs ?? 0} requestId=${requestId ?? 'unknown'}`,
      );
      if (error instanceof Error) {
        this.logger.debug(error.message);
      }
      return null;
    }
  }

  private extractSearchResults(payload: unknown) {
    if (Array.isArray(payload)) {
      return payload.filter(isRecord);
    }
    if (isRecord(payload) && Array.isArray(payload.results)) {
      return payload.results.filter(isRecord);
    }
    return [];
  }
}
