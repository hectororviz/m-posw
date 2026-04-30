import { apiClient, normalizeApiError, buildImageUrl } from '../api/client';
import type { Setting } from '../api/types';

export type TicketItemPayload = {
  qty: number;
  name: string;
  category?: string;
  orderNumber?: number;
};

export type TicketLinePayload = {
  label: string;
  value: string;
};

export type TicketPayload = {
  clubName?: string;
  storeName?: string;
  logoUrl?: string;
  dateTimeISO?: string;
  criteria?: TicketLinePayload[];
  summary?: TicketLinePayload[];
  items?: TicketItemPayload[];
  itemsStyle?: 'sale' | 'summary';
  total?: number;
  thanks?: string;
  footer?: string;
  title?: string;
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

const encodeBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
};

// Clean object removing undefined values for JSON serialization
const cleanPayload = (obj: Record<string, unknown>): Record<string, unknown> => {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned;
};

export const maybePrintTicket = async ({
  settings,
  storeFallback = 'SOLER - Bufet',
  dateTimeISO,
  total,
  items,
  saleId,
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

  // Build payload ensuring all numeric fields are actual numbers
  const logoUrl = buildImageUrl(settings.logoUrl);
  const payload = cleanPayload({
    clubName: settings.clubName || '',
    storeName: settings.storeName || storeFallback,
    logoUrl: logoUrl || undefined,
    dateTimeISO: dateTimeISO || undefined,
    items: items.map(item => cleanPayload({
      qty: Number(item.qty),
      name: String(item.name),
      category: item.category,
      orderNumber: item.orderNumber !== undefined ? Number(item.orderNumber) : undefined,
    })),
    total: Number(total),
    thanks: 'Gracias por tu compra',
    footer: 'Ticket no fiscal',
  });

  const ticketParam = encodeURIComponent(encodeBase64(JSON.stringify(payload)));
  const url = `/printticket?data=${ticketParam}`;
  
  // Use location.href instead of window.open to avoid popup blockers in WebView
  window.location.href = url;
  
  return { skipped: false, opened: true } as const;
};
