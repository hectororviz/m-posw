import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader } from 'lucide-react';
import { apiClient, normalizeApiError } from '../api/client';
import { useNotificacionesConfig, useNotificacionesHistory, useTestNotificacionesConnection, useSettings } from '../api/queries';
import type { NotificacionesJob } from '../api/types';
import { useToast } from '../components/ToastProvider';

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--';

const getNotifBadge = (status: string) => {
  switch (status) {
    case 'SENT': return <span className="badge badge-success">Enviado</span>;
    case 'FAILED': return <span className="badge badge-error">Falló</span>;
    case 'QUEUED': return <span className="badge badge-warning">En cola</span>;
    case 'PROCESSING': return <span className="badge badge-info">Enviando...</span>;
    case 'CANCELLED': return <span className="badge badge-neutral">Cancelado</span>;
    default: return <span className="badge badge-neutral">{status}</span>;
  }
};

type Tab = 'config' | 'history';

export const AdminNotificacionesPage: React.FC = () => {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const { data: config } = useNotificacionesConfig();
  const testMutation = useTestNotificacionesConnection();
  const [tab, setTab] = useState<Tab>('config');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    whatsappPhoneNumberId: '',
    whatsappAccessToken: '',
    whatsappBusinessAccountId: '',
    whatsappWebhookVerifyToken: '',
    whatsappMessageTemplate: '',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        whatsappPhoneNumberId: settings.whatsappPhoneNumberId ?? '',
        whatsappAccessToken: settings.whatsappAccessToken ?? '',
        whatsappBusinessAccountId: settings.whatsappBusinessAccountId ?? '',
        whatsappWebhookVerifyToken: settings.whatsappWebhookVerifyToken ?? '',
        whatsappMessageTemplate: settings.whatsappMessageTemplate ?? 'Hola {{nombre}}, tenés un saldo pendiente de ${{saldo}} en {{club}} ({{dias}} días).',
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch('/settings', form);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      await queryClient.invalidateQueries({ queryKey: ['notificaciones-config'] });
      pushToast('Configuración guardada', 'success');
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      const result = await testMutation.mutateAsync();
      pushToast(result.message || 'Conexión exitosa', 'success');
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    }
  };

  const [historyPage, setHistoryPage] = useState(1);
  const { data: history } = useNotificacionesHistory(historyPage, 20);

  const templatePreview = useCallback(() => {
    const t = form.whatsappMessageTemplate || '';
    return t
      .replace(/\{\{nombre\}\}/g, 'Juan Perez')
      .replace(/\{\{saldo\}\}/g, '$1.500')
      .replace(/\{\{dias\}\}/g, '15')
      .replace(/\{\{club\}\}/g, settings?.clubName || 'nuestro club');
  }, [form.whatsappMessageTemplate, settings?.clubName]);

  const charCount = form.whatsappMessageTemplate ? form.whatsappMessageTemplate.length : 0;

  return (
    <div className="page-container">
      <div className="treasury-subnav">
        <button
          type="button"
          className={`treasury-subnav-link${tab === 'config' ? ' active' : ''}`}
          onClick={() => setTab('config')}
        >
          Configuración
        </button>
        <button
          type="button"
          className={`treasury-subnav-link${tab === 'history' ? ' active' : ''}`}
          onClick={() => setTab('history')}
        >
          Historial
        </button>
      </div>

      {tab === 'config' ? (
        <div style={{ maxWidth: '640px', margin: '1.5rem 0' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>WhatsApp Cloud API (Meta)</h3>
          <p style={{ color: 'var(--color-text-faint)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Configurá las credenciales de la API oficial de WhatsApp Business para enviar notificaciones a tus acreedores.
          </p>

          {error && <p className="error-text" style={{ marginBottom: '1rem' }}>{error}</p>}

          {config && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '0.9rem' }}>
                Estado:{' '}
                {config.isConfigured ? (
                  <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Configurado ✓</span>
                ) : (
                  <span style={{ color: 'var(--color-warning, #f59e0b)', fontWeight: 600 }}>Sin configurar</span>
                )}
                {config.phoneNumberId && <span style={{ marginLeft: '0.75rem', color: 'var(--color-text-faint)', fontSize: '0.85rem' }}>ID: {config.phoneNumberId}</span>}
              </span>
            </div>
          )}

          <div className="settings-field">
            <label>Phone Number ID *</label>
            <input
              type="text"
              value={form.whatsappPhoneNumberId}
              onChange={(e) => setForm({ ...form, whatsappPhoneNumberId: e.target.value })}
              placeholder="Ej: 123456789012345"
            />
            <small style={{ color: 'var(--color-text-faint)' }}>ID del número de teléfono en Meta Business. Se obtiene en Meta Business Suite → WhatsApp → Configuración.</small>
          </div>

          <div className="settings-field">
            <label>Access Token (permanente) *</label>
            <input
              type="password"
              value={form.whatsappAccessToken}
              onChange={(e) => setForm({ ...form, whatsappAccessToken: e.target.value })}
              placeholder="EAA..."
            />
            <small style={{ color: 'var(--color-text-faint)' }}>Token de acceso permanente generado en Meta Business Suite. El sistema genera tokens de sistema (no de prueba, expiran). Crear en Meta Developers → Herramientas → Generar token → whatsapp_business_messaging.</small>
          </div>

          <div className="settings-field">
            <label>Business Account ID</label>
            <input
              type="text"
              value={form.whatsappBusinessAccountId}
              onChange={(e) => setForm({ ...form, whatsappBusinessAccountId: e.target.value })}
              placeholder="Ej: 987654321098765"
            />
            <small style={{ color: 'var(--color-text-faint)' }}>WABA ID de la cuenta de WhatsApp Business. Útil para listar templates, opcional.</small>
          </div>

          <div className="settings-field">
            <label>Webhook Verify Token</label>
            <input
              type="text"
              value={form.whatsappWebhookVerifyToken}
              onChange={(e) => setForm({ ...form, whatsappWebhookVerifyToken: e.target.value })}
              placeholder="Token personalizado"
            />
            <small style={{ color: 'var(--color-text-faint)' }}>Token usado para verificar webhooks entrantes de Meta (cuando se configuran notificaciones de mensajes recibidos).</small>
          </div>

          <div className="settings-field">
            <label>Plantilla de mensaje</label>
            <textarea
              rows={4}
              value={form.whatsappMessageTemplate}
              onChange={(e) => setForm({ ...form, whatsappMessageTemplate: e.target.value })}
              placeholder="Hola {{nombre}}, tenés un saldo pendiente..."
            />
            <small style={{ color: 'var(--color-text-faint)' }}>
              Variables disponibles: {'{{nombre}}'}, {'{{saldo}}'}, {'{{dias}}'}, {'{{club}}'}. Caracteres: {charCount}.
            </small>
            {form.whatsappMessageTemplate && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '6px', background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)', fontSize: '0.9rem' }}>
                <strong>Vista previa:</strong><br />
                {templatePreview()}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleTest}
              disabled={testMutation.isPending || !form.whatsappPhoneNumberId || !form.whatsappAccessToken}
            >
              {testMutation.isPending ? 'Probando...' : 'Probar conexión'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ margin: '1.5rem 0' }}>
          <h3 style={{ marginBottom: '1rem' }}>Historial de notificaciones</h3>
          {history ? (
            <>
              <div className="sales-table">
                <div className="sales-table-head">
                  <span className="col-date">Fecha</span>
                  <span className="col-method">Destinatario</span>
                  <span className="col-total" style={{ flex: '0 0 110px' }}>Estado</span>
                  <span className="col-user">Detalle</span>
                </div>
                {history.jobs.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-faint)' }}>
                    No hay notificaciones registradas
                  </div>
                ) : (
                  history.jobs.map((job: NotificacionesJob) => (
                    <div key={job.id} className="sales-table-row" style={{ cursor: 'default' }}>
                      <span className="col-date">{formatDateTime(job.createdAt)}</span>
                      <span className="col-method">
                        {job.recipientName || job.phoneNumber}
                        {job.attempts > 1 && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)', marginLeft: '0.35rem' }}>
                            (×{job.attempts})
                          </span>
                        )}
                      </span>
                      <span className="col-total" style={{ flex: '0 0 110px' }}>{getNotifBadge(job.status)}</span>
                      <span className="col-user" style={{ fontSize: '0.85rem' }}>
                        {job.error ? (
                          <span style={{ color: 'var(--color-danger)' }} title={job.error}>
                            {job.error.length > 60 ? job.error.slice(0, 60) + '...' : job.error}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-faint)' }}>--</span>
                        )}
                      </span>
                    </div>
                  ))
                )}
              </div>
              {history.total > 20 && (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    disabled={historyPage <= 1}
                  >
                    Anterior
                  </button>
                  <span style={{ alignSelf: 'center', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                    Pág {historyPage} de {Math.ceil(history.total / 20)}
                  </span>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => setHistoryPage(p => p + 1)}
                    disabled={historyPage * 20 >= history.total}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Loader size={20} className="spin-icon" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
