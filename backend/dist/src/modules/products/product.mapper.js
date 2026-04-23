"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapProducts = exports.mapProduct = void 0;
const mapProduct = (product) => ({
    ...product,
    price: Number(product.price),
});
exports.mapProduct = mapProduct;
const mapProducts = (products) => products.map(exports.mapProduct);
exports.mapProducts = mapProducts;
