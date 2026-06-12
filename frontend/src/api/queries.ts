import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type { AccountingCategory, AccountingMovement, AccountingSummary, Acreedor, AcreedorDeuda, AcreedoresResumen, AvailabilityData, CashClose, Category, IncomeStatementData, InternetPlan, JournalEntry, LedgerAccount, LedgerAccountDetail, LedgerBookRow, ManualMovement, ManualMovementWithCategory, MpOauthStatus, Product, Sale, Setting, Socio, SocioCuotaItem, SocioMatriz, SocioTipo, SociosTesoreriaResumen, StatsSummary, StockCategory, TreasuryAccount, TreasurySummary, TrialBalanceData, User, VoucherListItem, VoucherStats } from './types';

const sevenMinutes = 7 * 60 * 1000;

export const useCategories = () =>
  useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await apiClient.get<Category[]>('/categories');
      return response.data;
    },
    staleTime: sevenMinutes,
  });

export const useAdminCategories = () =>
  useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const response = await apiClient.get<Category[]>('/categories/all');
      return response.data;
    },
  });

export const useProductsByCategory = (categoryId?: string) =>
  useQuery({
    queryKey: ['products', categoryId],
    queryFn: async () => {
      const response = await apiClient.get<Product[]>('/categories/' + categoryId + '/products');
      return response.data;
    },
    enabled: Boolean(categoryId),
    staleTime: sevenMinutes,
  });

export const useAdminProducts = () =>
  useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const response = await apiClient.get<Product[]>('/products/all');
      return response.data;
    },
  });

export const useRawMaterials = () =>
  useQuery({
    queryKey: ['raw-materials'],
    queryFn: async () => {
      const response = await apiClient.get<Product[]>('/products/raw-materials');
      return response.data;
    },
  });

export const useSettings = () => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await apiClient.get<Setting>('/settings');
      return response.data;
    },
    staleTime: sevenMinutes,
    placeholderData: () => queryClient.getQueryData<Setting>(['settings']),
  });
};

export const useMpOauthStatus = () =>
  useQuery({
    queryKey: ['mp-oauth-status'],
    queryFn: async () => {
      const response = await apiClient.get<MpOauthStatus>('/mp-oauth/status');
      return response.data;
    },
  });

export const useUsers = () =>
  useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.get<User[]>('/users');
      return response.data;
    },
  });

export const useAdminSales = () =>
  useQuery({
    queryKey: ['admin-sales'],
    queryFn: async () => {
      const response = await apiClient.get<Sale[]>('/sales');
      return response.data;
    },
  });


export const useManualMovements = () =>
  useQuery({
    queryKey: ['manual-movements'],
    queryFn: async () => {
      const response = await apiClient.get<ManualMovement[]>('/sales/manual-movements');
      return response.data;
    },
  });

export const useLoginUsers = () =>
  useQuery({
    queryKey: ['login-users'],
    queryFn: async () => {
      const response = await apiClient.get<User[]>('/auth/login-users');
      return response.data;
    },
  });

export const useStock = () =>
  useQuery({
    queryKey: ['stock'],
    queryFn: async () => {
      const response = await apiClient.get<StockCategory[]>('/stock');
      return response.data;
    },
  });

export const useCashCloses = () =>
  useQuery({
    queryKey: ['cash-closes'],
    queryFn: async () => {
      const response = await apiClient.get<CashClose[]>('/cash-close/list');
      return response.data;
    },
  });

export const useAccountingCategories = (type?: string) =>
  useQuery({
    queryKey: ['accounting-categories', type],
    queryFn: async () => {
      const response = await apiClient.get<AccountingCategory[]>('/accounting/categories', {
        params: type ? { type } : undefined,
      });
      return response.data;
    },
  });

export const useAccountingMovements = (params?: {
  from?: string;
  to?: string;
  type?: string;
  categoryId?: string;
}) =>
  useQuery({
    queryKey: ['accounting-movements', params],
    queryFn: async () => {
      const response = await apiClient.get<AccountingMovement[]>('/accounting/movements', {
        params,
      });
      return response.data;
    },
  });

export const useAccountingManualMovements = (params?: {
  from?: string;
  to?: string;
  type?: string;
}) =>
  useQuery({
    queryKey: ['accounting-manual-movements', params],
    queryFn: async () => {
      const response = await apiClient.get<ManualMovementWithCategory[]>(
        '/accounting/manual-movements',
        { params },
      );
      return response.data;
    },
  });

export const useAccountingSummary = (params?: { from?: string; to?: string }) =>
  useQuery({
    queryKey: ['accounting-summary', params],
    queryFn: async () => {
      const response = await apiClient.get<AccountingSummary>('/accounting/summary', {
        params,
      });
      return response.data;
    },
  });

// Treasury queries

export const useLedgerAccounts = () =>
  useQuery({
    queryKey: ['treasury-ledger-accounts'],
    queryFn: async () => {
      const response = await apiClient.get<LedgerAccount[]>('/treasury/accounts/flat');
      return response.data;
    },
  });

export const useLedgerAccountsTree = () =>
  useQuery({
    queryKey: ['treasury-ledger-accounts-tree'],
    queryFn: async () => {
      const response = await apiClient.get<LedgerAccount[]>('/treasury/accounts');
      return response.data;
    },
  });

export const useImputableAssetAccounts = () =>
  useQuery({
    queryKey: ['treasury-asset-imputable'],
    queryFn: async () => {
      const response = await apiClient.get<LedgerAccount[]>('/treasury/accounts/asset-imputable');
      return response.data;
    },
  });

export const useImputableRevenueAccounts = () =>
  useQuery({
    queryKey: ['treasury-revenue-imputable'],
    queryFn: async () => {
      const response = await apiClient.get<LedgerAccount[]>('/treasury/accounts/revenue-imputable');
      return response.data;
    },
  });

export const useImputableExpenseAccounts = () =>
  useQuery({
    queryKey: ['treasury-expense-imputable'],
    queryFn: async () => {
      const response = await apiClient.get<LedgerAccount[]>('/treasury/accounts/expense-imputable');
      return response.data;
    },
  });

export const useTreasuryAccounts = () =>
  useQuery({
    queryKey: ['treasury-accounts'],
    queryFn: async () => {
      const response = await apiClient.get<TreasuryAccount[]>('/accounting/accounts/treasury');
      return response.data;
    },
  });

export const useJournalEntries = (params?: {
  from?: string;
  to?: string;
  status?: string;
  search?: string;
  accountId?: string;
}) =>
  useQuery({
    queryKey: ['treasury-journal-entries', params],
    queryFn: async () => {
      const response = await apiClient.get<JournalEntry[]>('/treasury/entries', { params });
      return response.data;
    },
  });

export const useJournalEntry = (id?: string) =>
  useQuery({
    queryKey: ['treasury-journal-entry', id],
    queryFn: async () => {
      const response = await apiClient.get<JournalEntry>(`/treasury/entries/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });

export const useTreasurySummary = (params?: { from?: string; to?: string }, enabled = true) =>
  useQuery({
    queryKey: ['treasury-summary', params],
    queryFn: async () => {
      const response = await apiClient.get<TreasurySummary>('/treasury/reports/summary', {
        params,
      });
      return response.data;
    },
    enabled,
  });

export const useLedgerBook = (params?: { from?: string; to?: string }) =>
  useQuery({
    queryKey: ['treasury-ledger-book', params],
    queryFn: async () => {
      const response = await apiClient.get<LedgerBookRow[]>('/treasury/reports/ledger-book', {
        params,
      });
      return response.data;
    },
  });

export const useLedgerAccountDetail = (accountId?: string, params?: { from?: string; to?: string }) =>
  useQuery({
    queryKey: ['treasury-ledger-account', accountId, params],
    queryFn: async () => {
      const response = await apiClient.get<LedgerAccountDetail>(
        '/treasury/reports/ledger-account',
        { params: { accountId, ...params } },
      );
      return response.data;
    },
    enabled: Boolean(accountId),
  });

export const useTrialBalance = (params?: { from?: string; to?: string }) =>
  useQuery({
    queryKey: ['treasury-trial-balance', params],
    queryFn: async () => {
      const response = await apiClient.get<TrialBalanceData>(
        '/treasury/reports/trial-balance',
        { params },
      );
      return response.data;
    },
  });

export const useIncomeStatement = (params?: { from?: string; to?: string }) =>
  useQuery({
    queryKey: ['treasury-income-statement', params],
    queryFn: async () => {
      const response = await apiClient.get<IncomeStatementData>(
        '/treasury/reports/income-statement',
        { params },
      );
      return response.data;
    },
  });

export const useAvailabilities = (asOf?: string) =>
  useQuery({
    queryKey: ['treasury-availabilities', asOf],
    queryFn: async () => {
      const response = await apiClient.get<AvailabilityData>(
        '/treasury/reports/availabilities',
        { params: { asOf } },
      );
      return response.data;
    },
  });

export const useAcreedores = () =>
  useQuery({
    queryKey: ['acreedores'],
    queryFn: async () => {
      const response = await apiClient.get<Acreedor[]>('/acreedores');
      return response.data;
    },
  });

export const useAcreedor = (id?: number) =>
  useQuery({
    queryKey: ['acreedor', id],
    queryFn: async () => {
      const response = await apiClient.get<Acreedor>(`/acreedores/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });

export const useAcreedorDeuda = (id?: number) =>
  useQuery({
    queryKey: ['acreedor-deuda', id],
    queryFn: async () => {
      const response = await apiClient.get<AcreedorDeuda>(`/acreedores/${id}/deuda`);
      return response.data;
    },
    enabled: Boolean(id),
  });

export const useAcreedoresResumen = () =>
  useQuery({
    queryKey: ['acreedores-resumen'],
    queryFn: async () => {
      const response = await apiClient.get<AcreedoresResumen>('/acreedores/resumen');
      return response.data;
    },
  });

export const useStatsSummary = (from?: string, to?: string) =>
  useQuery({
    queryKey: ['stats-summary', from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const response = await apiClient.get<StatsSummary>(`/stats/summary?${params.toString()}`);
      return response.data;
    },
  });

// ─── Socios ─────────────────────────────────────────────

export const useSociosTipos = () =>
  useQuery({
    queryKey: ['socios-tipos'],
    queryFn: async () => {
      const response = await apiClient.get<SocioTipo[]>('/socios/tipos');
      return response.data;
    },
  });

export const useSocios = (filters?: { estado?: string; socioTipoId?: string; deuda?: string }) =>
  useQuery({
    queryKey: ['socios', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.estado) params.set('estado', filters.estado);
      if (filters?.socioTipoId) params.set('socioTipoId', filters.socioTipoId);
      if (filters?.deuda) params.set('deuda', filters.deuda);
      const response = await apiClient.get<Socio[]>(`/socios?${params.toString()}`);
      return response.data;
    },
  });

export const useSocio = (id?: number) =>
  useQuery({
    queryKey: ['socio', id],
    queryFn: async () => {
      const response = await apiClient.get<Socio>(`/socios/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });

export const useSocioCuotas = (id?: number) =>
  useQuery({
    queryKey: ['socio-cuotas', id],
    queryFn: async () => {
      const response = await apiClient.get<SocioCuotaItem[]>(`/socios/${id}/cuotas`);
      return response.data;
    },
    enabled: Boolean(id),
  });

export const useSociosMatriz = (anio: number) =>
  useQuery({
    queryKey: ['socios-matriz', anio],
    queryFn: async () => {
      const response = await apiClient.get<SocioMatriz>(`/socios/reporte/matriz?anio=${anio}`);
      return response.data;
    },
    enabled: Boolean(anio),
  });

export const useSociosTesoreriaResumen = () =>
  useQuery({
    queryKey: ['socios-tesoreria-resumen'],
    queryFn: async () => {
      const response = await apiClient.get<SociosTesoreriaResumen>('/socios/tesoreria/resumen');
      return response.data;
    },
  });

// ─── Internet Vouchers ──────────────────────────────────

export const useInternetPlans = () =>
  useQuery({
    queryKey: ['internet-plans'],
    queryFn: async () => {
      const response = await apiClient.get<InternetPlan[]>('/internet/plans');
      return response.data;
    },
  });

export const useInternetVouchers = (saleId?: string) =>
  useQuery({
    queryKey: ['internet-vouchers', saleId],
    queryFn: async () => {
      const response = await apiClient.get<VoucherListItem[]>('/internet/vouchers/list', {
        params: saleId ? { saleId } : undefined,
      });
      return response.data;
    },
  });

export const useInternetStats = () =>
  useQuery({
    queryKey: ['internet-stats'],
    queryFn: async () => {
      const response = await apiClient.get<VoucherStats>('/internet/vouchers/stats');
      return response.data;
    },
  });
