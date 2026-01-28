import { ConfigService } from '@nestjs/config';
import { MercadoPagoInstoreService } from './mercadopago-instore.service';

describe('MercadoPagoInstoreService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('envía la orden con el token y la URL correcta', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'MP_ACCESS_TOKEN') return 'token';
        if (key === 'MP_COLLECTOR_ID') return 'collector-1';
        return null;
      }),
    } as unknown as ConfigService;

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '{}',
    });
    global.fetch = fetchMock as any;

    const service = new MercadoPagoInstoreService(config);

    await service.createOrUpdateOrder({
      externalStoreId: 'STORE_1',
      externalPosId: 'POS_1',
      sale: {
        id: 'sale-1',
        total: 100,
        items: [
          {
            product: { name: 'Item A', price: 100 },
            quantity: 1,
            subtotal: 100,
          },
        ],
      } as any,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mercadopago.com/instore/orders/qr/seller/collectors/collector-1/stores/STORE_1/pos/POS_1',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    );
  });
});
