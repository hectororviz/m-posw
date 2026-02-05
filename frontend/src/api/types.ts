export type Role = 'ADMIN' | 'USER';

export interface User {
  id: string;
  name: string;
  email?: string | null;
  role: Role;
  active?: boolean;
  externalPosId?: string | null;
  externalStoreId?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Category {
  id: string;
  name: string;
  iconName: string;
  colorHex: string;
  imagePath?: string | null;
  imageUpdatedAt?: string | null;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  iconName?: string | null;
  colorHex?: string | null;
  imagePath?: string | null;
  imageUpdatedAt?: string | null;
  active: boolean;
  categoryId: string;
  category?: Category;
}

export interface SaleItemInput {
  productId: string;
  quantity: number;
}

export type PaymentMethod = 'CASH' | 'MP_QR';
export type SaleStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
export type PaymentStatus =
  | 'PENDING'
  | 'IN_PROCESS'
  | 'WAITING_PAYMENT'
  | 'NONE'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface SaleItem {
  id: string;
  productId: string;
  quantity: number;
  subtotal: number;
  product: Product;
}

export interface SaleUser {
  id: string;
  name: string;
  email?: string | null;
}

export interface Sale {
  id: string;
  total: number;
  status: SaleStatus;
  paymentMethod?: PaymentMethod;
  cashReceived?: number | null;
  changeAmount?: number | null;
  createdAt: string;
  paidAt?: string | null;
  ticketPrintedAt?: string | null;
  items: SaleItem[];
  user?: SaleUser;
}


export interface ManualMovement {
  id: string;
  createdAt: string;
  type: 'ENTRADA' | 'SALIDA';
  amount: number;
  reason: string;
  userId: string;
}

export interface Setting {
  storeName?: string | null;
  clubName?: string | null;
  enableTicketPrinting?: boolean | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  okAnimationUrl?: string | null;
  errorAnimationUrl?: string | null;
  accentColor?: string | null;
}

export interface ApiErrorResponse {
  message?: string | string[];
}
