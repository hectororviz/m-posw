import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';

describe('Product DTOs', () => {
  it('accepts price as numeric string for create', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: 'Agua',
      price: '1.5',
      categoryId: 'category-1',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.price).toBe(1.5);
    expect(typeof dto.price).toBe('number');
  });

  it('accepts price as number for create', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: 'Agua',
      price: 2.25,
      categoryId: 'category-1',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.price).toBe(2.25);
    expect(typeof dto.price).toBe('number');
  });

  it('accepts price as numeric string for update', async () => {
    const dto = plainToInstance(UpdateProductDto, { price: '3.75' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.price).toBe(3.75);
    expect(typeof dto.price).toBe('number');
  });
});
