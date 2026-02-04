import { apiClient } from './client';
import type { CashMovement, CashMovementType } from './types';

export type CreateCashMovementDto = {
  type: CashMovementType;
  amount: number;
  reason: string;
  note?: string;
  printVoucher?: boolean;
};

export const getCurrentCashMovements = async (includeVoided: boolean) => {
  const response = await apiClient.get<CashMovement[]>('/cash-movements/current', {
    params: { includeVoided },
  });
  return response.data;
};

export const createCashMovement = async (dto: CreateCashMovementDto) => {
  const response = await apiClient.post<CashMovement>('/cash-movements', dto);
  return response.data;
};

export const voidCashMovement = async (id: string, voidReason: string) => {
  const response = await apiClient.post<CashMovement>(`/cash-movements/${id}/void`, { voidReason });
  return response.data;
};
