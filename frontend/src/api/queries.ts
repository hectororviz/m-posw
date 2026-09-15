import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type { Acreedor, AcreedorDeuda, AcreedoresResumen, CashClose, Category, Coach, ConversationMessagesResponse, ConversationsResponse, EligiblePlayer, FichadoPlayer, InternetPlan, Liga, LigaCategoria, LigaEquipo, LigaPosicion, LigaProximoPartido, LigaResultado, LigaMatchdayGroup, LigasConfig, ManualMovement, MpOauthStatus, NotifBatchStatus, NotificationStatusMap, NotificacionesConfig, NotificacionesHistoryResponse, NotificacionesJob, NotificacionesQueueResponse, NotificarDeudaBatchRequest, NotificarDeudaBatchResponse, PaginatedCoaches, PaginatedPlayers, PaginatedTournaments, Player, PlayerCategory, PlayersDashboard, Product, Sale, Setting, Socio, SocioCuotaItem, SocioMatriz, SocioTipo, SociosTesoreriaResumen, StatsSummary, StockCategory, Tournament, TournamentCoachCategory, MoneyAccount, MoneyCategory, FinanzasSummary, FinanzasMovementsResponse, User, VoucherDetail, VoucherListItem, VoucherStats, InternetHealth, StaffVoucher, Asset, AssetCategory, AssetStatus, AssetEvent, PaginatedAssets, UnreadCountResponse, WhatsAppMessage, WhatsAppPhoneInfo, WhatsAppTemplateInfo } from './types';

const sevenMinutes = 7 * 60 * 1000;
const fiveMinutes = 5 * 60 * 1000;
const tenMinutes = 10 * 60 * 1000;

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

export const usePublicSettings = () =>
  useQuery({
    queryKey: ['settings-public'],
    queryFn: async () => {
      const response = await apiClient.get<Setting>('/settings/public');
      return response.data;
    },
    staleTime: sevenMinutes,
  });

export const useSettings = () => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<Setting>('/settings');
        return response.data;
      } catch (err: unknown) {
        if ((err as { response?: { status?: number } })?.response?.status === 401) {
          const pub = await apiClient.get<Setting>('/settings/public');
          return pub.data;
        }
        throw err;
      }
    },
    staleTime: sevenMinutes,
    placeholderData: () => queryClient.getQueryData<Setting>(['settings']),
    retry: false,
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

// Finanzas simples (caja por cuentas + categorías)

export const useMoneyAccounts = () =>
  useQuery({
    queryKey: ['finanzas-accounts'],
    queryFn: async () => {
      const response = await apiClient.get<MoneyAccount[]>('/finanzas/accounts');
      return response.data;
    },
    staleTime: fiveMinutes,
  });

export const useMoneyCategories = () =>
  useQuery({
    queryKey: ['finanzas-categories'],
    queryFn: async () => {
      const response = await apiClient.get<MoneyCategory[]>('/finanzas/categories');
      return response.data;
    },
    staleTime: fiveMinutes,
  });

export const useFinanzasSummary = (params?: { from?: string; to?: string }) =>
  useQuery({
    queryKey: ['finanzas-summary', params],
    queryFn: async () => {
      const response = await apiClient.get<FinanzasSummary>('/finanzas/summary', { params });
      return response.data;
    },
  });

export const useFinanzasMovements = (params?: {
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) =>
  useQuery({
    queryKey: ['finanzas-movements', params],
    queryFn: async () => {
      const response = await apiClient.get<FinanzasMovementsResponse>('/finanzas/movements', {
        params,
      });
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

export const useInternetVouchers = (saleId?: string, enriched = true) =>
  useQuery({
    queryKey: ['internet-vouchers', saleId, enriched],
    queryFn: async () => {
      const response = await apiClient.get<VoucherListItem[]>('/internet/vouchers/list', {
        params: { ...(saleId ? { saleId } : {}), ...(enriched ? { enriched: 'true' } : {}) },
      });
      return response.data;
    },
    staleTime: 30000,
  });

export const useInternetStats = () =>
  useQuery({
    queryKey: ['internet-stats'],
    queryFn: async () => {
      const response = await apiClient.get<VoucherStats>('/internet/vouchers/stats');
      return response.data;
    },
  });

export const useInternetVoucherDetail = (pin: string | null) =>
  useQuery({
    queryKey: ['internet-voucher-detail', pin],
    queryFn: async () => {
      const response = await apiClient.get<VoucherDetail>(`/internet/vouchers/${pin}`);
      return response.data;
    },
    enabled: !!pin,
    staleTime: 30000,
  });

export const useInternetHealth = () =>
  useQuery({
    queryKey: ['internet-health'],
    queryFn: async () => {
      const response = await apiClient.get<InternetHealth>('/internet/vouchers/health');
      return response.data;
    },
    staleTime: 30000,
  });

export const useStaffVouchers = (enabled = true) =>
  useQuery({
    queryKey: ['staff-vouchers'],
    queryFn: async () => {
      const response = await apiClient.get<StaffVoucher[]>('/internet/staff-vouchers');
      return response.data;
    },
    enabled,
    staleTime: 30000,
  });

// --- Ligas ---

export const useLigasLeagues = () =>
  useQuery({
    queryKey: ['ligas-leagues'],
    queryFn: async () => {
      const response = await apiClient.get<Liga[]>('/ligas/leagues');
      return response.data;
    },
    staleTime: tenMinutes,
  });

export const useLigasCategories = (leagueId?: string) =>
  useQuery({
    queryKey: ['ligas-categories', leagueId],
    queryFn: async () => {
      const response = await apiClient.get<LigaCategoria[]>(`/ligas/leagues/${leagueId}/categories`);
      return response.data;
    },
    enabled: !!leagueId,
  });

export const useLigasTeams = (leagueId?: string) =>
  useQuery({
    queryKey: ['ligas-teams', leagueId],
    queryFn: async () => {
      const response = await apiClient.get<LigaEquipo[]>(`/ligas/leagues/${leagueId}/teams`);
      return response.data;
    },
    enabled: !!leagueId,
  });

export const useLigasStandings = (leagueId?: string, categoryId?: string) =>
  useQuery({
    queryKey: ['ligas-standings', leagueId, categoryId],
    queryFn: async () => {
      const params = new URLSearchParams({ leagueId: leagueId! });
      if (categoryId) params.set('categoryId', categoryId);
      const response = await apiClient.get<LigaPosicion[]>(`/ligas/standings?${params}`);
      return response.data;
    },
    enabled: !!leagueId,
    staleTime: fiveMinutes,
  });

export const useLigasNextMatches = (teamId?: string, leagueId?: string) =>
  useQuery({
    queryKey: ['ligas-next', teamId, leagueId],
    queryFn: async () => {
      const response = await apiClient.get<LigaProximoPartido[]>(
        `/ligas/teams/${teamId}/next-matches?leagueId=${leagueId}`,
      );
      return response.data;
    },
    enabled: !!teamId && !!leagueId,
  });

export const useLigasResults = (teamId?: string, leagueId?: string, categoryId?: string) =>
  useQuery({
    queryKey: ['ligas-results', teamId, leagueId, categoryId],
    queryFn: async () => {
      const params = new URLSearchParams({ leagueId: leagueId! });
      if (categoryId) params.set('categoryId', categoryId);
      const response = await apiClient.get<LigaResultado[]>(
        `/ligas/teams/${teamId}/results?${params}`,
      );
      return response.data;
    },
    enabled: !!teamId && !!leagueId,
    staleTime: fiveMinutes,
  });

export const useLigasAllMatches = (teamId?: string, leagueId?: string) =>
  useQuery({
    queryKey: ['ligas-all', teamId, leagueId],
    queryFn: async () => {
      const response = await apiClient.get<LigaMatchdayGroup[]>(
        `/ligas/teams/${teamId}/all-matches?leagueId=${leagueId}`,
      );
      return response.data;
    },
    enabled: !!teamId && !!leagueId,
    staleTime: fiveMinutes,
  });

export const useLigasConfigs = () =>
  useQuery({
    queryKey: ['ligas-configs'],
    queryFn: async () => {
      const response = await apiClient.get<LigasConfig[]>('/ligas/configs');
      return response.data;
    },
  });

export const useLigasCreateConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { nombre?: string; leagueId: string; leagueName: string; teamId: string; teamName: string }) => {
      const response = await apiClient.post<LigasConfig>('/ligas/configs', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ligas-configs'] });
    },
  });
};

export const useLigasDeleteConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/ligas/configs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ligas-configs'] });
    },
  });
};

// ─── Players / Jugadores ─────────────────────────────────

export const usePlayers = (params?: {
  search?: string;
  sex?: string;
  birthYear?: string;
  page?: number;
  limit?: number;
}) =>
  useQuery({
    queryKey: ['players', params],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedPlayers>('/players', { params });
      return response.data;
    },
  });

export const usePlayer = (id?: number) =>
  useQuery({
    queryKey: ['player', id],
    queryFn: async () => {
      const response = await apiClient.get<Player>(`/players/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });

export const usePlayerCategories = () =>
  useQuery({
    queryKey: ['player-categories'],
    queryFn: async () => {
      const response = await apiClient.get<PlayerCategory[]>('/player-categories');
      return response.data;
    },
  });

export const usePlayerCategory = (id?: number) =>
  useQuery({
    queryKey: ['player-category', id],
    queryFn: async () => {
      const response = await apiClient.get<PlayerCategory>(`/player-categories/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });

export const useTournaments = (params?: {
  year?: number;
  allowedSex?: string;
  page?: number;
  limit?: number;
}) =>
  useQuery({
    queryKey: ['tournaments', params],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedTournaments>('/tournaments', { params });
      return response.data;
    },
  });

export const useTournament = (id?: number) =>
  useQuery({
    queryKey: ['tournament', id],
    queryFn: async () => {
      const response = await apiClient.get<Tournament>(`/tournaments/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });

export const useTournamentPlayers = (tournamentId?: number, params?: {
  search?: string;
  categoryId?: number;
}) =>
  useQuery({
    queryKey: ['tournament-players', tournamentId, params],
    queryFn: async () => {
      const response = await apiClient.get<FichadoPlayer[]>(
        `/tournaments/${tournamentId}/players`,
        { params },
      );
      return response.data;
    },
    enabled: Boolean(tournamentId),
  });

export const useEligiblePlayers = (tournamentId?: number) =>
  useQuery({
    queryKey: ['eligible-players', tournamentId],
    queryFn: async () => {
      const response = await apiClient.post<EligiblePlayer[]>(
        `/tournaments/${tournamentId}/players/eligible`,
      );
      return response.data;
    },
    enabled: Boolean(tournamentId),
  });

export const usePlayersDashboard = () =>
  useQuery({
    queryKey: ['players-dashboard'],
    queryFn: async () => {
      const response = await apiClient.get<PlayersDashboard>('/players-stats/dashboard');
      return response.data;
    },
  });

// ─── Coaches / DT's ──────────────────────────────────────

export const useCoaches = (params?: {
  search?: string;
  page?: number;
  limit?: number;
}) =>
  useQuery({
    queryKey: ['coaches', params],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedCoaches>('/coaches', { params });
      return response.data;
    },
  });

export const useCoach = (id?: number) =>
  useQuery({
    queryKey: ['coach', id],
    queryFn: async () => {
      const response = await apiClient.get<Coach>(`/coaches/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });

export const useTournamentCoaches = (tournamentId?: number) =>
  useQuery({
    queryKey: ['tournament-coaches', tournamentId],
    queryFn: async () => {
      const response = await apiClient.get<TournamentCoachCategory[]>(
        `/tournaments/${tournamentId}/coaches`,
      );
      return response.data;
    },
    enabled: Boolean(tournamentId),
  });

// ─── Patrimonio / Bienes ─────────────────────────────────

export const useAssets = (params?: {
  categoryId?: number;
  statusId?: number;
  location?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}) =>
  useQuery({
    queryKey: ['assets', params],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedAssets>('/assets', { params });
      return response.data;
    },
  });

export const useAsset = (id?: number) =>
  useQuery({
    queryKey: ['asset', id],
    queryFn: async () => {
      const response = await apiClient.get<Asset>(`/assets/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });

export const useAssetEvents = (id?: number) =>
  useQuery({
    queryKey: ['asset-events', id],
    queryFn: async () => {
      const response = await apiClient.get<AssetEvent[]>(`/assets/${id}/events`);
      return response.data;
    },
    enabled: Boolean(id),
  });

export const useAssetCategories = () =>
  useQuery({
    queryKey: ['asset-categories'],
    queryFn: async () => {
      const response = await apiClient.get<AssetCategory[]>('/asset-categories');
      return response.data;
    },
  });

export const useAssetStatuses = () =>
  useQuery({
    queryKey: ['asset-statuses'],
    queryFn: async () => {
      const response = await apiClient.get<AssetStatus[]>('/asset-statuses');
      return response.data;
    },
  });

export const useCreateAsset = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      categoryId: number;
      location?: string;
      acquisitionDate?: string;
      acquisitionValue?: string;
      notes?: string;
    }) => {
      const response = await apiClient.post<Asset>('/assets', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
};

export const useUpdateAsset = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: number;
      name?: string;
      description?: string;
      categoryId?: number;
      location?: string;
      acquisitionDate?: string;
      acquisitionValue?: string;
      notes?: string;
    }) => {
      const response = await apiClient.patch<Asset>(`/assets/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
};

export const useChangeAssetStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, statusId, description }: {
      id: number;
      statusId: number;
      description?: string;
    }) => {
      const response = await apiClient.patch<Asset>(`/assets/${id}/status`, { statusId, description });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
};

export const useDeleteAsset = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete<Asset>(`/assets/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
};

export const useCreateAssetCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await apiClient.post<AssetCategory>('/asset-categories', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
    },
  });
};

export const useUpdateAssetCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const response = await apiClient.patch<AssetCategory>(`/asset-categories/${id}`, { name });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
    },
  });
};

export const useToggleAssetCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.patch<AssetCategory>(`/asset-categories/${id}/toggle`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
    },
  });
};

export const useCreateAssetStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await apiClient.post<AssetStatus>('/asset-statuses', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-statuses'] });
    },
  });
};

export const useUpdateAssetStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const response = await apiClient.patch<AssetStatus>(`/asset-statuses/${id}`, { name });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-statuses'] });
    },
  });
};

export const useToggleAssetStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.patch<AssetStatus>(`/asset-statuses/${id}/toggle`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-statuses'] });
    },
  });
};

export const useDeleteAssetStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/asset-statuses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-statuses'] });
    },
  });
};

// ─── Notificaciones (WhatsApp Cloud API) ─────────────────

export const useNotificacionesConfig = () =>
  useQuery({
    queryKey: ['notificaciones-config'],
    queryFn: async () => {
      const response = await apiClient.get<NotificacionesConfig>('/notificaciones/config');
      return response.data;
    },
    staleTime: 15000,
  });

export const useTestNotificacionesConnection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{ ok: boolean; message: string; phoneNumberId?: string }>('/notificaciones/test');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones-config'] });
    },
  });
};

export const useNotificacionesHistory = (page = 1, limit = 50, filters?: { status?: string; acreedorId?: number }) =>
  useQuery({
    queryKey: ['notificaciones-history', page, limit, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.acreedorId) params.set('acreedorId', String(filters.acreedorId));
      params.set('page', String(page));
      params.set('limit', String(limit));
      const response = await apiClient.get<NotificacionesHistoryResponse>(`/notificaciones/history?${params}`);
      return response.data;
    },
  });

export const useNotificacionesQueue = (status?: string, page = 1, limit = 50) =>
  useQuery({
    queryKey: ['notificaciones-queue', status, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      params.set('page', String(page));
      params.set('limit', String(limit));
      const response = await apiClient.get<NotificacionesQueueResponse>(`/notificaciones/queue?${params}`);
      return response.data;
    },
    refetchInterval: 8000,
  });

export const useNotificacionesRetry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobIds: number[]) => {
      const response = await apiClient.post('/notificaciones/queue/retry', { jobIds });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones-queue'] });
    },
  });
};

export const useNotificacionesPause = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/notificaciones/queue/pause');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones-queue'] });
    },
  });
};

export const useNotificacionesResume = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/notificaciones/queue/resume');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones-queue'] });
    },
  });
};

export const useNotificacionesCancelAll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/notificaciones/queue/cancel-all');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones-queue'] });
    },
  });
};

export const useNotificarDeuda = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (acreedorId: number) => {
      const response = await apiClient.post(`/acreedores/${acreedorId}/notificar-deuda`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones-queue'] });
    },
  });
};

export const useNotificarDeudaBatch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: NotificarDeudaBatchRequest) => {
      const response = await apiClient.post<NotificarDeudaBatchResponse>('/acreedores/notificar-deuda-batch', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acreedores'] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones-queue'] });
    },
  });
};

export const useBatchStatus = (batchId?: string) =>
  useQuery({
    queryKey: ['batch-status', batchId],
    queryFn: async () => {
      const response = await apiClient.get<NotifBatchStatus>(`/acreedores/batch/${batchId}/status`);
      return response.data;
    },
    enabled: Boolean(batchId),
    refetchInterval: 5000,
  });

export const useAcreedorNotificaciones = (acreedorId?: number) =>
  useQuery({
    queryKey: ['acreedor-notificaciones', acreedorId],
    queryFn: async () => {
      const response = await apiClient.get<NotificacionesJob[]>(`/acreedores/${acreedorId}/notificaciones`);
      return response.data;
    },
    enabled: Boolean(acreedorId),
  });

export const useNotificationStatus = (acreedorIds: number[]) =>
  useQuery({
    queryKey: ['notification-status', acreedorIds],
    queryFn: async () => {
      const ids = acreedorIds.join(',');
      const response = await apiClient.get<NotificationStatusMap>(`/acreedores/notification-status?ids=${ids}`);
      return response.data;
    },
    enabled: acreedorIds.length > 0,
  });

export const useConversations = (page = 1, limit = 50) =>
  useQuery({
    queryKey: ['notificaciones-conversations', page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      const response = await apiClient.get<ConversationsResponse>(`/notificaciones/conversations?${params}`);
      return response.data;
    },
    refetchInterval: 10000,
  });

export const useConversationMessages = (conversationId?: number, page = 1, limit = 100) =>
  useQuery({
    queryKey: ['conversation-messages', conversationId, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      const response = await apiClient.get<ConversationMessagesResponse>(`/notificaciones/conversations/${conversationId}/messages?${params}`);
      return response.data;
    },
    enabled: Boolean(conversationId),
  });

export const useSendConversationMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, text }: { conversationId: number; text: string }) => {
      const response = await apiClient.post(`/notificaciones/conversations/${conversationId}/send`, { text });
      return response.data;
    },
    onMutate: async ({ conversationId, text }) => {
      await queryClient.cancelQueries({ queryKey: ['conversation-messages', conversationId] });
      const previous = queryClient.getQueryData<ConversationMessagesResponse>(['conversation-messages', conversationId]);
      queryClient.setQueryData<ConversationMessagesResponse>(['conversation-messages', conversationId], (old) => {
        if (!old) return old;
        const optimisticMsg: WhatsAppMessage = {
          id: -(Date.now()),
          conversationId,
          direction: 'OUTBOUND',
          content: text,
          externalMessageId: null,
          status: 'sending',
          createdAt: new Date().toISOString(),
        };
        return { ...old, messages: [...old.messages, optimisticMsg], total: old.total + 1 };
      });
      return { previous };
    },
    onError: (_err, { conversationId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['conversation-messages', conversationId], context.previous);
      }
    },
    onSettled: (_data, _err, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversationId] });
    },
  });
};

export const useDeleteConversationMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, messageId }: { conversationId: number; messageId: number }) => {
      await apiClient.delete(`/notificaciones/conversations/${conversationId}/messages/${messageId}`);
    },
    onSuccess: (_data, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones-conversations'] });
    },
  });
};

export const useDeleteConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: number) => {
      await apiClient.delete(`/notificaciones/conversations/${conversationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-messages'] });
    },
  });
};

export const usePhoneInfo = () =>
  useQuery({
    queryKey: ['whatsapp-phone-info'],
    queryFn: async () => {
      const response = await apiClient.get<WhatsAppPhoneInfo>('/notificaciones/phone-info');
      return response.data;
    },
    enabled: false,
    retry: false,
  });

export const useWhatsAppTemplates = () =>
  useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: async () => {
      const response = await apiClient.get<WhatsAppTemplateInfo[]>('/notificaciones/templates');
      return response.data;
    },
    enabled: false,
    retry: false,
  });

export const useUnreadCount = () =>
  useQuery({
    queryKey: ['whatsapp-unread-count'],
    queryFn: async () => {
      const response = await apiClient.get<UnreadCountResponse>('/notificaciones/conversations/unread-count');
      return response.data;
    },
    refetchInterval: 10000,
  });

export const useMarkAllConversationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/notificaciones/conversations/read-all');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-unread-count'] });
    },
  });
};
