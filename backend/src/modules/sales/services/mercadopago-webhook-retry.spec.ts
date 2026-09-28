import { MercadoPagoWebhookProcessorService } from './mercadopago-webhook-processor.service';

const buildProcessor = (prisma: any) =>
  new MercadoPagoWebhookProcessorService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any);

describe('MercadoPagoWebhookProcessorService retries (Fase 5 M1)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('encola retry persistente cuando el procesamiento falla y relanza', async () => {
    const prisma = {
      paymentEvent: { create: jest.fn().mockResolvedValue({}) },
      webhookRetry: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const service = buildProcessor(prisma);
    service.processWebhookCore = jest.fn().mockRejectedValue(new Error('DB down'));

    await expect(
      service.processWebhook({ body: {}, query: {}, resourceId: '123', topic: 'payment' }),
    ).rejects.toThrow('DB down');
    expect(prisma.webhookRetry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provider_topic_resourceId: { provider: 'MP', topic: 'payment', resourceId: '123' },
        },
      }),
    );
  });

  it('marca DONE cuando el reintento del cron tiene éxito', async () => {
    const job = {
      id: 'job-1',
      topic: 'payment',
      resourceId: '123',
      payload: { body: {}, query: {} },
      requestId: null,
      attempts: 1,
    };
    const prisma = {
      webhookRetry: {
        findMany: jest.fn().mockResolvedValue([job]),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const service = buildProcessor(prisma);
    service.processWebhookCore = jest.fn().mockResolvedValue(undefined);

    await service.processDueRetries();

    expect(service.processWebhookCore).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: '123', topic: 'payment' }),
    );
    expect(prisma.webhookRetry.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-1' }, data: { status: 'DONE', lastError: null } }),
    );
  });

  it('marca DEAD tras agotar los 5 intentos para revisión manual', async () => {
    const job = {
      id: 'job-1',
      topic: 'payment',
      resourceId: '123',
      payload: { body: {}, query: {} },
      requestId: null,
      attempts: 4,
    };
    const prisma = {
      webhookRetry: {
        findMany: jest.fn().mockResolvedValue([job]),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const service = buildProcessor(prisma);
    service.processWebhookCore = jest.fn().mockRejectedValue(new Error('MP 500'));

    await service.processDueRetries();

    expect(prisma.webhookRetry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({ status: 'DEAD', attempts: 5 }),
      }),
    );
  });
});
