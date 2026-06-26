export type Role = 'ADMIN' | 'USER';

export type ProductType = 'SIMPLE' | 'RAW_MATERIAL' | 'COMPOSITE';

export type ModuleKey =
  | 'POS'
  | 'VENTAS'
  | 'SOCIOS'
  | 'TESORERIA'
  | 'ACREEDORES'
  | 'PRODUCTOS'
  | 'INTERNET'
  | 'LIGAS'
  | 'PLAYERS'
  | 'REPORTES'
  | 'CONFIGURACION'
  | 'PATRIMONIO';

export type ModuleAccess = 'HIDDEN' | 'READ' | 'FULL';

export interface ModulePermission {
  module: ModuleKey;
  access: ModuleAccess;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
  homeModule: string | null;
  permissions: ModulePermission[];
}

export interface User {
  id: string;
  username: string;
  email?: string | null;
  role: Role;
  active?: boolean;
  homeModule?: string | null;
  externalPosId?: string | null;
  externalStoreId?: string | null;
  permissions?: ModulePermission[];
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

export type PaymentMethod = 'CASH' | 'MP_QR' | 'TRANSFER' | 'FIADO';
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
  username: string;
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
  vouchers?: SaleVoucher[];
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
  enableFiadoPayment?: boolean | null;
  enableSociosModule?: boolean | null;
  enableTreasuryModule?: boolean | null;
  enableAcreedoresModule?: boolean | null;
  enableInternetModule?: boolean | null;
  enableLigasModule?: boolean | null;
  enablePlayersModule?: boolean | null;
  enablePatrimonioModule?: boolean | null;
  enableAutoJournalPos?: boolean | null;
  enableAutoJournalAcreedores?: boolean | null;
  enableAutoJournalSocios?: boolean | null;
  movementInReasons?: string[];
  movementOutReasons?: string[];
  mpLinked?: boolean | null;
  mpTokenExpiresAt?: string | null;
  mpPosId?: string | null;
  mpQrData?: string | null;
}

export interface Liga {
  id: string;
  name: string;
  active: boolean;
}

export interface LigaCategoria {
  id: string;
  name: string;
  league_id: string;
}

export interface LigaEquipo {
  id: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  city: string;
}

export interface LigaPosicion {
  position: number;
  teamId: string;
  teamName: string;
  teamShortName: string;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  dg: number;
  pts: number;
}

export interface LigaProximoPartido {
  id: string;
  matchday: number | null;
  match_date: string | null;
  categoryName: string;
  opponentName: string;
  isLocal: boolean;
  isPast: boolean;
}

export interface LigaResultado {
  id: string;
  matchday: number | null;
  match_date: string | null;
  categoryName: string;
  localName: string;
  localGoals: number | null;
  awayGoals: number | null;
  awayName: string;
  isWon: boolean;
  isDraw: boolean;
}

export interface LigaMatchdayMatch {
  id: string;
  categoryName: string;
  status: string;
  localGoals: number | null;
  awayGoals: number | null;
  isLocal: boolean;
  isWon: boolean;
  isDraw: boolean;
}

export interface LigaMatchdayGroup {
  matchday: number;
  match_date: string | null;
  opponentName: string;
  isLocal: boolean;
  matches: LigaMatchdayMatch[];
}

export interface LigasConfig {
  id: string;
  nombre: string;
  leagueId: string;
  leagueName: string;
  teamId: string;
  teamName: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MpOauthStatus {
  linked: boolean;
  expiresAt: string | null;
  mpPosId: string | null;
  mpQrData: string | null;
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
    username: string;
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
  user?: { id: string; username: string };
  manualMovementCategory?: {
    id: string;
    categoryId: string;
    category: AccountingCategory;
  } | null;
}

export type LedgerAccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type JournalEntryStatus = 'DRAFT' | 'POSTED' | 'VOIDED';

export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  type: LedgerAccountType;
  active: boolean;
  acceptsEntries: boolean;
  parentId?: string | null;
  children?: LedgerAccount[];
  _count?: { lines: number };
}

export interface TreasuryAccount {
  id: string;
  code: string;
  name: string;
}

export interface JournalEntryLine {
  id: string;
  entryId: string;
  accountId: string;
  account: LedgerAccount;
  debit: number;
  credit: number;
  description?: string | null;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  sequenceNumber: number;
  fiscalYear: number;
  month: number;
  date: string;
  description: string;
  notes?: string | null;
  status: JournalEntryStatus;
  createdById: string;
  createdBy?: { id: string; username: string };
  postedAt?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  reversalOfId?: string | null;
  reversalOf?: { id: string; entryNumber: string; description: string } | null;
  reversalEntry?: { id: string; entryNumber: string; description: string } | null;
  lines: JournalEntryLine[];
  createdAt: string;
}

export interface EntryLineInput {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface TreasurySummary {
  availabilities: {
    accounts: { code: string; name: string; balance: number }[];
    total: number;
  };
  incomeStatement: {
    totalRevenue: number;
    totalExpense: number;
    netResult: number;
  };
  lastEntries: JournalEntry[];
}

export interface LedgerBookRow {
  entryNumber: string;
  date: string;
  description: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  status: string;
}

export interface LedgerAccountDetail {
  account: { id: string; code: string; name: string; type: string };
  isDebitNature: boolean;
  rows: {
    date: string;
    entryNumber: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }[];
  finalBalance: number;
}

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  totalDebit: number;
  totalCredit: number;
  debitBalance: number;
  creditBalance: number;
}

export interface TrialBalanceData {
  rows: TrialBalanceRow[];
  totals: { totalDebit: number; totalCredit: number; debitBalance: number; creditBalance: number };
}

export interface IncomeStatementData {
  revenueRows: { code: string; name: string; amount: number }[];
  expenseRows: { code: string; name: string; amount: number }[];
  totalRevenue: number;
  totalExpense: number;
  netResult: number;
}

export interface AvailabilityData {
  accounts: { code: string; name: string; balance: number }[];
  total: number;
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

export interface Acreedor {
  id: number;
  nombre: string;
  telefono?: string | null;
  notas?: string | null;
  activo: boolean;
  createdAt: string;
  alertaDeuda?: boolean;
  diasSinPagar?: number | null;
  saldo?: number;
}

export interface FiadoVentaItem {
  id: number;
  monto: number;
  createdAt: string;
  ventaId: string;
  saldoRestante?: number;
}

export interface PagoAcreedorItem {
  id: number;
  monto: number;
  medioPago: string;
  fecha: string;
  notas?: string | null;
}

export interface AcreedorDeuda {
  fiadoVentas: FiadoVentaItem[];
  pagos: PagoAcreedorItem[];
  totalFiado: number;
  totalPagado: number;
  saldoPendiente: number;
  deudaMasAntigua: string | null;
  diasSinPagar: number | null;
  alertaDeuda: boolean;
}

export interface AcreedoresResumen {
  deudaTotal: number;
  acreedoresConDeuda: number;
}

export interface SocioTipo {
  id: number;
  nombre: string;
  montoMensual: number;
  comentario?: string | null;
  activo: boolean;
  createdAt: string;
}

export interface Socio {
  id: number;
  nroSocio: number;
  dni: string;
  apellido: string;
  nombre: string;
  fechaNacimiento?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  socioTipoId: number;
  socioTipo?: SocioTipo;
  fechaAlta: string;
  estado: 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO';
  deudaTotal?: number;
  createdAt?: string;
}

export interface SocioCuotaItem {
  id: number;
  socioId: number;
  mes: number;
  anio: number;
  montoOriginal: number;
  montoPagado: number;
  estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADO';
  pagos: SocioPagoItem[];
  createdAt: string;
}

export interface SocioPagoItem {
  id: number;
  socioCuotaId: number;
  monto: number;
  fecha: string;
  observacion?: string | null;
}

export interface SocioMatrizFilas {
  socioId: number;
  nroSocio: number;
  apellido: string;
  nombre: string;
  tipo: string;
  estadoSocio: string;
  meses: Record<number, {
    estado: string;
    pendiente?: number;
    cuotaId?: number;
  }>;
  deudaAnual: number;
}

export interface SocioMatriz {
  anio: number;
  filas: SocioMatrizFilas[];
  totalesPorMes: Record<number, number>;
}

export interface SociosTesoreriaResumen {
  deudaTotal: number;
  sociosActivos: number;
  sociosConDeuda: number;
}

export interface StatsSummary {
  totalSales: number;
  salesCount: number;
  avgTicket: number;
  totalProducts: number;
  topProduct: string;
  byProduct: { name: string; quantity: number }[];
  byPaymentMethod: { method: string; total: number }[];
  byDay: { date: string; total: number }[];
}

export interface InternetPlan {
  id: string;
  name: string;
  duration: number;
  idleTimeout: number;
  downloadBandwidth: string;
  uploadBandwidth: string;
  price: number;
  active: boolean;
  position: number;
  productId?: string | null;
  product?: Product | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaleVoucher {
  id: string;
  saleId: string;
  planId: string;
  pin: string;
  active: boolean;
  plan?: InternetPlan | null;
  createdAt: string;
}

export interface VoucherListItem {
  id: string;
  saleOrderNumber: number;
  planName: string;
  planDuration: number;
  active: boolean;
  createdAt: string;
  saleCreatedAt: string;
  salePaidAt: string | null;
}

export interface VoucherStats {
  active_vouchers: number;
  generated_today: number;
  total_vouchers: number;
}

// ─── Players / Jugadores ─────────────────────────────────

export type Sex = 'M' | 'F';
export type AllowedSex = 'M' | 'F' | 'X';
export type PlayerCategoryType = 'AGE' | 'BIRTH_YEAR';

export interface Player {
  id: number;
  firstName: string;
  lastName: string;
  dni?: string | null;
  birthDate: string;
  sex: Sex;
  tournamentCount?: number;
  createdAt?: string;
  updatedAt?: string;
  tournaments?: PlayerTournamentBrief[];
}

export interface PlayerTournamentBrief {
  id: number;
  name: string;
  year: number;
  playerCategoryId?: number;
  fichadoAt?: string;
}

export interface PaginatedPlayers {
  data: Player[];
  total: number;
  page: number;
  limit: number;
}

export interface PlayerCategory {
  id: number;
  name: string;
  restrictionType: PlayerCategoryType;
  ageMin?: number | null;
  ageMax?: number | null;
  ageCutoffMonth?: number | null;
  ageCutoffDay?: number | null;
  birthYear?: number | null;
  active?: boolean;
  tournaments?: { id: number; name: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Tournament {
  id: number;
  name: string;
  year: number;
  allowedSex: AllowedSex;
  birthYearMin?: number | null;
  birthYearMax?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  categories?: PlayerCategory[];
  playerCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedTournaments {
  data: Tournament[];
  total: number;
  page: number;
  limit: number;
}

export interface EligiblePlayer {
  id: number;
  firstName: string;
  lastName: string;
  dni: string;
  birthDate: string;
  sex: Sex;
  assignedCategoryId: number | null;
  alreadyFichado: boolean;
  fichadoEnOtroTorneoMismoAnio: boolean;
  otroTorneoNombre: string | null;
}

export interface FichadoPlayer {
  id: number;
  firstName: string;
  lastName: string;
  dni: string;
  birthDate: string;
  sex: Sex;
  playerCategoryId: number;
  fichadoAt: string;
}

export interface PlayersDashboard {
  totalPlayers: number;
  totalTournaments: number;
  totalCategories: number;
  totalCoaches: number;
  playersInTournaments: number;
  totalWithoutTournament: number;
  playersByCategory: {
    tournamentId: number;
    tournamentName: string;
    tournamentMinPlayers: number | null;
    tournamentMaxPlayers: number | null;
    categoryName: string;
    count: number;
  }[];
  upcomingBirthdays: {
    id: number;
    firstName: string;
    lastName: string;
    birthDate: string;
    age: number;
    daysUntil: number;
    categoryName: string | null;
  }[];
}

// ─── Coaches / DT's ──────────────────────────────────────

export interface Coach {
  id: number;
  firstName: string;
  lastName: string;
  dni?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
  tournamentCount?: number;
  tournaments?: CoachTournamentBrief[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CoachTournamentBrief {
  id: number;
  name: string;
  year: number;
  categoryId: number;
  categoryName: string;
  fichadoAt?: string;
}

export interface PaginatedCoaches {
  data: Coach[];
  total: number;
  page: number;
  limit: number;
}

export interface TournamentCoachCategory {
  categoryId: number;
  categoryName: string;
  coach: {
    id: number;
    firstName: string;
    lastName: string;
    dni?: string | null;
    fichadoAt: string;
  } | null;
}

// ─── Patrimonio / Bienes ─────────────────────────────────

export type AssetEventType = 'ALTA' | 'MODIFICACION' | 'CAMBIO_ESTADO' | 'BAJA';

export interface AssetCategory {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { assets: number };
}

export interface AssetStatus {
  id: number;
  name: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { assets: number };
}

export interface Asset {
  id: number;
  name: string;
  description?: string | null;
  categoryId: number;
  category?: AssetCategory;
  statusId: number;
  status?: AssetStatus;
  location?: string | null;
  acquisitionDate?: string | null;
  acquisitionValue?: number | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssetEvent {
  id: number;
  assetId: number;
  eventType: AssetEventType;
  statusId?: number | null;
  status?: AssetStatus | null;
  description?: string | null;
  eventDate: string;
  userId: string;
  createdAt: string;
}

export interface PaginatedAssets {
  data: Asset[];
  total: number;
  page: number;
  limit: number;
}
