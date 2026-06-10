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
    categoriaId: string;
    categoriaNombre: string;
    porcentaje: number;
    descuentoMaximo: number | null;
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
  return data.beneficios
    .map((b) => {
      const catItems = items.filter((item) => item.product.categoryId === b.categoriaId);
      if (catItems.length === 0) return null;
      const catSubtotal = catItems.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
      const porcentaje = Number(b.porcentaje);
      const tope = b.descuentoMaximo != null ? Number(b.descuentoMaximo) : null;
      let desc = catSubtotal * (porcentaje / 100);
      if (tope !== null && desc > tope) {
        desc = tope;
      }
      return {
        categoriaNombre: b.categoriaNombre,
        porcentaje,
        monto: Math.round(desc * 100) / 100,
        beneficioId: b.id,
      };
    })
    .filter((d): d is CartDiscount => d !== null && d.monto > 0);
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
