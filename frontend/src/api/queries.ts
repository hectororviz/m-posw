import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type { Category, Product, Setting, User } from './types';

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

export const useUsers = () =>
  useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.get<User[]>('/users');
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
