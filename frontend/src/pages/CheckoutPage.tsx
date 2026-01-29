import { useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import type { Sale } from '../api/types';
import { Layout } from '../components/Layout';
import { useCart } from '../context/CartContext';
import { errorToMessage } from '../utils/errorToMessage';

export const CheckoutPage: React.FC = () => {
  const { items, clear } = useCart();
  const [sale, setSale] = useState<Sale | null>(null);
  const [qrPayload, setQrPayload] = useState<unknown>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);

  const total = useMemo(
    () => items.reduce((acc, item) => acc + item.product.price * item.quantity, 0),
    [items],
  );

  const handleCreateSale = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await apiClient.post<Sale>('/sales', {
        items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
      });
      setSale(response.data);
      clear();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartQr = async () => {
    if (!sale) {
      return;
    }
    setQrLoading(true);
    setError(null);
    try {
      const response = await apiClient.post(`/sales/${sale.id}/payments/mercadopago-qr`);
      setQrPayload(response.data);
    } catch (err) {
      setError(err);
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <Layout title="Crear venta">
      <div className="two-column">
        <section className="card">
          <h2>Resumen</h2>
          {items.length === 0 ? (
            <p>No hay productos en el carrito.</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.product.id}>
                  {item.product.name} x {item.quantity} — ${(
                    item.product.price * item.quantity
                  ).toFixed(2)}
                </li>
              ))}
            </ul>
          )}
          <div className="total-row">
            <strong>Total</strong>
            <span>${total.toFixed(2)}</span>
          </div>
          {error != null && <p className="error-text">{errorToMessage(error)}</p>}
          <button
            type="button"
            className="primary-button"
            onClick={handleCreateSale}
            disabled={items.length === 0 || loading}
          >
            {loading ? 'Creando...' : 'Crear venta'}
          </button>
        </section>
        <section className="card">
          <h2>Respuesta</h2>
          {sale ? (
            <pre className="code-block">{JSON.stringify(sale, null, 2)}</pre>
          ) : (
            <p>Creá una venta para ver el detalle.</p>
          )}
          <button
            type="button"
            className="secondary-button"
            onClick={handleStartQr}
            disabled={!sale || qrLoading}
          >
            {qrLoading ? 'Iniciando...' : 'Iniciar cobro QR'}
          </button>
          {qrPayload != null ? (
            <pre className="code-block">{JSON.stringify(qrPayload, null, 2)}</pre>
          ) : null}
        </section>
      </div>
    </Layout>
  );
};
