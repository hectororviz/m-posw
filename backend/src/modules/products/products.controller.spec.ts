import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  it('maps price to number for listActive', async () => {
    const service = {
      listActive: jest.fn().mockResolvedValue([
        {
          id: 'product-1',
          name: 'Agua',
          price: '1.5',
          iconName: null,
          colorHex: null,
          imagePath: null,
          imageUpdatedAt: null,
          active: true,
          categoryId: 'category-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    } as unknown as ProductsService;

    const controller = new ProductsController(service);
    const result = await controller.listActive();

    expect(typeof result[0].price).toBe('number');
    expect(result[0].price).toBe(1.5);
  });
});
