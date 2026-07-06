import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useSettings, useWhatsappStatus, useWhatsappLogs } from '../api/queries';
import type { NotificationLog } from '../api/types';
import { useToast } from '../components/ToastProvider';

type TabId = 'history' | 'config';

const DEFAULT_TEMPLATE =
  'Hola {{nombre}}, te recordamos que tenés una deuda pendiente de ${{saldo}} con {{dias}} días de antigüedad. Por favor regularizá tu situación a la brevedad. Gracias.';

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'SENT': return <span className="badge badge-success">Enviado</span>;
    case 'FAILED': return <span className="badge badge-error">Falló</span>;
    default: return <span className="badge badge-neutral">{status}</span>;
  }
};

export const AdminWhatsappPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const { data: sessionStatus, refetch: refetchStatus } = useWhatsappStatus();
  const { data: logs = [] } = useWhatsappLogs();
  const { pushToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('history');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  const [form, setForm] = useState({
    openwaApiUrl: '',
    openwaApiKey: '',
    openwaSessionName: 'mposw',
    openwaMessageTemplate: DEFAULT_TEMPLATE,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        openwaApiUrl: settings.openwaApiUrl ?? '',
        openwaApiKey: settings.openwaApiKey ?? '',
        openwaSessionName: settings.openwaSessionName ?? 'mposw',
        openwaMessageTemplate: settings.openwaMessageTemplate ?? DEFAULT_TEMPLATE,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await apiClient.patch('/settings', form);
      queryClient.setQueryData(['settings'], response.data);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      pushToast('Configuración de WhatsApp guardada', 'success');
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!form.openwaApiUrl || !form.openwaApiKey) {
      pushToast('Configurá la URL y API Key primero', 'error');
      return;
    }
    setTesting(true);
    try {
      await apiClient.post('/whatsapp/send', {
        phoneNumber: '5491112345678@c.us',
        text: 'Mensaje de prueba desde m-POSw - WhatsApp module',
        sourceModule: 'TEST',
      });
      pushToast('Mensaje de prueba enviado', 'success');
      await queryClient.invalidateQueries({ queryKey: ['whatsapp-logs'] });
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleGetQr = async () => {
    setQrLoading(true);
    try {
      const response = await apiClient.get('/whatsapp/qr');
      const qrData = response.data;
      if (qrData && typeof qrData === 'object' && qrData.qrCode) {
        setQrImage(qrData.qrCode);
      } else if (typeof qrData === 'string') {
        setQrImage(qrData);
      } else {
        setQrImage(JSON.stringify(qrData));
      }
      setShowQrModal(true);
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setQrLoading(false);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      await apiClient.post('/whatsapp/start');
      pushToast('Sesión iniciada. Escaneá el QR para vincular.', 'success');
      await refetchStatus();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setStarting(false);
    }
  };

  const handleResetTemplate = () => {
    setForm({ ...form, openwaMessageTemplate: DEFAULT_TEMPLATE });
  };

  const getSessionStatusDisplay = () => {
    if (!sessionStatus) return null;
    const status = typeof sessionStatus === 'object' ? (sessionStatus as any).status : sessionStatus;
    switch (status) {
      case 'ready':
      case 'CONNECTED':
        return <span className="badge badge-success">Conectado</span>;
      case 'qr_ready':
      case 'QR_READY':
        return <span className="badge badge-warning">QR pendiente</span>;
      case 'initializing':
      case 'INITIALIZING':
        return <span className="badge badge-info">Inicializando...</span>;
      case 'no_config':
      case 'no_api_key':
        return <span className="badge badge-neutral">Sin configurar</span>;
      default:
        return <span className="badge badge-neutral">{String(status)}</span>;
    }
  };

  const previewMessage = form.openwaMessageTemplate
    .replace(/\{\{nombre\}\}/g, 'Juan Perez')
    .replace(/\{\{saldo\}\}/g, '15.000')
    .replace(/\{\{dias\}\}/g, '45');

  return (
    <div>
      <div className="page-header">
        <h2 className="page-header-title">WhatsApp</h2>
        <p className="page-header-subtitle">Notificaciones de deuda vía WhatsApp usando OpenWA</p>
      </div>

      <div className="tab-bar" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'history'}
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          Historial
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'config'}
          className={activeTab === 'config' ? 'active' : ''}
          onClick={() => setActiveTab('config')}
        >
          Configuración
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'history' && (
          <div className="settings-section">
            <h3 className="settings-section-header">Mensajes enviados</h3>
            {logs.length === 0 ? (
              <p style={{ color: 'var(--color-text-faint)', textAlign: 'center', padding: '2rem' }}>
                No hay notificaciones enviadas todavía.
              </p>
            ) : (
              <div className="sales-table-wrapper">
                <div className="sales-table">
                  <div className="sales-table-head">
                    <span className="col-date">Fecha</span>
                    <span className="col-user">Destinatario</span>
                    <span className="col-method" style={{ flex: '0 0 120px' }}>Estado</span>
                    <span className="col-total" style={{ flex: '0 0 80px' }}></span>
                  </div>
                  {logs.map((l: NotificationLog) => (
                    <div key={l.id} className="sales-table-row" style={{ cursor: 'default' }}>
                      <span className="col-date">{formatDate(l.createdAt)}</span>
                      <span className="col-user">
                        {l.recipient}
                        {l.acreedorId && <small style={{ color: 'var(--color-text-faint)', marginLeft: '0.5rem' }}>#{l.acreedorId}</small>}
                      </span>
                      <span className="col-method" style={{ flex: '0 0 120px' }}>{getStatusBadge(l.status)}</span>
                      <span className="col-total" style={{ flex: '0 0 80px' }}>
                        {l.errorMessage && (
                          <span style={{ color: 'var(--color-danger)', fontSize: '0.8rem' }} title={l.errorMessage}>
                            {l.errorMessage.length > 30 ? l.errorMessage.slice(0, 30) + '...' : l.errorMessage}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'config' && (
          <>
            <div className="settings-section">
              <h3 className="settings-section-header">Conexión OpenWA</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Estado:</span>
                {getSessionStatusDisplay()}
              </div>
              <div className="settings-field">
                <label htmlFor="wa-url">URL de OpenWA</label>
                <input
                  id="wa-url"
                  type="text"
                  value={form.openwaApiUrl}
                  onChange={(e) => setForm({ ...form, openwaApiUrl: e.target.value })}
                  placeholder="http://localhost:2785/api"
                />
              </div>
              <div className="settings-field">
                <label htmlFor="wa-apikey">API Key</label>
                <input
                  id="wa-apikey"
                  type="password"
                  value={form.openwaApiKey}
                  onChange={(e) => setForm({ ...form, openwaApiKey: e.target.value })}
                  placeholder="owa_k1_..."
                />
              </div>
              <div className="settings-field">
                <label htmlFor="wa-session">Nombre de sesión</label>
                <input
                  id="wa-session"
                  type="text"
                  value={form.openwaSessionName}
                  onChange={(e) => setForm({ ...form, openwaSessionName: e.target.value })}
                  placeholder="mposw"
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" onClick={handleStart} disabled={starting}>
                  {starting ? 'Iniciando...' : 'Iniciar sesión'}
                </button>
                <button type="button" className="btn-secondary" onClick={handleGetQr} disabled={qrLoading}>
                  {qrLoading ? 'Cargando...' : 'Escanear QR'}
                </button>
                <button type="button" className="btn-ghost" onClick={handleTest} disabled={testing}>
                  {testing ? 'Enviando...' : 'Probar conexión'}
                </button>
              </div>
            </div>

            <div className="settings-section" style={{ marginTop: '1.5rem' }}>
              <h3 className="settings-section-header">Plantilla de mensaje</h3>
              <p className="settings-section-desc">
                Usá {'{{nombre}}'}, {'{{saldo}}'} y {'{{dias}}'} como variables que se reemplazan automáticamente.
              </p>
              <div className="settings-field">
                <label htmlFor="wa-template">Mensaje</label>
                <textarea
                  id="wa-template"
                  rows={4}
                  value={form.openwaMessageTemplate}
                  onChange={(e) => setForm({ ...form, openwaMessageTemplate: e.target.value })}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button type="button" className="btn-ghost" onClick={handleResetTemplate}>
                  Restablecer predeterminada
                </button>
              </div>

              <div className="settings-section" style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--color-text-faint)' }}>Vista previa:</h4>
                <p style={{ fontFamily: 'monospace', fontSize: '0.9rem', margin: 0, whiteSpace: 'pre-wrap' }}>{previewMessage}</p>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <div className="settings-footer">
                <div className="settings-footer-left" />
                <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar configuración'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showQrModal && (
        <div className="modal-backdrop" onClick={() => { setShowQrModal(false); setQrImage(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Escanear código QR</h3>
              <button className="icon-button" onClick={() => { setShowQrModal(false); setQrImage(null); }} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              {qrImage ? (
                <>
                  <p style={{ marginBottom: '1rem', color: 'var(--color-text-faint)' }}>
                    Escaneá este código QR con WhatsApp en tu teléfono para vincular la sesión.
                  </p>
                  <img src={qrImage} alt="WhatsApp QR" style={{ maxWidth: '280px', borderRadius: 'var(--radius-md)' }} />
                </>
              ) : (
                <p style={{ color: 'var(--color-text-faint)' }}>No se pudo obtener el QR. Intentá iniciar la sesión primero.</p>
              )}
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: '1rem' }}
                onClick={() => { setShowQrModal(false); setQrImage(null); }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
