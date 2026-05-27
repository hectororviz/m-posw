import { useMemo, useState } from 'react';
import { apiClient, normalizeApiError } from '../api/client';
import { useAdminSales, useCashCloses, useManualMovements, useSettings } from '../api/queries';
import { useQueryClient } from '@tanstack/react-query';
import type { TicketPayload } from '../utils/ticketPrinting';
import { useToast } from '../components/ToastProvider';
import { useEmbeddedKeyboard } from '../hooks/useEmbeddedKeyboard';

const DEFAULT_IN_REASONS = ['Apertura de Caja', 'Otro'];
const DEFAULT_OUT_REASONS = ['Retiro de caja', 'Otro'];

const formatCurrency = (value: number | string) => {
  const n = Number(value);
  return `$ ${(Number.isFinite(n) ? n : 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const toAmount = (value: unknown): number => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
    const p = Number(normalized);
    return Number.isFinite(p) ? p : 0;
  }
  const a = Number(value);
  return Number.isFinite(a) ? a : 0;
};

const formatDate = (value: string) => new Date(value).toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' });
const formatTime = (value: string) => new Date(value).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
const getPaymentMethodLabel = (method?: string) => {
  if (method === 'MP_QR') return 'QR';
  if (method === 'TRANSFER') return 'Transf.';
  return 'Efectivo';
};

const encodeBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary);
};

type SalesTableEntry =
  | { kind: 'SALE'; id: string; createdAt: string; total: number; userName: string; paymentLabel: string; saleId: string; }
  | { kind: 'MOVEMENT'; id: string; createdAt: string; total: number; userName: string; paymentLabel: string; reason: string; }
  | { kind: 'CASH_CLOSE'; id: string; createdAt: string; total: number; userName: string; paymentLabel: string; cashCloseId: string; note?: string | null; };

const kindBadge = (kind: SalesTableEntry['kind']) => {
  if (kind === 'SALE') return <span className="badge badge-success">Venta</span>;
  if (kind === 'MOVEMENT') return <span className="badge badge-neutral">Movimiento</span>;
  return <span className="badge badge-info">Cierre</span>;
};

export const AdminSalesPage: React.FC = () => {
  const { data: sales = [] } = useAdminSales();
  const { data: settings } = useSettings();
  const { data: movements = [] } = useManualMovements();
  const { data: cashCloses = [] } = useCashCloses();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [movementDescription, setMovementDescription] = useState('');
  const [, setActiveMovementField] = useState<'amount' | 'reason' | 'description'>('amount');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [selectedCashCloseId, setSelectedCashCloseId] = useState<string | null>(null);
  const [printStart, setPrintStart] = useState('');
  const [printEnd, setPrintEnd] = useState('');
  const [isSavingMovement, setIsSavingMovement] = useState(false);
  const [isClosingPeriod, setIsClosingPeriod] = useState(false);
  const [closePreview, setClosePreview] = useState<{
    from: string; to: string;
    summary: { salesTotal: number | string; salesCashTotal: number | string; salesQrTotal: number | string; salesTransferTotal?: number | string; movementsInTotal: number | string; movementsOutTotal: number | string; netCashDelta: number | string; };
  } | null>(null);
  const { showEmbeddedKeyboard } = useEmbeddedKeyboard();

  const selectedSale = useMemo(() => sales.find((s) => s.id === selectedSaleId) ?? null, [sales, selectedSaleId]);
  const selectedCashClose = useMemo(() => cashCloses.find((c) => c.id === selectedCashCloseId) ?? null, [cashCloses, selectedCashCloseId]);

  const filteredEntries = useMemo(() => {
    const all: SalesTableEntry[] = [
      ...sales.map((s) => ({ kind: 'SALE' as const, id: `sale-${s.id}`, createdAt: s.createdAt, total: s.total, userName: s.user?.name ?? 'Sin usuario', paymentLabel: getPaymentMethodLabel(s.paymentMethod), saleId: s.id })),
      ...movements.map((m) => ({ kind: 'MOVEMENT' as const, id: `movement-${m.id}`, createdAt: m.createdAt, total: m.type === 'SALIDA' ? m.amount * -1 : m.amount, userName: 'Mov. manual', paymentLabel: m.type, reason: m.reason })),
      ...cashCloses.map((c) => ({ kind: 'CASH_CLOSE' as const, id: `close-${c.id}`, createdAt: c.closedAt, total: c.salesTotal, userName: c.closedBy?.name ?? 'Sistema', paymentLabel: 'CIERRE', cashCloseId: c.id, note: c.note })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return all.filter((entry) => {
      const d = new Date(entry.createdAt);
      if (startDate && d < new Date(`${startDate}T00:00:00`)) return false;
      if (endDate && d > new Date(`${endDate}T23:59:59`)) return false;
      if (search) {
        const q = search.toLowerCase();
        const match = (entry.kind === 'SALE' ? 'venta ' : entry.kind === 'CASH_CLOSE' ? 'cierre ' : entry.kind === 'MOVEMENT' ? 'movimiento ' + entry.reason : '') + entry.userName + entry.paymentLabel + String(entry.total);
        if (!match.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [sales, movements, cashCloses, startDate, endDate, search]);

  const filteredMovements = useMemo(() => {
    if (!printStart && !printEnd) return movements;
    const start = printStart ? new Date(printStart) : null;
    const end = printEnd ? new Date(printEnd) : null;
    return movements.filter((m) => {
      const d = new Date(m.createdAt);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [movements, printStart, printEnd]);

  const kpis = useMemo(() => {
    const saleEntries = filteredEntries.filter((e) => e.kind === 'SALE');
    const totalSales = saleEntries.reduce((acc, s) => acc + toAmount(s.total), 0);
    const count = saleEntries.length;
    return { totalSales, count, avgTicket: count ? totalSales / count : 0 };
  }, [filteredEntries]);

  const handleClosePeriod = async () => {
    if (isClosingPeriod) return;
    setIsClosingPeriod(true);
    try {
      const resp = await apiClient.get('/cash-close/current-period');
      setClosePreview(resp.data as typeof closePreview);
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setIsClosingPeriod(false);
    }
  };

  const handleConfirmClosePeriod = async () => {
    if (!closePreview || isClosingPeriod) return;
    setIsClosingPeriod(true);
    try {
      await apiClient.post('/cash-close/close', {});
      const periodStart = new Date(closePreview.from);
      const periodEnd = new Date(closePreview.to);
      const salesForPrint = sales.filter((s) => { const d = new Date(s.createdAt); return d >= periodStart && d <= periodEnd; });
      const itemsForPrint = salesForPrint.flatMap((s) => s.items).reduce((acc, item) => {
        const key = `${item.product.name}|${item.product.category?.name ?? 'Sin categoria'}`;
        acc.set(key, (acc.get(key) ?? 0) + item.quantity);
        return acc;
      }, new Map<string, number>());
      const items = Array.from(itemsForPrint.entries()).map(([key, qty]) => { const [name, category] = key.split('|'); return { name, qty, category }; }).sort((a, b) => a.qty !== b.qty ? a.qty - b.qty : a.name.localeCompare(b.name));
      const payload: TicketPayload = { clubName: settings?.clubName ?? '', storeName: settings?.storeName ?? 'SOLER - Bufet', dateTimeISO: periodEnd.toISOString(), itemsStyle: 'summary', title: 'Ventas', items, total: toAmount(closePreview.summary.salesTotal), criteria: [{ label: 'Desde:', value: `${formatDate(closePreview.from)} ${formatTime(closePreview.from)}` }, { label: 'Hasta:', value: `${formatDate(closePreview.to)} ${formatTime(closePreview.to)}` }], summary: [{ label: 'Ventas:', value: formatCurrency(closePreview.summary.salesTotal) }, { label: 'Efectivo:', value: formatCurrency(closePreview.summary.salesCashTotal) }, { label: 'QR:', value: formatCurrency(closePreview.summary.salesQrTotal) }, { label: 'Transferencia:', value: formatCurrency(closePreview.summary.salesTransferTotal ?? 0) }, { label: 'Entradas:', value: formatCurrency(closePreview.summary.movementsInTotal) }, { label: 'Salidas:', value: formatCurrency(closePreview.summary.movementsOutTotal) }, { label: 'Neto caja:', value: formatCurrency(closePreview.summary.netCashDelta) }] };
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['admin-sales'] }), queryClient.invalidateQueries({ queryKey: ['manual-movements'] })]);
      pushToast('Cierre guardado correctamente.', 'success');
      setClosePreview(null);
      window.location.href = `/printticket?data=${encodeURIComponent(encodeBase64(JSON.stringify(payload)))}`;
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setIsClosingPeriod(false);
    }
  };

  const handleDownload = () => {
    if (filteredEntries.length === 0) return;
    const headers = ['Fecha', 'Hora', 'Tipo', 'Usuario', 'Total', 'Forma de pago', 'Detalle'];
    const data = filteredEntries.map((entry) => {
      const row = [formatDate(entry.createdAt), formatTime(entry.createdAt), entry.kind === 'SALE' ? 'Venta' : entry.kind === 'CASH_CLOSE' ? 'Cierre' : 'Movimiento', entry.userName, formatCurrency(entry.total), entry.paymentLabel, entry.kind === 'MOVEMENT' ? entry.reason : entry.kind === 'CASH_CLOSE' ? (entry.note ?? 'Cierre de caja') : (sales.find((s) => s.id === (entry as any).saleId)?.items.map((i) => `${i.quantity}x ${i.product.name}`).join(' | ') ?? '')];
      return row;
    });
    const csv = '\uFEFF' + [headers, ...data].map((l) => l.map((v) => `"${v.replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ventas-${startDate || 'inicio'}-${endDate || 'fin'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getAvailableReasons = (type: 'ENTRADA' | 'SALIDA') => {
    const defaults = type === 'ENTRADA' ? DEFAULT_IN_REASONS : DEFAULT_OUT_REASONS;
    const custom = type === 'ENTRADA' ? (settings?.movementInReasons ?? []) : (settings?.movementOutReasons ?? []);
    return [...new Set([...defaults, ...custom])];
  };

  const handleOpenMovement = () => {
    setMovementType('ENTRADA');
    setMovementAmount('');
    setMovementReason(getAvailableReasons('ENTRADA')[0] || '');
    setMovementDescription('');
    setActiveMovementField('amount');
    setIsMovementOpen(true);
  };

  const handleSaveMovement = async () => {
    const amount = Number(movementAmount);
    const reason = movementReason.trim();
    const description = movementDescription.trim();
    if (!Number.isFinite(amount) || amount <= 0 || reason.length === 0) return;
    if (reason === 'Otro' && description.length === 0) { pushToast('La descripcion es obligatoria', 'error'); return; }
    setIsSavingMovement(true);
    try {
      await apiClient.post('/sales/manual-movements', { type: movementType, amount, reason, description: description || undefined });
      await queryClient.invalidateQueries({ queryKey: ['manual-movements'] });
      pushToast('Movimiento agregado.', 'success');
      setIsMovementOpen(false);
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setIsSavingMovement(false);
    }
  };

  const isMovementValid = () => {
    const amount = Number(movementAmount);
    const reason = movementReason.trim();
    if (!Number.isFinite(amount) || amount <= 0 || reason.length === 0) return false;
    if (reason === 'Otro' && movementDescription.trim().length === 0) return false;
    return true;
  };

  const handleAmountKeyPress = (key: string) => {
    setActiveMovementField('amount');
    if (key === '⌫') { setMovementAmount((c) => c.slice(0, -1)); return; }
    if (key === '.' && movementAmount.includes('.')) return;
    setMovementAmount((c) => `${c}${key}`);
  };

  const handleReasonKeyPress = (key: string) => {
    setActiveMovementField('description');
    if (key === '⌫') { setMovementDescription((c) => c.slice(0, -1)); return; }
    if (key === 'ESPACIO') { setMovementDescription((c) => `${c} `); return; }
    setMovementDescription((c) => `${c}${key.toLowerCase()}`);
  };

  const handlePrint = () => {
    const start = printStart ? new Date(printStart) : null;
    const end = printEnd ? new Date(printEnd) : null;
    const s4p = sales.filter((s) => { const d = new Date(s.createdAt); if (start && d < start) return false; if (end && d > end) return false; return true; });
    if (s4p.length === 0 && filteredMovements.length === 0) { pushToast('Sin datos para imprimir.', 'error'); return; }
    const itemsForPrint = s4p.flatMap((s) => s.items).reduce((acc, item) => { acc.set(item.product.name, (acc.get(item.product.name) ?? 0) + item.quantity); return acc; }, new Map<string, number>());
    const items = Array.from(itemsForPrint.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty !== a.qty ? b.qty - a.qty : a.name.localeCompare(b.name));
    const totalCash = s4p.filter((s) => s.paymentMethod === 'CASH').reduce((acc, s) => acc + toAmount(s.total), 0);
    const totalQr = s4p.filter((s) => s.paymentMethod === 'MP_QR').reduce((acc, s) => acc + toAmount(s.total), 0);
    const totalTransfer = s4p.filter((s) => s.paymentMethod === 'TRANSFER').reduce((acc, s) => acc + toAmount(s.total), 0);
    const total = totalCash + totalQr + totalTransfer;
    const totalIn = filteredMovements.filter((m) => m.type === 'ENTRADA').reduce((acc, m) => acc + toAmount(m.amount), 0);
    const totalOut = filteredMovements.filter((m) => m.type === 'SALIDA').reduce((acc, m) => acc + toAmount(m.amount), 0);
    const totalProducts = s4p.reduce((acc, s) => acc + s.items.reduce((a, i) => a + i.quantity, 0), 0);
    const payload: TicketPayload = { clubName: settings?.clubName ?? '', storeName: settings?.storeName ?? '', dateTimeISO: new Date().toISOString(), itemsStyle: 'summary', items, total, summary: [{ label: 'Ventas:', value: formatCurrency(total) }, { label: 'Entradas:', value: formatCurrency(totalIn) }, { label: 'Salidas:', value: formatCurrency(totalOut) }, { label: '', value: '' }, { label: 'Efectivo:', value: formatCurrency(totalCash) }, { label: 'QR:', value: formatCurrency(totalQr) }, { label: 'Transferencia:', value: formatCurrency(totalTransfer) }, { label: 'Productos:', value: totalProducts.toString() }] };
    setIsPrintOpen(false);
    window.location.href = `/printticket?data=${encodeURIComponent(encodeBase64(JSON.stringify(payload)))}`;
  };

  const handleReprintTicket = async (saleId: string) => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return;
    try { await apiClient.post(`/sales/${saleId}/ticket-printed`); } catch (err) { pushToast(normalizeApiError(err), 'error'); }
    const payload: TicketPayload = { clubName: settings?.clubName ?? '', storeName: settings?.storeName ?? '', dateTimeISO: sale.createdAt, itemsStyle: 'sale', items: sale.items.map((item) => ({ qty: item.quantity, name: item.product.name, category: item.product.category?.name, orderNumber: item.orderNumber })), total: sale.total, thanks: 'Gracias por tu compra', footer: 'Ticket no fiscal' };
    pushToast('Enviando ticket a impresion.', 'success');
    window.location.href = `/printticket?data=${encodeURIComponent(encodeBase64(JSON.stringify(payload)))}`;
  };

  const handleReprintCashCloseTicket = (cc: typeof selectedCashClose) => {
    if (!cc) return;
    const payload: TicketPayload = { clubName: settings?.clubName ?? '', storeName: settings?.storeName ?? '', dateTimeISO: cc.closedAt, itemsStyle: 'summary', items: [], criteria: [{ label: 'Desde:', value: `${formatDate(cc.from)} ${formatTime(cc.from)}` }, { label: 'Hasta:', value: `${formatDate(cc.to)} ${formatTime(cc.to)}` }], summary: [{ label: 'Ventas:', value: formatCurrency(cc.salesTotal) }, { label: 'Efectivo:', value: formatCurrency(cc.salesCashTotal) }, { label: 'QR:', value: formatCurrency(cc.salesQrTotal) }, { label: 'Transferencia:', value: formatCurrency(cc.salesTransferTotal ?? 0) }, { label: '', value: '' }, { label: 'Entradas:', value: formatCurrency(cc.movementsInTotal) }, { label: 'Salidas:', value: formatCurrency(cc.movementsOutTotal) }, { label: 'Neto caja:', value: formatCurrency(cc.netCashDelta) }], title: 'CIERRE DE CAJA', footer: cc.note || 'Cierre de caja' };
    pushToast('Enviando ticket de cierre a impresion.', 'success');
    window.location.href = `/printticket?data=${encodeURIComponent(encodeBase64(JSON.stringify(payload)))}`;
  };

  const handleOpenPrint = () => { setPrintStart(startDate ? `${startDate}T00:00` : ''); setPrintEnd(endDate ? `${endDate}T23:59` : ''); setIsPrintOpen(true); };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 className="page-header-title" style={{ marginBottom: '0.15rem' }}>Ventas</h2>
            <p className="page-header-subtitle">Historial de ventas, movimientos y cierres de caja.</p>
          </div>
        </div>
      </div>

      <div className="sales-kpis">
        <div className="sales-kpi-card">
          <span className="sales-kpi-label">Total ventas</span>
          <span className="sales-kpi-value">{formatCurrency(kpis.totalSales)}</span>
        </div>
        <div className="sales-kpi-card">
          <span className="sales-kpi-label">Operaciones</span>
          <span className="sales-kpi-value">{kpis.count}</span>
        </div>
        <div className="sales-kpi-card">
          <span className="sales-kpi-label">Ticket promedio</span>
          <span className="sales-kpi-value">{formatCurrency(kpis.avgTicket)}</span>
        </div>
      </div>

      <div className="stock-toolbar">
        <input type="text" className="stock-search-input" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="input-field input-field--compact" style={{ margin: 0 }}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '0.5rem 0.65rem', fontSize: '0.85rem' }} />
        </label>
        <label className="input-field input-field--compact" style={{ margin: 0 }}>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '0.5rem 0.65rem', fontSize: '0.85rem' }} />
        </label>
        <button type="button" className="btn-secondary" onClick={handleOpenMovement}>+ Movimiento</button>
        <button type="button" className="btn-ghost" onClick={handleDownload} disabled={filteredEntries.length === 0}>CSV</button>
        <button type="button" className="btn-ghost" onClick={handleOpenPrint}>Imprimir</button>
        <button type="button" className="btn-secondary" onClick={handleClosePeriod} disabled={isClosingPeriod}>{isClosingPeriod ? '...' : 'Cierre'}</button>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>No hay registros para los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="sales-table-wrapper">
          <div className="sales-table">
            <div className="sales-table-head">
              <span className="col-date">Fecha</span>
              <span className="col-type">Tipo</span>
              <span className="col-user">Usuario</span>
              <span className="col-total">Total</span>
              <span className="col-method">Pago</span>
              <span className="col-action"></span>
            </div>
            {filteredEntries.map((entry) => (
              <div key={entry.id} className={`sales-table-row ${entry.kind === 'SALE' ? 'row-sale' : entry.kind === 'CASH_CLOSE' ? 'row-close' : 'row-movement'}`}>
                <span className="col-date">{formatDate(entry.createdAt)} {formatTime(entry.createdAt)}</span>
                <span className="col-type">{kindBadge(entry.kind)}</span>
                <span className="col-user">{entry.userName}</span>
                <span className={`col-total ${entry.total >= 0 ? '' : 'negative'}`}>{formatCurrency(entry.total)}</span>
                <span className="col-method">{entry.paymentLabel}</span>
                <span className="col-action">
                  {entry.kind === 'SALE' && <button type="button" className="btn-ghost btn-sm" onClick={() => setSelectedSaleId(entry.saleId)}>Ver</button>}
                  {entry.kind === 'CASH_CLOSE' && <button type="button" className="btn-ghost btn-sm" onClick={() => setSelectedCashCloseId(entry.cashCloseId)}>Ver</button>}
                  {entry.kind === 'MOVEMENT' && <span className="sales-table-reason">{entry.reason}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedSale && (
        <div className="modal-backdrop" onClick={() => setSelectedSaleId(null)}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Detalle de venta</h3><button className="icon-button" onClick={() => setSelectedSaleId(null)}>✕</button></div>
            <div className="modal-body">
              <div className="sales-detail-row"><span>Fecha</span><span>{formatDate(selectedSale.createdAt)} {formatTime(selectedSale.createdAt)}</span></div>
              <div className="sales-detail-row"><span>Total</span><strong>{formatCurrency(selectedSale.total)}</strong></div>
              <div className="sales-detail-row"><span>Medio de pago</span><span>{getPaymentMethodLabel(selectedSale.paymentMethod)}</span></div>
              <div className="sales-detail-products">
                {selectedSale.items.map((item) => (
                  <div key={item.id} className="sales-detail-product">{item.quantity} x {item.product.name} <span>{formatCurrency(item.subtotal)}</span></div>
                ))}
              </div>
              <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={() => setSelectedSaleId(null)}>Cerrar</button>
                <button type="button" className="btn-secondary" onClick={() => handleReprintTicket(selectedSale.id)}>Reimprimir ticket</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedCashClose && (
        <div className="modal-backdrop" onClick={() => setSelectedCashCloseId(null)}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Cierre de Caja</h3><button className="icon-button" onClick={() => setSelectedCashCloseId(null)}>✕</button></div>
            <div className="modal-body">
              <div className="sales-detail-row"><span>Fecha</span><span>{formatDate(selectedCashClose.closedAt)} {formatTime(selectedCashClose.closedAt)}</span></div>
              <div className="sales-detail-row"><span>Periodo</span><span>{formatDate(selectedCashClose.from)} - {formatDate(selectedCashClose.to)}</span></div>
              <div className="sales-detail-row"><span>Cerrado por</span><span>{selectedCashClose.closedBy?.name ?? 'Sistema'}</span></div>
              <div className="ticket-divider" />
              <div className="sales-detail-row"><span>Ventas</span><strong>{formatCurrency(selectedCashClose.salesTotal)}</strong></div>
              <div className="sales-detail-row"><span>Efectivo</span><span>{formatCurrency(selectedCashClose.salesCashTotal)}</span></div>
              <div className="sales-detail-row"><span>QR</span><span>{formatCurrency(selectedCashClose.salesQrTotal)}</span></div>
              <div className="sales-detail-row"><span>Transferencia</span><span>{formatCurrency(selectedCashClose.salesTransferTotal ?? 0)}</span></div>
              <div className="ticket-divider" />
              <div className="sales-detail-row"><span>Entradas</span><span>{formatCurrency(selectedCashClose.movementsInTotal)}</span></div>
              <div className="sales-detail-row"><span>Salidas</span><span>{formatCurrency(selectedCashClose.movementsOutTotal)}</span></div>
              <div className="sales-detail-row"><span>Neto caja</span><strong>{formatCurrency(selectedCashClose.netCashDelta)}</strong></div>
              <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={() => setSelectedCashCloseId(null)}>Cerrar</button>
                <button type="button" className="btn-secondary" onClick={() => handleReprintCashCloseTicket(selectedCashClose)}>Reimprimir ticket</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isPrintOpen && (
        <div className="modal-backdrop" onClick={() => setIsPrintOpen(false)}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Imprimir detalle</h3><button className="icon-button" onClick={() => setIsPrintOpen(false)}>✕</button></div>
            <div className="modal-body">
              <div className="settings-field"><label>Desde</label><input type="datetime-local" value={printStart} onChange={(e) => setPrintStart(e.target.value)} /></div>
              <div className="settings-field"><label>Hasta</label><input type="datetime-local" value={printEnd} onChange={(e) => setPrintEnd(e.target.value)} /></div>
              <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={() => setIsPrintOpen(false)}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={handlePrint}>Imprimir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isMovementOpen && (
        <div className="modal-backdrop" onClick={() => setIsMovementOpen(false)}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Nuevo movimiento</h3><button className="icon-button" onClick={() => setIsMovementOpen(false)}>✕</button></div>
            <div className="modal-body">
              <div className="settings-field">
                <label>Tipo</label>
                <fieldset className="admin-sales__movement-type" aria-label="Tipo de movimiento" style={{ border: 'none', padding: 0, margin: 0, display: 'flex', gap: '1rem' }}>
                  <label className="toggle-switch"><input type="radio" name="mov-type" value="ENTRADA" checked={movementType === 'ENTRADA'} onChange={() => { setMovementType('ENTRADA'); setMovementReason(getAvailableReasons('ENTRADA')[0] || ''); }} /><span className="toggle-switch-track" />Entrada</label>
                  <label className="toggle-switch"><input type="radio" name="mov-type" value="SALIDA" checked={movementType === 'SALIDA'} onChange={() => { setMovementType('SALIDA'); setMovementReason(getAvailableReasons('SALIDA')[0] || ''); }} /><span className="toggle-switch-track" />Salida</label>
                </fieldset>
              </div>
              <div className="settings-field">
                <label>Motivo</label>
                <select value={movementReason} onChange={(e) => { setMovementReason(e.target.value); setMovementDescription(''); }}>
                  {getAvailableReasons(movementType).map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="settings-field">
                <label>Monto</label>
                <input type="text" inputMode="decimal" placeholder="0" value={movementAmount} onFocus={() => setActiveMovementField('amount')} onChange={(e) => setMovementAmount(e.target.value)} />
                {showEmbeddedKeyboard && (
                  <div className="admin-sales__keyboard">
                    {[['1','2','3'],['4','5','6'],['7','8','9'],['.','0','⌫']].map((row, ri) => (
                      <div key={ri} className="admin-sales__keyboard-row">{row.map((k) => <button key={k} className="admin-sales__key" onClick={() => handleAmountKeyPress(k)}>{k}</button>)}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="settings-field">
                <label>{movementReason === 'Otro' ? 'Descripcion (obligatoria)' : 'Descripcion (opcional)'}</label>
                <textarea rows={movementReason === 'Otro' ? 3 : 2} placeholder="Descripcion adicional" value={movementDescription} onFocus={() => setActiveMovementField('description')} onChange={(e) => setMovementDescription(e.target.value)} />
              </div>
              {showEmbeddedKeyboard && (
                <div className="admin-sales__mini-keyboard">
                  {['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'].map((row) => (
                    <div key={row} className="admin-sales__keyboard-row">{row.split('').map((l) => <button key={l} className="admin-sales__key admin-sales__key--small" onClick={() => handleReasonKeyPress(l)}>{l}</button>)}</div>
                  ))}
                  <div className="admin-sales__keyboard-row">
                    <button className="admin-sales__key admin-sales__key--wide" onClick={() => handleReasonKeyPress('ESPACIO')}>Espacio</button>
                    <button className="admin-sales__key admin-sales__key--small" onClick={() => handleReasonKeyPress('⌫')}>⌫</button>
                  </div>
                </div>
              )}
              <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={() => setIsMovementOpen(false)}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={handleSaveMovement} disabled={!isMovementValid() || isSavingMovement}>{isSavingMovement ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {closePreview && (
        <div className="modal-backdrop" onClick={() => setClosePreview(null)}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Cierre parcial</h3><button className="icon-button" onClick={() => setClosePreview(null)}>✕</button></div>
            <div className="modal-body">
              <div className="sales-detail-row"><span>Periodo</span><span>{formatDate(closePreview.from)} {formatTime(closePreview.from)} - {formatDate(closePreview.to)} {formatTime(closePreview.to)}</span></div>
              <div className="sales-detail-row"><span>Ventas</span><strong>{formatCurrency(closePreview.summary.salesTotal)}</strong></div>
              <div className="sales-detail-row"><span>Efectivo</span><span>{formatCurrency(closePreview.summary.salesCashTotal)}</span></div>
              <div className="sales-detail-row"><span>QR</span><span>{formatCurrency(closePreview.summary.salesQrTotal)}</span></div>
              <div className="sales-detail-row"><span>Transferencia</span><span>{formatCurrency(closePreview.summary.salesTransferTotal ?? 0)}</span></div>
              <div className="sales-detail-row"><span>Entradas</span><span>{formatCurrency(closePreview.summary.movementsInTotal)}</span></div>
              <div className="sales-detail-row"><span>Salidas</span><span>{formatCurrency(closePreview.summary.movementsOutTotal)}</span></div>
              <div className="sales-detail-row"><span>Neto caja</span><strong>{formatCurrency(closePreview.summary.netCashDelta)}</strong></div>
              <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={() => setClosePreview(null)}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={handleConfirmClosePeriod} disabled={isClosingPeriod}>{isClosingPeriod ? 'Guardando...' : 'Confirmar cierre'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
