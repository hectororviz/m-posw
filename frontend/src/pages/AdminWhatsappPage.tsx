import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useSettings, useNotificationsConfig, useTestConnection } from '../api/queries';
import { useToast } from '../components/ToastProvider';

const DEFAULT_TEMPLATE =
  'Hola {{nombre}}, tenés un saldo pendiente de ${{saldo}} en {{club}} ({{dias}} días).';

export const AdminWhatsappPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const { data: config, refetch: refetchConfig } = useNotificationsConfig();
  const { pushToast } = useToast();
  const testConnMutation = useTestConnection();

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    httpsmsApiKey: '',
    httpsmsBaseUrl: 'https://api.httpsms.com',
    httpsmsFromNumber: '',
    httpsmsSigningKey: '',
    debtReminderTemplate: DEFAULT_TEMPLATE,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        httpsmsApiKey: settings.httpsmsApiKey ?? '',
        httpsmsBaseUrl: settings.httpsmsBaseUrl || 'https://api.httpsms.com',
        httpsmsFromNumber: settings.httpsmsFromNumber ?? '',
        httpsmsSigningKey: settings.httpsmsSigningKey ?? '',
        debtReminderTemplate: settings.debtReminderTemplate || DEFAULT_TEMPLATE,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        httpsmsApiKey: form.httpsmsApiKey || undefined,
        httpsmsBaseUrl: form.httpsmsBaseUrl || undefined,
        httpsmsFromNumber: form.httpsmsFromNumber || undefined,
        httpsmsSigningKey: form.httpsmsSigningKey || undefined,
        debtReminderTemplate: form.debtReminderTemplate || undefined,
      };
      await apiClient.patch('/settings', payload);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      await refetchConfig();
      pushToast('Configuración de SMS guardada', 'success');
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      const result = await testConnMutation.mutateAsync();
      pushToast(result.message, result.ok ? 'success' : 'error');
      await refetchConfig();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    }
  };

  const handleResetTemplate = () => {
    setForm({ ...form, debtReminderTemplate: DEFAULT_TEMPLATE });
  };

  const previewText = form.debtReminderTemplate
    .replace(/\{\{nombre\}\}/g, 'Juan Pérez')
    .replace(/\{\{saldo\}\}/g, '15.000')
    .replace(/\{\{dias\}\}/g, '45')
    .replace(/\{\{club\}\}/g, settings?.clubName || settings?.storeName || 'nuestro club');

  const charCount = previewText.length;
  const hasAccents = /[áéíóúüñÁÉÍÓÚÜÑ]/.test(previewText);
  const segmentSize = hasAccents ? 70 : 160;
  const segments = Math.ceil(charCount / segmentSize);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-header-title">SMS</h2>
        <p className="page-header-subtitle">Configuración de envío de SMS vía httpSMS</p>

        {config && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            marginTop: '0.5rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.8rem',
            fontWeight: 500,
            backgroundColor: config.provider === 'httpsms' && config.connected
              ? '#d1fae5' : config.provider === 'httpsms'
              ? '#fef3c7' : '#f3f4f6',
            color: config.provider === 'httpsms' && config.connected
              ? '#065f46' : config.provider === 'httpsms'
              ? '#92400e' : '#374151',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
              backgroundColor: config.provider === 'httpsms' && config.connected
                ? '#10b981' : config.provider === 'httpsms'
                ? '#f59e0b' : '#d1d5db',
            }} />
            {config.provider === 'httpsms' && config.connected
              ? 'httpSMS conectado'
              : config.provider === 'httpsms'
              ? 'httpSMS sin conexión'
              : !config.enabled
              ? 'Módulo desactivado'
              : 'Modo manual (sin httpSMS)'}
          </span>
        )}
      </div>

      <div style={{ maxWidth: '700px' }}>

        <div className="settings-section">
          <h3 className="settings-section-header">Conexión httpSMS</h3>

          <div className="settings-field">
            <label htmlFor="sms-apikey">API Key</label>
            <small style={{ color: 'var(--color-text-faint)' }}>
              Obtenela desde el dashboard de httpSMS (Settings). Se envía como <code>x-api-key</code> en cada request.
            </small>
            <input
              id="sms-apikey"
              type="password"
              value={form.httpsmsApiKey}
              onChange={(e) => setForm({ ...form, httpsmsApiKey: e.target.value })}
              placeholder="x-api-key..."
            />
          </div>

          <div className="settings-field">
            <label htmlFor="sms-url">Base URL</label>
            <small style={{ color: 'var(--color-text-faint)' }}>
              Por defecto https://api.httpsms.com. Editable si el club usa una instancia self-hosted de httpSMS.
            </small>
            <input
              id="sms-url"
              type="text"
              value={form.httpsmsBaseUrl}
              onChange={(e) => setForm({ ...form, httpsmsBaseUrl: e.target.value })}
              placeholder="https://api.httpsms.com"
            />
          </div>

          <div className="settings-field">
            <label htmlFor="sms-from">Número de origen</label>
            <small style={{ color: 'var(--color-text-faint)' }}>
              El número configurado en la app Android de httpSMS. Formato E.164: 54911XXXXXXXX.
            </small>
            <input
              id="sms-from"
              type="text"
              value={form.httpsmsFromNumber}
              onChange={(e) => setForm({ ...form, httpsmsFromNumber: e.target.value })}
              placeholder="54911XXXXXXXX"
            />
          </div>

          <div className="settings-field">
            <label htmlFor="sms-signkey">Signing Key de webhooks</label>
            <small style={{ color: 'var(--color-text-faint)' }}>
              Se configura en Settings &gt; Webhooks del dashboard de httpSMS. Usada para validar la firma JWT entrante.
            </small>
            <input
              id="sms-signkey"
              type="password"
              value={form.httpsmsSigningKey}
              onChange={(e) => setForm({ ...form, httpsmsSigningKey: e.target.value })}
              placeholder="Signing key..."
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleTestConnection}
              disabled={testConnMutation.isPending}
            >
              {testConnMutation.isPending ? 'Probando...' : 'Probar conexión'}
            </button>
          </div>
        </div>

        <div className="settings-section" style={{ marginTop: '1.5rem' }}>
          <h3 className="settings-section-header">Plantilla de mensaje (recordatorio de deuda)</h3>
          <p className="settings-section-desc">
            Usá {'{{nombre}}'}, {'{{saldo}}'}, {'{{dias}}'} y {'{{club}}'} como variables.
            SMS es texto libre — no requiere aprobación de plantillas.
          </p>

          <div className="settings-field">
            <label htmlFor="sms-template">Mensaje</label>
            <textarea
              id="sms-template"
              rows={4}
              value={form.debtReminderTemplate}
              onChange={(e) => setForm({ ...form, debtReminderTemplate: e.target.value })}
              style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <button type="button" className="btn-ghost" onClick={handleResetTemplate}>
              Restablecer predeterminada
            </button>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-faint)', marginBottom: '0.5rem' }}>
            {charCount} caracteres &mdash; {hasAccents ? 'Unicode (segmentos de 70)' : 'GSM-7 (segmentos de 160)'}
            {segments > 1 && (
              <span style={{ color: '#d97706', fontWeight: 500 }}>
                {' '}&mdash; <strong>{segments} segmentos SMS</strong> (el mensaje se facturará como {segments} SMS)
              </span>
            )}
          </div>

          <div className="settings-section" style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--color-text-faint)' }}>Vista previa:</h4>
            <p style={{ fontFamily: 'monospace', fontSize: '0.9rem', margin: 0, whiteSpace: 'pre-wrap' }}>{previewText}</p>
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

      </div>
    </div>
  );
};
