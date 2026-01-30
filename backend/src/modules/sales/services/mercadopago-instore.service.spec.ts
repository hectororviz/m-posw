import { ConfigService } from '@nestjs/config';
import { MercadoPagoInstoreService } from './mercadopago-instore.service';

describe('MercadoPagoInstoreService', () => {
  const originalFetch = global.fetch;
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'MP_ACCESS_TOKEN') return 'token';
      if (key === 'MP_COLLECTOR_ID') return 'collector-1';
      if (key === 'MP_CURRENCY_ID') return 'ARS';
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
        total: '100.00',
        items: [
          {
            productId: 'prod-1',
            product: { name: 'Item A', price: '50.00' },
            quantity: '2',
            subtotal: '100.00',
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
        sku_number: 'prod-1',
        category: 'POS',
        title: 'Item A',
        description: 'Item A',
        quantity: 2,
        unit_price: 50,
        unit_measure: 'unit',
        currency_id: 'ARS',
        total_amount: 100,
      }),
    ]);
    expect(body.total_amount).toBe(100);
    expect(typeof body.total_amount).toBe('number');
    expect(body.items[0].unit_measure).toBe('unit');
    expect(typeof body.items[0].unit_price).toBe('number');
    expect(typeof body.items[0].quantity).toBe('number');
    expect(body.external_reference).toBe('sale-sale-1');
  });

  it('calcula unit_price desde subtotal y quantity y total_amount correcto', async () => {
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
        id: 'sale-2',
        total: '6.00',
        items: [
          {
            productId: 'prod-2',
            product: { name: 'Item B', price: '9.00' },
            quantity: 3,
            subtotal: 6,
          },
        ],
      } as any,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.items[0].unit_price).toBe(2);
    expect(body.total_amount).toBe(6);
  });

  it('buildPayload calcula total con decimales y currency_id', () => {
    const service = new MercadoPagoInstoreService(config);

    const payload = service.buildPayload({
      id: 'sale-3',
      total: '6.00',
      items: [
        {
          id: 'item-1',
          productId: 'prod-3',
          product: { name: 'Item C', price: 1.5 },
          quantity: 4,
          subtotal: null,
        },
      ],
    } as any);

    expect(payload.total_amount).toBe(6);
    expect(payload.total_amount.toFixed(2)).toBe('6.00');
    expect(payload.items[0].total_amount).toBe(6);
    expect(payload.items[0].currency_id).toBe('ARS');
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

  it('envía el body JSON en request para PUT', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '{}',
    });
    global.fetch = fetchMock as any;

    const service = new MercadoPagoInstoreService(config);

    await (service as any).request('PUT', 'https://api.mercadopago.com/test', {
      total_amount: 10,
      items: [{ title: 'Item' }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mercadopago.com/test',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ total_amount: 10, items: [{ title: 'Item' }] }),
      }),
    );
  });
});
