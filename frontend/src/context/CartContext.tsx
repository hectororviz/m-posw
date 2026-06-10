import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Product } from '../api/types';

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CartDiscount {
  categoriaNombre: string;
  porcentaje: number;
  monto: number;
  beneficioId: string;
}

export interface SocioCartData {
  socioId: number;
  uuid: string;
  nombre: string;
  nroSocio: number;
  beneficios: Array<{
    id: string;
    categoriaId: string | null;
    categoriaNombre: string | null;
    productoId: string | null;
    productoNombre: string | null;
    porcentaje: number;
    descuentoMaximo: number | null;
    limiteDiario: number | null;
  }>;
}

interface CartContextValue {
  items: CartItem[];
  discounts: CartDiscount[];
  socioData: SocioCartData | null;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setSocioData: (data: SocioCartData | null) => void;
  removeDiscounts: () => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const recalcDiscounts = (items: CartItem[], data: SocioCartData | null): CartDiscount[] => {
  if (!data) return [];

  // Separar beneficios por producto y por categoria
  const prodBenefits = data.beneficios.filter((b) => b.productoId);
  const catBenefits = data.beneficios.filter((b) => !b.productoId && b.categoriaId);

  const result: CartDiscount[] = [];
  const productosCubiertos = new Map<string, number>(); // productoId -> unidades ya cubiertas por beneficio de producto

  // 1. Aplicar beneficios de producto (tienen prioridad)
  for (const b of prodBenefits) {
    const item = items.find((i) => i.product.id === b.productoId);
    if (!item) continue;

    const limite = b.limiteDiario || item.quantity;
    const unidadesDescontar = Math.min(limite, item.quantity);
    if (unidadesDescontar <= 0) continue;

    const precio = Number(item.product.price);
    const porcentaje = Number(b.porcentaje);
    const tope = b.descuentoMaximo != null ? Number(b.descuentoMaximo) : null;
    let desc = precio * unidadesDescontar * (porcentaje / 100);
    if (tope !== null && desc > tope) desc = tope;

    if (desc > 0) {
      productosCubiertos.set(b.productoId!, unidadesDescontar);
      result.push({
        categoriaNombre: b.productoNombre || 'Beneficio',
        porcentaje,
        monto: Math.round(desc * 100) / 100,
        beneficioId: b.id,
      });
    }
  }

  // 2. Aplicar beneficios de categoria (solo sobre productos no cubiertos por beneficio de producto)
  for (const b of catBenefits) {
    let subtotal = 0;
    for (const item of items) {
      if (item.product.categoryId !== b.categoriaId) continue;
      const cubiertas = productosCubiertos.get(item.product.id) || 0;
      const disponibles = Math.max(0, item.quantity - cubiertas);
      if (disponibles > 0) {
        subtotal += Number(item.product.price) * disponibles;
      }
    }
    if (subtotal <= 0) continue;

    const porcentaje = Number(b.porcentaje);
    const tope = b.descuentoMaximo != null ? Number(b.descuentoMaximo) : null;
    let desc = subtotal * (porcentaje / 100);
    if (tope !== null && desc > tope) desc = tope;

    if (desc > 0) {
      result.push({
        categoriaNombre: b.categoriaNombre || 'Beneficio',
        porcentaje,
        monto: Math.round(desc * 100) / 100,
        beneficioId: b.id,
      });
    }
  }

  return result;
};

export const CartProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [socioData, setSocioData] = useState<SocioCartData | null>(null);
  const [discounts, setDiscounts] = useState<CartDiscount[]>([]);

  // Recalcular descuentos cada vez que cambian items o socioData
  useEffect(() => {
    setDiscounts(recalcDiscounts(items, socioData));
  }, [items, socioData]);

  const addItem = (product: Product) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity: Math.max(1, quantity) } : item,
      ),
    );
  };

  const removeDiscounts = () => {
    setSocioData(null);
    setDiscounts([]);
  };

  const clear = () => {
    setItems([]);
    setDiscounts([]);
    setSocioData(null);
  };

  const value = useMemo(() => ({
    items, discounts, socioData, addItem, removeItem, updateQuantity, setSocioData, removeDiscounts, clear,
  }), [items, discounts, socioData]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};
