import { apiClient, normalizeApiError } from '../api/client';
import type { Setting } from '../api/types';

export type TicketItemPayload = {
  qty: number;
  name: string;
};

export type TicketLinePayload = {
  label: string;
  value: string;
};

export type TicketPayload = {
  clubName?: string;
  storeName?: string;
  dateTimeISO?: string;
  criteria?: TicketLinePayload[];
  summary?: TicketLinePayload[];
  items?: TicketItemPayload[];
  total?: number;
  thanks?: string;
  footer?: string;
};

type PrintTicketInput = {
  settings?: Setting | null;
  storeFallback?: string;
  dateTimeISO?: string | null;
  total: number;
  items: TicketItemPayload[];
  saleId?: string;
  onPopupBlocked?: () => void;
  onAlreadyPrinted?: () => void;
  onError?: (message: string) => void;
};

const encodeBase64Url = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const base64 = window.btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

export const maybePrintTicket = async ({
  settings,
  storeFallback = 'SOLER - Bufet',
  dateTimeISO,
  total,
  items,
  saleId,
  onPopupBlocked,
  onAlreadyPrinted,
  onError,
}: PrintTicketInput) => {
  if (!settings?.enableTicketPrinting) {
    return { skipped: true, opened: false } as const;
  }

  if (saleId) {
    try {
      const response = await apiClient.post<{ alreadyPrinted: boolean }>(`/sales/${saleId}/ticket-printed`);
      if (response.data.alreadyPrinted) {
        onAlreadyPrinted?.();
        return { skipped: false, opened: false, alreadyPrinted: true } as const;
      }
    } catch (error) {
      onError?.(normalizeApiError(error));
      return { skipped: false, opened: false, error: true } as const;
    }
  }

  const payload: TicketPayload = {
    clubName: settings.clubName ?? '',
    storeName: settings.storeName ?? storeFallback,
    dateTimeISO: dateTimeISO ?? undefined,
    items,
    total,
    thanks: 'Gracias por tu compra',
    footer: 'Ticket no fiscal',
  };

  const ticketParam = encodeBase64Url(JSON.stringify(payload));
  const url = `/print/ticket?ticket=${ticketParam}&autoPrint=1&autoClose=1`;
  const popup = window.open(url, '_blank', 'noopener,noreferrer');

  if (!popup) {
    onPopupBlocked?.();
    return { skipped: false, opened: false } as const;
  }

  return { skipped: false, opened: true } as const;
};
