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
  stock: number;
  iconName?: string | null;
  colorHex?: string | null;
  imagePath?: string | null;
  imageUpdatedAt?: string | null;
  active: boolean;
  categoryId: string;
  category?: Category;
}

export interface StockProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  categoryId: string;
}

export interface StockCategory {
  id: string;
  name: string;
  colorHex: string;
  products: StockProduct[];
}

export interface SaleItemInput {
  productId: string;
  quantity: number;
}

export type PaymentMethod = 'CASH' | 'MP_QR' | 'TRANSFER';
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
  orderNumber: number;
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
  orderNumber: number;
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

// Transfer payment types
export interface PollTransferRequest {
  monto_esperado: number;
}

export interface PollTransferResponse {
  hay_pago: boolean;
  monto?: number;
  pagador?: string;
  tipo?: string;
  fecha?: string;
  payment_id?: string;
}

export interface ConfirmTransferRequest {
  payment_id: string;
  monto_recibido: number;
  monto_esperado: number;
  items: { productId: string; quantity: number }[];
}

export interface ConfirmTransferResponse {
  success: boolean;
  saleId?: string;
  orderNumber?: number;
  message?: string;
}

export type TransferStatus = 'WAITING' | 'EXACT' | 'MORE' | 'LESS' | 'TIMEOUT' | 'CONFIRMED' | 'ERROR';
