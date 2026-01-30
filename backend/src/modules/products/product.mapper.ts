type ProductWithPrice = { price: unknown };

export const mapProduct = <T extends ProductWithPrice>(
  product: T,
): Omit<T, 'price'> & { price: number } => ({
  ...product,
  // NOTE: We convert Prisma Decimal to number for POS price ranges.
  price: Number(product.price),
});

export const mapProducts = <T extends ProductWithPrice>(
  products: T[],
): Array<Omit<T, 'price'> & { price: number }> => products.map(mapProduct);
