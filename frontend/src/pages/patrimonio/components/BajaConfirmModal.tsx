import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { apiClient, normalizeApiError } from '../../../api/client';
import { useAsset } from '../../../api/queries';
import { useToast } from '../../../components/ToastProvider';

interface Props {
  assetId: number;
  onClose: () => void;
}

export const BajaConfirmModal: React.FC<Props> = ({ assetId, onClose }) => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const { data: asset, isLoading } = useAsset(assetId);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setError(null);
    setSaving(true);
    try {
      await apiClient.delete(`/assets/${assetId}`);
      pushToast('Bien dado de baja', 'success');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
    } catch (err: any) {
      const msg = normalizeApiError(err);
      setError(typeof msg === 'string' ? msg : 'Error al dar de baja');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Dar de baja</h3>
          <button className="icon-button" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {error && <p className="error-text" style={{ marginBottom: '0.75rem' }}>{error}</p>}
          {isLoading && <p style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>}
          {asset && (
            <p>¿Estás seguro de que querés dar de baja <strong>{asset.name}</strong>?</p>
          )}
          <p style={{ color: 'var(--color-text-faint)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            El bien se marcará como inactivo y su estado cambiará a "De Baja". Esta acción no se puede deshacer.
          </p>
          <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={handleConfirm} disabled={saving} style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
              {saving ? 'Procesando...' : 'Dar de baja'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
