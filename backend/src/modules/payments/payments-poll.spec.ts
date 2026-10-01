import { PaymentsService } from './payments.service';

describe('PaymentsService.pollTransfer overlap (incidente transferencia 2026-09-28)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('solapa 3 min hacia atrás desde el cursor para no perder pagos con aprobación tardía', async () => {
    const now = new Date('2026-09-28T15:52:02.000Z');
    const cursor = new Date('2026-09-28T15:52:02.000Z');
    const prisma = {
      setting: {
        findFirst: jest.fn().mockResolvedValue({ lastMpPollAt: cursor }),
        updateMany: jest.fn(),
      },
      movimientoMP: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const mpConfig = { getAccessToken: jest.fn().mockResolvedValue('token') } as any;
    const service = new PaymentsService(prisma, mpConfig, {} as any, {} as any, {} as any);

    let requestedUrl = '';
    global.fetch = jest.fn().mockImplementation((url: string) => {
      requestedUrl = url;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });
    });

    jest.useFakeTimers().setSystemTime(now);
    await service.pollTransfer(100, 'user-1');
    jest.useRealTimers();

    const begin = new URL(requestedUrl).searchParams.get('begin_date');
    expect(begin).toBe('2026-09-28T15:49:02.000Z');
  });

  it('encuentra un pago creado al borde de la ventana aunque se apruebe después', async () => {
    const prisma = {
      setting: {
        findFirst: jest.fn().mockResolvedValue({ lastMpPollAt: new Date() }),
        updateMany: jest.fn(),
      },
      movimientoMP: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const mpConfig = { getAccessToken: jest.fn().mockResolvedValue('token') } as any;
    const service = new PaymentsService(prisma, mpConfig, {} as any, {} as any, {} as any);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              id: 181294008248,
              status: 'approved',
              transaction_amount: 100,
              payment_method_id: 'account_money',
              operation_type: 'money_transfer',
              date_approved: new Date().toISOString(),
              payer: { first_name: 'Test' },
            },
          ],
        }),
    } as any);

    const result = await service.pollTransfer(100, 'user-1');

    expect(result).toEqual(
      expect.objectContaining({ hay_pago: true, payment_id: '181294008248' }),
    );
  });
});
