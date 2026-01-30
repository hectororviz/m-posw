import { ConfigService } from '@nestjs/config';
import { MercadoPagoInstoreService } from './mercadopago-instore.service';

describe('MercadoPagoInstoreService', () => {
  const originalFetch = global.fetch;
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'MP_ACCESS_TOKEN') return 'token';
      if (key === 'MP_COLLECTOR_ID') return 'collector-1';
      return null;
    }),
  } as unknown as ConfigService;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('arma la URL de orders con store y pos', () => {
    const service = new MercadoPagoInstoreService(config);

    expect(service.buildOrdersUrl('STORE_1', 'POS_1')).toBe(
      'https://api.mercadopago.com/instore/qr/seller/collectors/collector-1/stores/STORE_1/pos/POS_1/orders',
    );
  });

  it('arma la URL de orders solo con pos', () => {
    const service = new MercadoPagoInstoreService(config);

    expect(service.buildPosOrdersUrl('POS_1')).toBe(
      'https://api.mercadopago.com/instore/qr/seller/collectors/collector-1/pos/POS_1/orders',
    );
  });

  it('envía la orden con el token y la URL correcta', async () => {
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
      'https://api.mercadopago.com/instore/qr/seller/collectors/collector-1/stores/STORE_1/pos/POS_1/orders',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.items).toEqual([
      expect.objectContaining({
        title: 'Item A',
        quantity: 1,
        unit_price: 100,
        unit_measure: 'unit',
      }),
    ]);
    expect(body.total_amount).toBe(100);
  });

  it('elimina la orden con el token y la URL correcta', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '{}',
    });
    global.fetch = fetchMock as any;

    const service = new MercadoPagoInstoreService(config);

    await service.deleteOrder({
      externalStoreId: 'STORE_1',
      externalPosId: 'POS_1',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mercadopago.com/instore/qr/seller/collectors/collector-1/pos/POS_1/orders',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    );
  });
});
