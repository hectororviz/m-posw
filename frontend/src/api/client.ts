import axios, { AxiosError } from 'axios';
import type { ApiErrorResponse } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const normalizeApiError = (error: unknown): string => {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const data = error.response?.data;
    if (Array.isArray(data?.message)) {
      return data?.message.join(', ');
    }
    if (typeof data?.message === 'string') {
      return data.message;
    }
    if (error.response?.statusText) {
      return error.response.statusText;
    }
  }
  if (error instanceof AxiosError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Error desconocido';
};

export const getApiOrigin = () => {
  if (API_BASE_URL.startsWith('http')) {
    return new URL(API_BASE_URL).origin;
  }
  return window.location.origin;
};

export const getUploadsBaseUrl = () => {
  const envBase = import.meta.env.VITE_UPLOADS_BASE_URL as string | undefined;
  if (envBase) {
    return envBase.replace(/\/$/, '');
  }
  return getApiOrigin();
};

export const getWsBaseUrl = () => {
  const envBase = import.meta.env.VITE_WS_BASE_URL as string | undefined;
  if (envBase) {
    return envBase.replace(/\/$/, '');
  }
  const origin = window.location.origin;
  if (origin.startsWith('https://')) {
    return origin.replace('https://', 'wss://');
  }
  if (origin.startsWith('http://')) {
    return origin.replace('http://', 'ws://');
  }
  return origin;
};

export const buildImageUrl = (imagePath?: string | null, imageUpdatedAt?: string | null) => {
  if (!imagePath) {
    return undefined;
  }
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  const base = getUploadsBaseUrl();
  const normalizedPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  const url = `${base}${normalizedPath}`;
  if (imageUpdatedAt) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${encodeURIComponent(imageUpdatedAt)}`;
  }
  return url;
};
