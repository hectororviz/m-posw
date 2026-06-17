import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface HomeMetrics {
  pos?: {
    ventasHoy: number;
    ventasSemana: number;
  };
  socios?: {
    activos: number;
    cuotasVencidas: number;
  };
  acreedores?: {
    activos: number;
    deudaTotal: number;
  };
  internet?: {
    vouchersActivos: number;
    vouchersVencenHoy: number;
  };
  stock?: {
    productos: number;
    categorias: number;
  };
}

export function useHomeMetrics() {
  return useQuery({
    queryKey: ['home-metrics'],
    queryFn: async () => {
      const response = await apiClient.get<HomeMetrics>('/home/metrics');
      return response.data;
    },
    staleTime: 60000,
  });
}
