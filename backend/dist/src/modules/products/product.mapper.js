"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapIngredients = exports.mapIngredient = exports.mapProducts = exports.mapProduct = void 0;
const mapProduct = (product) => ({
    ...product,
    price: Number(product.price),
});
exports.mapProduct = mapProduct;
const mapProducts = (products) => products.map(exports.mapProduct);
exports.mapProducts = mapProducts;
const mapIngredient = (ingredient) => ({
    ...ingredient,
    quantity: Number(ingredient.quantity),
});
exports.mapIngredient = mapIngredient;
const mapIngredients = (ingredients) => ingredients.map(exports.mapIngredient);
exports.mapIngredients = mapIngredients;
