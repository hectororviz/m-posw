import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useSettings, useStock } from '../api/queries';
import type { StockCategory, StockProduct } from '../api/types';
import type { TicketPayload } from '../utils/ticketPrinting';

type StockFilter = 'todos' | 'bajo' | 'sin-stock';

const encodeBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary);
};

const getStockBadge = (stock: number): { label: string; className: string } | null => {
  if (stock === 0) return { label: 'Sin stock', className: 'badge badge-warning' };
  if (stock <= 10) return { label: 'Bajo', className: 'badge badge-warning' };
  return null;
};

export const AdminStockPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: stockCategories, isLoading } = useStock();
  const { data: settings } = useSettings();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('todos');
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const timersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, []);

  const updateStockApi = useCallback(async (productId: string, stock: number) => {
    setSavingIds((prev) => new Set(prev).add(productId));
    try {
      await apiClient.patch(`/stock/${productId}`, { stock });
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
      setSavedIds((prev) => new Set(prev).add(productId));
      setTimeout(() => {
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }, 1800);
      await queryClient.invalidateQueries({ queryKey: ['stock'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
      setError(normalizeApiError(err));
    }
  }, [queryClient]);

  const handleAdjust = useCallback((product: StockProduct, delta: number) => {
    const newStock = Math.max(0, product.stock + delta);
    setError(null);
    if (timersRef.current[product.id]) {
      clearTimeout(timersRef.current[product.id]);
    }
    timersRef.current[product.id] = window.setTimeout(() => {
      delete timersRef.current[product.id];
      updateStockApi(product.id, newStock);
    }, 400);
  }, [updateStockApi]);

  const filteredCategories = useMemo(() => {
    if (!stockCategories) return [];
    return stockCategories
      .map((cat) => {
        let products = cat.products;
        if (search) {
          const q = search.toLowerCase();
          products = products.filter((p) => p.name.toLowerCase().includes(q));
        }
        if (filter === 'bajo') {
          products = products.filter((p) => p.stock > 0 && p.stock <= 10);
        } else if (filter === 'sin-stock') {
          products = products.filter((p) => p.stock === 0);
        }
        return { ...cat, products };
      })
      .filter((cat) => cat.products.length > 0);
  }, [stockCategories, search, filter]);

  const handlePrintStockTicket = () => {
    if (!stockCategories || stockCategories.length === 0) return;
    const now = new Date();
    const payload: TicketPayload = {
      clubName: settings?.clubName ?? '',
      storeName: settings?.storeName ?? 'SOLER - Bufet',
      dateTimeISO: now.toISOString(),
      items: stockCategories.flatMap((category) =>
        category.products.map((product) => ({
          qty: product.stock,
          name: product.name,
          category: category.name,
        }))
      ),
      itemsStyle: 'summary',
      title: 'STOCK',
      thanks: '',
      footer: 'Ticket de Stock',
    };
    const ticketParam = encodeURIComponent(encodeBase64(JSON.stringify(payload)));
    window.location.href = `/printticket?data=${ticketParam}`;
  };

  const totalProducts = stockCategories?.reduce((acc, c) => acc + c.products.length, 0) ?? 0;

  if (isLoading) {
    return (
      <div>
        <div className="page-header">
          <h2 className="page-header-title">Control de stock</h2>
          <p className="page-header-subtitle">Cargando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 className="page-header-title" style={{ marginBottom: '0.15rem' }}>Control de stock</h2>
            <p className="page-header-subtitle">Monitorea productos con bajo stock y actualiza cantidades rapidamente.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={handlePrintStockTicket} disabled={totalProducts === 0}>
            Imprimir reporte
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="stock-toolbar">
        <input
          type="text"
          className="stock-search-input"
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="stock-filter-group">
          {([
            ['todos', 'Todos'],
            ['bajo', 'Bajo stock'],
            ['sin-stock', 'Sin stock'],
          ] as [StockFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`stock-filter-chip ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filteredCategories.length === 0 ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>
            {search ? 'No se encontraron productos.' : 'No hay productos que mostrar.'}
          </p>
        </div>
      ) : (
        <div className="stock-list">
          {filteredCategories.map((category) => (
            <div key={category.id} className="stock-category-group">
              <div className="stock-category-head">
                <h3 className="stock-category-name">{category.name}</h3>
                <span className="stock-category-count">{category.products.length} productos</span>
              </div>
              <div className="stock-product-rows">
                {category.products.map((product) => {
                  const badge = getStockBadge(product.stock);
                  const isSaving = savingIds.has(product.id);
                  const isSaved = savedIds.has(product.id);
                  return (
                    <div key={product.id} className={`stock-product-item ${product.stock === 0 ? 'is-zero' : ''} ${product.stock <= 10 && product.stock > 0 ? 'is-low' : ''}`}>
                      <div className="stock-product-main">
                        <span className="stock-product-name">{product.name}</span>
                        {badge && <span className={badge.className}>{badge.label}</span>}
                        <span className="stock-product-price">
                          ${product.price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="stock-qty-group">
                        <button
                          type="button"
                          className="stock-qty-btn"
                          onClick={() => handleAdjust(product, -1)}
                          disabled={product.stock === 0 || isSaving}
                          aria-label={`Reducir stock de ${product.name}`}
                        >
                          −
                        </button>
                        <span className="stock-qty-value">
                          {isSaving ? (
                            <span className="stock-qty-spinner" />
                          ) : isSaved ? (
                            <span className="stock-qty-check">✓</span>
                          ) : (
                            product.stock
                          )}
                        </span>
                        <button
                          type="button"
                          className="stock-qty-btn"
                          onClick={() => handleAdjust(product, 1)}
                          disabled={isSaving}
                          aria-label={`Aumentar stock de ${product.name}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
