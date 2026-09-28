import { WebhookRetriesService } from './webhook-retries.service';

describe('WebhookRetriesService', () => {
  const buildService = () => {
    const prisma = {
      webhookRetry: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }: any) => ({ id: 'r1', ...data })),
      },
    } as any;
    return { service: new WebhookRetriesService(prisma), prisma };
  };

  it('rechaza no-ADMIN en listado y reintento', async () => {
    const { service } = buildService();
    await expect(service.listRetries({ id: 'u', role: 'USER' }, {})).rejects.toThrow('Solo un administrador');
    await expect(service.retryNow('r1', { id: 'u', role: 'USER' })).rejects.toThrow('Solo un administrador');
  });

  it('lista paginado con filtro de estado', async () => {
    const { service, prisma } = buildService();
    const result = await service.listRetries(
      { id: 'a', role: 'ADMIN' },
      { status: 'DEAD', page: 2, limit: 10 },
    );
    expect(prisma.webhookRetry.count).toHaveBeenCalledWith({ where: { status: 'DEAD' } });
    expect(prisma.webhookRetry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(result).toEqual(expect.objectContaining({ total: 1, page: 2, limit: 10 }));
  });

  it('reintento resetea a PENDING y 404 si no existe', async () => {
    const { service, prisma } = buildService();
    prisma.webhookRetry.findUnique.mockResolvedValueOnce(null);
    await expect(service.retryNow('nope', { id: 'a', role: 'ADMIN' })).rejects.toThrow('no encontrado');

    prisma.webhookRetry.findUnique.mockResolvedValueOnce({ id: 'r1', topic: 'payment' });
    const result = await service.retryNow('r1', { id: 'a', role: 'ADMIN' });
    expect(prisma.webhookRetry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({ status: 'PENDING', attempts: 0 }),
      }),
    );
    expect(result.status).toBe('PENDING');
  });
});
