import { useState } from 'react';
import { apiClient } from '../api/client';

interface BeneficioInfo {
  id: string;
  categoriaId: string;
  categoriaNombre: string;
  porcentaje: number;
  descuentoMaximo: number | null;
  disponible: boolean;
  motivoNoDisponible: string | null;
}

interface SocioQrData {
  socio: { nombre: string; nroSocio: number; tipo: string; id?: number };
  estado: string;
  beneficios: BeneficioInfo[];
}

interface Props {
  onApplyDiscounts: (data: SocioQrData) => void;
  onClose: () => void;
}

const estadoBadge = (estado: string) => {
  if (estado === 'AL_DIA') return <span className="badge badge-success">AL DIA</span>;
  if (estado === 'ATRASADO') return <span className="badge badge-danger">ATRASADO</span>;
  return <span className="badge badge-neutral">{estado}</span>;
};

export const SocioQrModal: React.FC<Props> = ({ onApplyDiscounts, onClose }) => {
  const [uuid, setUuid] = useState('');
  const [data, setData] = useState<SocioQrData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!uuid.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<SocioQrData & { socio: { id: number } }>(`/socios/qr/${uuid.trim()}`);
      setData(res.data);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError('QR no reconocido.');
      } else {
        setError('Error al consultar el QR.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (data) onApplyDiscounts(data);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal user-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h3>{data ? `Socio: ${data.socio.nombre}` : 'Escanear QR'}</h3>
          <button className="icon-button" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {!data ? (
            <>
              {error && <p className="error-text" style={{ marginBottom: '0.75rem' }}>{error}</p>}
              <div className="settings-field">
                <label>Codigo QR (UUID)</label>
                <input
                  type="text"
                  value={uuid}
                  onChange={(e) => setUuid(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                  placeholder="Ingresar o escanear UUID..."
                  autoFocus
                />
              </div>
              <div className="modal-footer" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={handleScan} disabled={loading || !uuid.trim()}>
                  {loading ? 'Consultando...' : 'Consultar'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.25rem' }}><strong>Nombre:</strong> {data.socio.nombre}</p>
                <p style={{ margin: '0 0 0.25rem' }}><strong>Nº Socio:</strong> #{data.socio.nroSocio}</p>
                <p style={{ margin: '0 0 0.5rem' }}><strong>Tipo:</strong> {data.socio.tipo}</p>
                {estadoBadge(data.estado)}
              </div>

              {data.estado !== 'AL_DIA' || data.beneficios.length === 0 ? (
                <p style={{ color: 'var(--color-text-faint)' }}>Sin beneficios disponibles.</p>
              ) : (
                <div className="settings-section">
                  <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>Beneficios disponibles</h4>
                  {data.beneficios.filter(b => b.disponible).map((b) => (
                    <div key={b.id} style={{ marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600 }}>{b.categoriaNombre}</span>: {b.porcentaje}%
                      {b.descuentoMaximo && <span> (tope: ${b.descuentoMaximo})</span>}
                    </div>
                  ))}
                  {data.beneficios.filter(b => !b.disponible).length > 0 && (
                    <>
                      <h4 style={{ margin: '0.75rem 0 0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>No disponibles</h4>
                      {data.beneficios.filter(b => !b.disponible).map((b) => (
                        <div key={b.id} style={{ marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>
                          <span>{b.categoriaNombre}</span>: {b.porcentaje}% — {b.motivoNoDisponible}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleApply}
                  disabled={data.estado !== 'AL_DIA' || !data.beneficios.some(b => b.disponible)}
                >
                  Aplicar descuentos
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
