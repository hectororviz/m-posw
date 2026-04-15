import { useEffect, useMemo, useState } from 'react';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const formatDateTime = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} - ${hours}:${minutes}`;
};

type TicketItem = {
  qty: number;
  name: string;
  category?: string;
  orderNumber?: number;
};

type TicketLine = {
  label: string;
  value: string;
};

type TicketPayload = {
  clubName?: string;
  storeName?: string;
  dateTimeISO?: string;
  criteria?: TicketLine[];
  summary?: TicketLine[];
  items?: TicketItem[];
  itemsStyle?: 'sale' | 'summary';
  total?: number;
  thanks?: string;
  footer?: string;
};

declare global {
  interface Window {
    __TICKET__?: TicketPayload;
  }
}

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const padded = padding ? `${normalized}${'='.repeat(4 - padding)}` : normalized;
  const binary = window.atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const PrintTicketPage: React.FC = () => {
  const [ticket, setTicket] = useState<TicketPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const rawTicket = searchParams.get('ticket') || searchParams.get('data');
  const autoPrint = searchParams.get('autoPrint') === '1' || (rawTicket != null && searchParams.get('autoPrint') !== '0');
  const autoClose = searchParams.get('autoClose') === '1' || (rawTicket != null && searchParams.get('autoClose') !== '0');

  useEffect(() => {
    document.body.classList.add('ticket-print-body');
    return () => {
      document.body.classList.remove('ticket-print-body');
    };
  }, []);

  useEffect(() => {
    try {
      const rawTicket = searchParams.get('ticket') || searchParams.get('data');
      if (rawTicket) {
        const decoded = decodeBase64Url(rawTicket);
        setTicket(JSON.parse(decoded) as TicketPayload);
        return;
      }
      if (window.__TICKET__) {
        setTicket(window.__TICKET__);
        return;
      }
      setError('No se encontraron datos del ticket.');
    } catch (err) {
      setError('No se pudo leer el ticket.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!ticket || !autoPrint) {
      return;
    }
    const timer = window.setTimeout(() => {
      window.print();
    }, 250);
    const handleAfterPrint = () => {
      if (autoClose) {
        window.close();
      }
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [ticket, autoPrint, autoClose]);

  if (error) {
    return (
      <div className="ticket-page">
        <p className="ticket-error">{error}</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="ticket-page">
        <p className="ticket-error">Cargando ticket...</p>
      </div>
    );
  }

  const items = ticket.items ?? [];
  const total = ticket.total ?? 0;
  const criteria = ticket.criteria ?? [];
  const summary = ticket.summary ?? [];
  const itemsStyle = ticket.itemsStyle ?? 'sale';
  const showItems = items.length > 0;
  const showSummary = summary.length > 0;
  const showCriteria = criteria.length > 0;

  const sortedItems = [...items].sort((a, b) => {
    const aCat = a.category?.toLowerCase() ?? '';
    const bCat = b.category?.toLowerCase() ?? '';
    const aIsBebida = aCat === 'bebida' || aCat === 'bebidas';
    const bIsBebida = bCat === 'bebida' || bCat === 'bebidas';
    const aIsComida = aCat === 'comida';
    const bIsComida = bCat === 'comida';
    if (aIsBebida && !bIsBebida) return -1;
    if (!aIsBebida && bIsBebida) return 1;
    if (aIsComida && !bIsComida) return 1;
    if (!aIsComida && bIsComida) return -1;
    return 0;
  });

  return (
    <div className="ticket-page">
      {ticket.clubName && <p className="ticket-club">{ticket.clubName}</p>}
      <h1 className="ticket-title">{ticket.storeName ?? 'SOLER - Bufet'}</h1>
      <p className="ticket-date">{formatDateTime(ticket.dateTimeISO)}</p>
      {showCriteria && (
        <>
          <div className="ticket-divider" />
          <div className="ticket-criteria">
            {criteria.map((line) => (
              <div className="ticket-criteria-row" key={`${line.label}-${line.value}`}>
                <span>{line.label}</span>
                <strong>{line.value}</strong>
              </div>
            ))}
          </div>
        </>
      )}
      {showSummary && (
        <>
          <div className="ticket-divider" />
          <div className="ticket-summary">
            {summary.map((line, index) => {
              const isDivider = line.label.trim().length === 0 && line.value.trim().length === 0;

              if (isDivider) {
                return <div className="ticket-divider ticket-divider--summary" key={`divider-${index}`} />;
              }

              return (
                <div className="ticket-summary-row" key={`${line.label}-${line.value}-${index}`}>
                  <span>{line.label}</span>
                  <strong>{line.value}</strong>
                </div>
              );
            })}
          </div>
        </>
      )}
      {showItems && itemsStyle !== 'summary' && (
        <>
          <div className="ticket-divider" />
          <div className="ticket-total">
            <span>Total</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
          {sortedItems.map((item, index) => (
            <>
              <div className="ticket-divider" key={`divider-${index}`} />
              <div key={`${item.name}-${index}`} className="ticket-item-row">
                <span className="ticket-item-line">
                  <span className="ticket-item-qty">{item.qty}x</span>
                  <span className={`ticket-item-name ${item.name.length > 14 ? 'ticket-item-name--long' : ''}`}>{item.name.toUpperCase()}</span>
                </span>
                {item.orderNumber !== undefined && (
                  <span className="ticket-item-order">{item.orderNumber.toString().padStart(3, '0')}</span>
                )}
              </div>
            </>
          ))}
          <div className="ticket-divider" />
        </>
      )}
      {ticket.thanks && <p className="ticket-thanks">{ticket.thanks}</p>}
      {ticket.footer && <p className="ticket-footer">{ticket.footer}</p>}
      <button type="button" className="primary-button no-print" onClick={() => window.print()}>
        Imprimir
      </button>
    </div>
  );
};
