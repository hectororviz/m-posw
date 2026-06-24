import { useAsset, useAssetEvents } from '../../../api/queries';
import { AssetStatusBadge, EventTypeBadge } from './AssetStatusBadge';
import { X } from 'lucide-react';

interface Props {
  assetId: number;
  onClose: () => void;
}

export const AssetDetail: React.FC<Props> = ({ assetId, onClose }) => {
  const { data: asset, isLoading: assetLoading } = useAsset(assetId);
  const { data: events, isLoading: eventsLoading } = useAssetEvents(assetId);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Detalle del bien</h3>
          <button className="icon-button" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {assetLoading && <p style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>}
          {asset && (
            <div className="settings-section" style={{ marginBottom: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '4px 12px 4px 0', fontWeight: 600, color: 'var(--color-text-faint)', width: 140 }}>Nombre</td>
                    <td style={{ fontWeight: 500 }}>{asset.name}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 12px 4px 0', fontWeight: 600, color: 'var(--color-text-faint)' }}>Descripción</td>
                    <td>{asset.description || '-'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 12px 4px 0', fontWeight: 600, color: 'var(--color-text-faint)' }}>Categoría</td>
                    <td>{asset.category?.name ?? '-'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 12px 4px 0', fontWeight: 600, color: 'var(--color-text-faint)' }}>Estado</td>
                    <td><AssetStatusBadge name={asset.status?.name ?? ''} /></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 12px 4px 0', fontWeight: 600, color: 'var(--color-text-faint)' }}>Ubicación</td>
                    <td>{asset.location || '-'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 12px 4px 0', fontWeight: 600, color: 'var(--color-text-faint)' }}>Fecha adquisición</td>
                    <td>{asset.acquisitionDate ? new Date(asset.acquisitionDate).toLocaleDateString('es-AR') : '-'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 12px 4px 0', fontWeight: 600, color: 'var(--color-text-faint)' }}>Valor adquisición</td>
                    <td>{asset.acquisitionValue != null ? `$${Number(asset.acquisitionValue).toFixed(2)}` : '-'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 12px 4px 0', fontWeight: 600, color: 'var(--color-text-faint)' }}>Notas</td>
                    <td>{asset.notes || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-text)' }}>Historial de eventos</h4>
          {eventsLoading && <p style={{ color: 'var(--color-text-muted)' }}>Cargando historial...</p>}
          {!eventsLoading && (!events || events.length === 0) && (
            <p style={{ color: 'var(--color-text-faint)', fontSize: '0.85rem' }}>Sin eventos registrados</p>
          )}
          {events && events.length > 0 && (
            <div className="sales-table-wrapper">
              <div className="sales-table">
                <div className="sales-table-head">
                  <span className="col-date" style={{ flex: '0 0 160px' }}>Fecha</span>
                  <span className="col-method" style={{ flex: '0 0 130px' }}>Tipo</span>
                  <span className="col-user" style={{ flex: 1 }}>Descripción</span>
                </div>
                {events.map((ev) => (
                  <div key={ev.id} className="sales-table-row">
                    <span className="col-date" style={{ flex: '0 0 160px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {new Date(ev.eventDate).toLocaleString('es-AR')}
                    </span>
                    <span className="col-method" style={{ flex: '0 0 130px' }}>
                      <EventTypeBadge type={ev.eventType} />
                    </span>
                    <span className="col-user" style={{ flex: 1 }}>{ev.description || '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
};
