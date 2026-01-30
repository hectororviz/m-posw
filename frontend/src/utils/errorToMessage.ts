import axios, { AxiosError } from 'axios';

type ApiError = { message?: string | string[] };

const getAxiosMessage = (error: AxiosError<ApiError>): string | undefined => {
  const data = error.response?.data;
  if (Array.isArray(data?.message)) {
    return data.message.join(', ');
  }
  if (typeof data?.message === 'string') {
    return data.message;
  }
  return error.message || undefined;
};

export const errorToMessage = (err: unknown): string => {
  if (typeof err === 'string') {
    return err;
  }
  if (axios.isAxiosError<ApiError>(err)) {
    return getAxiosMessage(err) ?? 'Error desconocido';
  }
  if (err instanceof Error) {
    return err.message;
  }
  try {
    const serialized = JSON.stringify(err);
    if (serialized) {
      return serialized;
    }
  } catch (error) {
    return String(error);
  }
  return String(err);
};
