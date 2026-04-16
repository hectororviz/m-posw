import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useSettings, useStock } from '../api/queries';
import type { StockCategory, StockProduct } from '../api/types';
import type { TicketPayload } from '../utils/ticketPrinting';

const encodeBase64Url = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const base64 = window.btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

export const AdminStockPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: stockCategories, isLoading } = useStock();
  const { data: settings } = useSettings();
  const [error, setError] = useState<string | null>(null);
  const [editingStock, setEditingStock] = useState<Record<string, string>>({});

  const handleStockChange = (productId: string, value: string) => {
    setEditingStock((prev) => ({ ...prev, [productId]: value }));
  };

  const handleUpdateStock = async (productId: string) => {
    const value = editingStock[productId];
    if (value === undefined) return;

    const stock = parseInt(value, 10);
    if (Number.isNaN(stock)) {
      setError('El stock debe ser un número válido');
      return;
    }

    setError(null);
    try {
      await apiClient.patch(`/stock/${productId}`, { stock });
      setEditingStock((prev) => {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      });
      await queryClient.invalidateQueries({ queryKey: ['stock'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handlePrintStockTicket = () => {
    if (!stockCategories || stockCategories.length === 0) return;

    const now = new Date();
    const dateTimeISO = now.toISOString();

    const payload: TicketPayload = {
      clubName: settings?.clubName ?? '',
      storeName: settings?.storeName ?? 'SOLER - Bufet',
      dateTimeISO,
      items: stockCategories.flatMap((category) => [
        { qty: 0, name: `--- ${category.name} ---`, category: category.name },
        ...category.products.map((product) => ({
          qty: product.stock,
          name: product.name,
          category: category.name,
        })),
      ]),
      itemsStyle: 'summary',
      thanks: '',
      footer: 'Ticket de Stock',
    };

    const ticketParam = encodeBase64Url(JSON.stringify(payload));
    const url = `/printticket?data=${ticketParam}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getStockAlertClass = (stock: number): string => {
    if (stock === 0) return 'stock-zero';
    if (stock <= 10) return 'stock-low';
    return 'stock-ok';
  };

  if (isLoading) {
    return (
      <section className="card admin-stock">
        <h2>Control de Stock</h2>
        <p>Cargando...</p>
      </section>
    );
  }

  return (
    <section className="card admin-stock">
      <div className="stock-header">
        <h2>Control de Stock</h2>
        <button
          type="button"
          className="primary-button"
          onClick={handlePrintStockTicket}
          disabled={!stockCategories || stockCategories.length === 0}
        >
          🖨️ Imprimir ticket de stock
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="stock-legend">
        <span className="legend-item stock-low">🔴 Stock bajo (1-10)</span>
        <span className="legend-item stock-zero">⚫ Sin stock</span>
      </div>

      <div className="stock-categories">
        {stockCategories?.map((category) => (
          <StockCategorySection
            key={category.id}
            category={category}
            editingStock={editingStock}
            onStockChange={handleStockChange}
            onUpdateStock={handleUpdateStock}
            getStockAlertClass={getStockAlertClass}
          />
        ))}
      </div>
    </section>
  );
};

interface StockCategorySectionProps {
  category: StockCategory;
  editingStock: Record<string, string>;
  onStockChange: (productId: string, value: string) => void;
  onUpdateStock: (productId: string) => void;
  getStockAlertClass: (stock: number) => string;
}

const StockCategorySection: React.FC<StockCategorySectionProps> = ({
  category,
  editingStock,
  onStockChange,
  onUpdateStock,
  getStockAlertClass,
}) => {
  return (
    <div
      className="stock-category-section"
      style={{ borderLeftColor: category.colorHex }}
    >
      <h3
        className="stock-category-title"
        style={{ backgroundColor: `${category.colorHex}20`, color: category.colorHex }}
      >
        {category.name}
      </h3>

      <div className="stock-products">
        {category.products.map((product) => (
          <StockProductRow
            key={product.id}
            product={product}
            editingValue={editingStock[product.id]}
            onStockChange={onStockChange}
            onUpdateStock={onUpdateStock}
            getStockAlertClass={getStockAlertClass}
          />
        ))}
      </div>
    </div>
  );
};

interface StockProductRowProps {
  product: StockProduct;
  editingValue: string | undefined;
  onStockChange: (productId: string, value: string) => void;
  onUpdateStock: (productId: string) => void;
  getStockAlertClass: (stock: number) => string;
}

const StockProductRow: React.FC<StockProductRowProps> = ({
  product,
  editingValue,
  onStockChange,
  onUpdateStock,
  getStockAlertClass,
}) => {
  const isEditing = editingValue !== undefined;
  const displayStock = isEditing ? editingValue : product.stock.toString();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onUpdateStock(product.id);
    }
  };

  return (
    <div className={`stock-product-row ${getStockAlertClass(product.stock)}`}>
      <span className="stock-product-name">{product.name}</span>
      <span className="stock-product-price">
        ${product.price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
      </span>
      <div className="stock-input-group">
        <input
          type="number"
          min="0"
          className="stock-input"
          value={displayStock}
          onChange={(e) => onStockChange(product.id, e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => isEditing && onUpdateStock(product.id)}
        />
        {isEditing && (
          <button
            type="button"
            className="icon-button primary-button"
            onClick={() => onUpdateStock(product.id)}
            aria-label="Guardar stock"
            title="Guardar"
          >
            💾
          </button>
        )}
      </div>
    </div>
  );
};
