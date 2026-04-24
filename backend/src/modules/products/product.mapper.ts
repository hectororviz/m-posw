type ProductWithPrice = { price: unknown };

type IngredientWithQuantity = { quantity: unknown };

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

export const mapIngredient = <T extends IngredientWithQuantity>(
  ingredient: T,
): Omit<T, 'quantity'> & { quantity: number } => ({
  ...ingredient,
  // NOTE: We convert Prisma Decimal to number for recipe quantities.
  quantity: Number(ingredient.quantity),
});

export const mapIngredients = <T extends IngredientWithQuantity>(
  ingredients: T[],
): Array<Omit<T, 'quantity'> & { quantity: number }> => ingredients.map(mapIngredient);
