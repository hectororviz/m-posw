export type Role = 'ADMIN' | 'USER';

export type ProductType = 'SIMPLE' | 'RAW_MATERIAL' | 'COMPOSITE';

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface User {
  id: string;
  name: string;
  email?: string | null;
  role: Role;
  active?: boolean;
  externalPosId?: string | null;
  externalStoreId?: string | null;
}

export interface Category {
  id: string;
  name: string;
  iconName: string;
  colorHex: string;
  imagePath?: string | null;
  imageUpdatedAt?: string | null;
  active: boolean;
  ticket: boolean;
}

export interface RecipeIngredient {
  id: string;
  compositeId: string;
  rawMaterialId: string;
  quantity: number;
  rawMaterial: {
    id: string;
    name: string;
    stock: number;
  };
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  type: ProductType;
  iconName?: string | null;
  colorHex?: string | null;
  imagePath?: string | null;
  imageUpdatedAt?: string | null;
  active: boolean;
  categoryId: string;
  category?: Category;
  recipeIngredients?: RecipeIngredient[];
}

export interface StockProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  categoryId: string;
  type: ProductType;
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
  enableCashPayment?: boolean | null;
  enableQrPayment?: boolean | null;
  enableTransferPayment?: boolean | null;
  movementInReasons?: string[];
  movementOutReasons?: string[];
  mpLinked?: boolean | null;
  mpTokenExpiresAt?: string | null;
}

export interface MpOauthStatus {
  linked: boolean;
  expiresAt: string | null;
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

export interface CashClose {
  id: string;
  from: string;
  to: string;
  closedAt: string;
  note?: string | null;
  closedByUserId: string;
  closedBy?: {
    id: string;
    name: string;
    role: string;
  };
  salesCashTotal: number;
  salesQrTotal: number;
  salesTransferTotal: number;
  salesTotal: number;
  salesCount: number;
  movementsOutTotal: number;
  movementsInTotal: number;
  movementsNet: number;
  netCashDelta: number;
  movementsCount: number;
}

export type AccountingMovementType = 'INCOME' | 'EXPENSE';

export interface AccountingCategory {
  id: string;
  name: string;
  type: AccountingMovementType;
  active: boolean;
  _count?: { movements: number };
}

export interface AccountingMovement {
  id: string;
  type: AccountingMovementType;
  amount: number;
  description: string;
  date: string;
  categoryId: string;
  refMovementId?: string | null;
  category?: AccountingCategory;
  createdAt: string;
  updatedAt: string;
}

export interface ManualMovementWithCategory {
  id: string;
  createdAt: string;
  type: 'ENTRADA' | 'SALIDA';
  amount: number;
  reason: string;
  userId: string;
  user?: { id: string; name: string };
  manualMovementCategory?: {
    id: string;
    categoryId: string;
    category: AccountingCategory;
  } | null;
}

export interface AccountingSummary {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  jornadaSalesTotal: number;
  jornadaMovementsInTotal: number;
  jornadaMovementsOutTotal: number;
  accountingMovementsInTotal: number;
  accountingMovementsOutTotal: number;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    type: AccountingMovementType;
    total: number;
  }>;
  monthlySeries: Array<{
    month: string;
    income: number;
    expense: number;
  }>;
}
