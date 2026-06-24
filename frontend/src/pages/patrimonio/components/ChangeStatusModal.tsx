import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { apiClient, normalizeApiError } from '../../../api/client';
import { useAsset, useAssetStatuses } from '../../../api/queries';
import { useToast } from '../../../components/ToastProvider';
import { AssetStatusBadge } from './AssetStatusBadge';

interface Props {
  assetId: number;
  onClose: () => void;
}

export const ChangeStatusModal: React.FC<Props> = ({ assetId, onClose }) => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const { data: asset, isLoading } = useAsset(assetId);
  const { data: statuses } = useAssetStatuses();

  const [statusId, setStatusId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const availableStatuses = (statuses ?? []).filter((s) => {
    if (s.isSystem && s.name === 'De Baja') return false;
    return s.isActive;
  });

  const handleSave = async () => {
    setFormError(null);
    if (!statusId) {
      setFormError('Seleccioná un estado');
      return;
    }
    setSaving(true);
    try {
      await apiClient.patch(`/assets/${assetId}/status`, { statusId, description: description.trim() || undefined });
      pushToast('Estado actualizado', 'success');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
    } catch (err: any) {
      const msg = normalizeApiError(err);
      setFormError(typeof msg === 'string' ? msg : 'Error al cambiar estado');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Cambiar estado</h3>
          <button className="icon-button" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {formError && <p className="error-text" style={{ marginBottom: '0.75rem' }}>{formError}</p>}
          {isLoading && <p style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>}
          {asset && (
            <p style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>
              <strong>{asset.name}</strong>
              <span style={{ marginLeft: 8 }}>
                <AssetStatusBadge name={asset.status?.name ?? ''} />
              </span>
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="settings-field">
              <label>Nuevo estado *</label>
              <select value={statusId} onChange={(e) => setStatusId(e.target.value ? +e.target.value : '')}>
                <option value="">Seleccionar estado</option>
                {availableStatuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="settings-field" style={{ marginBottom: 0 }}>
              <label>Descripción (opcional)</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Motivo del cambio..." />
            </div>
          </div>

          <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn-primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Guardando...' : 'Cambiar estado'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
