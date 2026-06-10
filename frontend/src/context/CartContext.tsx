import { createContext, useContext, useMemo, useState } from 'react';
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
  setDiscounts: (discounts: CartDiscount[]) => void;
  setSocioData: (data: SocioCartData | null) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [discounts, setDiscounts] = useState<CartDiscount[]>([]);
  const [socioData, setSocioData] = useState<SocioCartData | null>(null);

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

  const clear = () => {
    setItems([]);
    setDiscounts([]);
    setSocioData(null);
  };

  const value = useMemo(() => ({ items, discounts, socioData, addItem, removeItem, updateQuantity, setDiscounts, setSocioData, clear }), [items, discounts, socioData]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};
