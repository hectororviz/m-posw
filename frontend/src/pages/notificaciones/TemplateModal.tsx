import { useEffect, useState } from 'react';
import { Loader, X } from 'lucide-react';
import { apiClient, normalizeApiError } from '../../api/client';
import type { WhatsAppTemplateInfo } from '../../api/types';

interface TemplateModalProps {
  formTemplateName: string;
  formVariableOrder: Record<string, number>;
  onSave: (templateName: string, variableOrder: Record<string, number>) => void;
  onClose: () => void;
  pushToast: (msg: string, type: 'success' | 'error') => void;
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
}

const BODY_VARIABLES = [
  { key: 'saldo', label: 'Saldo pendiente' },
  { key: 'club', label: 'Nombre del club' },
  { key: 'alias', label: 'Alias del club' },
  { key: 'dias', label: 'Días de antigüedad' },
];

const TemplateModal: React.FC<TemplateModalProps> = ({
  formTemplateName,
  formVariableOrder,
  onSave,
  onClose,
  pushToast,
  accessToken,
  businessAccountId,
}) => {
  const [templates, setTemplates] = useState<WhatsAppTemplateInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedName, setSelectedName] = useState(formTemplateName);
  const [variableOrder, setVariableOrder] = useState<Record<string, number>>({ ...formVariableOrder });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    if (!accessToken || !businessAccountId) return;
    setLoading(true);
    try {
      await apiClient.patch('/settings', {
        whatsappAccessToken: accessToken,
        whatsappBusinessAccountId: businessAccountId,
      });
      const res = await apiClient.get<WhatsAppTemplateInfo[]>('/notificaciones/templates');
      const approved = res.data.filter((t) => t.status === 'APPROVED');
      setTemplates(approved);
      if (approved.length === 0) pushToast('No se encontraron templates aprobados', 'error');
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const selected = templates.find((t) => t.name === selectedName);

  const handleSave = () => {
    onSave(selectedName, variableOrder);
    pushToast('Template configurado', 'success');
    onClose();
  };

  const setBodyPos = (key: string, pos: number) => {
    const next = { ...variableOrder };
    Object.keys(next).forEach((k) => {
      if (k !== 'nombre' && k !== key && next[k] === pos) {
        next[k] = 0;
      }
    });
    next[key] = pos;
    setVariableOrder(next);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h3>Configurar template</h3>
          <button className="icon-button" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}><Loader size={20} className="spin-icon" /></div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-faint)' }}>
              No se pudieron cargar templates. Verificá el Access Token y Business Account ID.
              <div style={{ marginTop: '1rem' }}>
                <button type="button" className="btn-ghost btn-sm" onClick={loadTemplates}>
                  Reintentar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="settings-field">
                <label>Template</label>
                <select
                  value={selectedName}
                  onChange={(e) => setSelectedName(e.target.value)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '0.9rem',
                    width: '100%',
                  }}
                >
                  <option value="">Seleccionar template...</option>
                  {templates.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} ({t.language})
                    </option>
                  ))}
                </select>
              </div>

              {selected && (
                <>
                  {selected.headerText && (
                    <div style={{
                      marginBottom: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: 'var(--color-primary-bg)',
                      border: '1px solid var(--color-primary)',
                      fontSize: '0.85rem',
                    }}>
                      <strong>Título:</strong> {selected.headerText}
                    </div>
                  )}

                  {selected.bodyText && (
                    <div style={{
                      marginBottom: '1rem',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.85rem',
                      whiteSpace: 'pre-wrap',
                    }}>
                      <strong>Cuerpo:</strong> {selected.bodyText}
                    </div>
                  )}

                  <div style={{ marginTop: '1rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>Orden de variables</h4>
                    <p style={{ color: 'var(--color-text-faint)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                      <strong>nombre</strong> → Título la posición 1.<br />
                      El resto → Cuerpo en las posiciones 1, 2, 3.
                    </p>

                    <div style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: 'var(--color-primary-bg)',
                      border: '1px solid var(--color-primary)',
                      marginBottom: '0.75rem',
                      fontSize: '0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span><strong>nombre</strong> → Título (siempre posición 1)</span>
                      <span className="badge badge-success">✓</span>
                    </div>

                    {BODY_VARIABLES.map((v) => (
                      <div
                        key={v.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '8px',
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          marginBottom: '0.5rem',
                        }}
                      >
                        <div style={{ flex: 1, fontSize: '0.9rem' }}>{v.key}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-faint)', minWidth: '90px', textAlign: 'right' }}>{v.label}</div>
                        <select
                          value={variableOrder[v.key] || 0}
                          onChange={(e) => setBodyPos(v.key, parseInt(e.target.value))}
                          style={{
                            padding: '0.35rem 0.5rem',
                            borderRadius: '6px',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg)',
                            color: 'var(--color-text)',
                            fontSize: '0.85rem',
                            minWidth: '120px',
                          }}
                        >
                          <option value={0}>No usar</option>
                          <option value={1}>Cuerpo posición 1</option>
                          <option value={2}>Cuerpo posición 2</option>
                          <option value={3}>Cuerpo posición 3</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <div className="modal-footer" style={{ paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={!selectedName || loading}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateModal;
