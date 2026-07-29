import React, { useState, useEffect } from 'react';
import { useNotificationsConfig, useTestConnection, useNotificationsHistory, useNotificationsQueue, useCancelAllNotifications, useSettings } from '../api/queries';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Setting } from '../api/types';

type Tab = 'history' | 'queue' | 'config';

const STATUS_LABELS: Record<string, string> = {
  QUEUED: 'En cola',
  PROCESSING: 'Procesando',
  SENT: 'Enviado',
  ENTREGADO: 'Entregado',
  FAILED: 'Fallido',
  ERROR: 'Error',
  CANCELLED: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  QUEUED: '#f59e0b',
  PROCESSING: '#3b82f6',
  SENT: '#10b981',
  ENTREGADO: '#059669',
  FAILED: '#ef4444',
  ERROR: '#ef4444',
  CANCELLED: '#6b7280',
};

export const AdminNotificacionesPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('history');
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const hasConfigAccess = isAdmin;
  const { data: config, refetch: refetchConfig } = useNotificationsConfig();
  const { data: settings } = useSettings();

  return (
    <div className="page">
      <div className="page-header">
        <h2>Centro de Notificaciones</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {config && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.25rem 0.75rem',
              borderRadius: '999px',
              fontSize: '0.8rem',
              fontWeight: 500,
              backgroundColor: config.provider === 'httpsms' && config.phoneOnline
                ? '#d1fae5' : config.provider === 'httpsms'
                ? '#fef3c7' : '#f3f4f6',
              color: config.provider === 'httpsms' && config.phoneOnline
                ? '#065f46' : config.provider === 'httpsms'
                ? '#92400e' : '#374151',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                backgroundColor: config.provider === 'httpsms' && config.phoneOnline
                  ? '#10b981' : config.provider === 'httpsms'
                  ? '#f59e0b' : '#d1d5db',
              }} />
              {config.provider === 'httpsms' && config.phoneOnline
                ? 'httpSMS conectado'
                : config.provider === 'httpsms'
                ? 'Teléfono offline'
                : !config.enabled
                ? 'Sin configurar'
                : 'Modo manual'}
            </span>
          )}
        </div>
      </div>

      <div className="treasury-subnav" style={{ marginBottom: '1rem' }}>
        {(['history', 'queue', ...(hasConfigAccess ? ['config' as Tab] : [])]).map((t) => (
          <button
            key={t}
            className={`treasury-subnav-link${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'history' ? 'Historial' : t === 'queue' ? 'Cola' : 'Configuración'}
          </button>
        ))}
      </div>

      {tab === 'history' && <HistoryTab config={config} />}
      {tab === 'queue' && <QueueTab />}
      {tab === 'config' && hasConfigAccess && (
        <ConfigTab config={config} settings={settings} onSave={refetchConfig} />
      )}
    </div>
  );
};

const HistoryTab: React.FC<{ config: any }> = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useNotificationsHistory(page, 30);

  const jobs = data?.jobs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 30));

  return (
    <div>
      {isLoading && <p style={{ color: '#6b7280' }}>Cargando historial...</p>}
      {!isLoading && jobs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#6b7280' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Sin notificaciones enviadas</p>
          <p>Las notificaciones de deuda enviadas aparecerán aquí.</p>
        </div>
      )}
      {jobs.length > 0 && (
        <table className="sales-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Destinatario</th>
              <th>Proveedor</th>
              <th>Estado</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>{job.createdAt ? new Date(job.createdAt).toLocaleString('es-AR') : '-'}</td>
                <td>{job.acreedor?.nombre || `#${job.creditorId || '-'}`}</td>
                <td>{job.provider || job.channel || '-'}</td>
                <td>
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    backgroundColor: (STATUS_COLORS[job.status] || '#6b7280') + '20',
                    color: STATUS_COLORS[job.status] || '#6b7280',
                  }}>
                    {STATUS_LABELS[job.status] || job.status}
                  </span>
                </td>
                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {job.error || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            className="button secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Anterior
          </button>
          <span style={{ alignSelf: 'center', fontSize: '0.85rem', color: '#6b7280' }}>
            Pág. {page} de {totalPages}
          </span>
          <button
            className="button secondary"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

const QueueTab: React.FC = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useNotificationsQueue(undefined, page, 30);
  const cancelAll = useCancelAllNotifications();

  const jobs = data?.jobs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 30));
  const counts = data?.counts ?? {};

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {Object.entries(counts).map(([status, count]) => (
          <span key={status} style={{
            padding: '0.2rem 0.5rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 500,
            backgroundColor: (STATUS_COLORS[status] || '#6b7280') + '20',
            color: STATUS_COLORS[status] || '#6b7280',
          }}>
            {STATUS_LABELS[status] || status}: {count}
          </span>
        ))}
        {(data?.isRunning) && (
          <span style={{
            padding: '0.2rem 0.5rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 500,
            backgroundColor: '#dbeafe',
            color: '#1e40af',
          }}>
            Procesando...
          </span>
        )}
      </div>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button
          className="button secondary"
          style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}
          onClick={() => cancelAll.mutate()}
          disabled={cancelAll.isPending}
        >
          Cancelar todos los pendientes
        </button>
      </div>

      {isLoading && <p style={{ color: '#6b7280' }}>Cargando cola...</p>}
      {!isLoading && jobs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#6b7280' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Cola vacía</p>
          <p>No hay notificaciones pendientes.</p>
        </div>
      )}
      {jobs.length > 0 && (
        <table className="sales-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Creado</th>
              <th>Destinatario</th>
              <th>Estado</th>
              <th>Proveedor</th>
              <th>Intentos</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>{job.createdAt ? new Date(job.createdAt).toLocaleString('es-AR') : '-'}</td>
                <td>{job.acreedor?.nombre || `#${job.creditorId || '-'}`}</td>
                <td>
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    backgroundColor: (STATUS_COLORS[job.status] || '#6b7280') + '20',
                    color: STATUS_COLORS[job.status] || '#6b7280',
                  }}>
                    {STATUS_LABELS[job.status] || job.status}
                  </span>
                </td>
                <td>{job.provider || job.channel || '-'}</td>
                <td>{job.attempts}</td>
                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {job.error || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="button secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</button>
          <span style={{ alignSelf: 'center', fontSize: '0.85rem', color: '#6b7280' }}>Pág. {page} de {totalPages}</span>
          <button className="button secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Siguiente</button>
        </div>
      )}
    </div>
  );
};

const ConfigTab: React.FC<{ config: any; settings: Setting | undefined; onSave: () => void }> = ({ config, settings, onSave }) => {
  const testConnection = useTestConnection();
  const [form, setForm] = useState({
    httpsmsApiKey: settings?.httpsmsApiKey || '',
    httpsmsBaseUrl: settings?.httpsmsBaseUrl || 'https://api.httpsms.com',
    httpsmsFromNumber: settings?.httpsmsFromNumber || '',
    httpsmsSigningKey: settings?.httpsmsSigningKey || '',
    debtReminderTemplate: settings?.debtReminderTemplate || 'Hola {{nombre}}, tenés un saldo pendiente de ${{saldo}} en {{club}} ({{dias}} días). Alias para transferir: {{alias}}.',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setForm({
        httpsmsApiKey: settings.httpsmsApiKey || '',
        httpsmsBaseUrl: settings.httpsmsBaseUrl || 'https://api.httpsms.com',
        httpsmsFromNumber: settings.httpsmsFromNumber || '',
        httpsmsSigningKey: settings.httpsmsSigningKey || '',
        debtReminderTemplate: settings.debtReminderTemplate || 'Hola {{nombre}}, tenés un saldo pendiente de ${{saldo}} en {{club}} ({{dias}} días). Alias para transferir: {{alias}}.',
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      await apiClient.patch('/settings', form);
      setSaveMsg('Configuración guardada correctamente.');
      onSave();
    } catch {
      setSaveMsg('Error al guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestResult(null);
    try {
      const result = await testConnection.mutateAsync();
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ ok: false, message: err?.response?.data?.message || err?.message || 'Error de conexión' });
    }
  };

  const previewText = form.debtReminderTemplate
    .replace(/\{\{nombre\}\}/g, 'Juan Pérez')
    .replace(/\{\{saldo\}\}/g, '15.000')
    .replace(/\{\{dias\}\}/g, '45')
    .replace(/\{\{club\}\}/g, settings?.clubName || settings?.storeName || 'nuestro club')
    .replace(/\{\{alias\}\}/g, 'club.alias.transfer');

  const charCount = previewText.length;
  const hasAccents = /[áéíóúüñÁÉÍÓÚÜÑ]/.test(previewText);
  const segmentSize = hasAccents ? 70 : 160;
  const segments = Math.ceil(charCount / segmentSize);

  return (
    <div style={{ maxWidth: '700px' }}>
      <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>Estado</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {config?.enabled ? (
            config?.provider === 'httpsms' && config?.phoneOnline ? (
              <span style={{ color: '#059669', fontWeight: 500 }}>httpSMS conectado - Teléfono online</span>
            ) : config?.provider === 'httpsms' ? (
              <span style={{ color: '#d97706', fontWeight: 500 }}>httpSMS configurado pero teléfono offline</span>
            ) : (
              <span style={{ color: '#d97706', fontWeight: 500 }}>Modo manual (sin httpSMS)</span>
            )
          ) : (
            <span style={{ color: '#6b7280', fontWeight: 500 }}>Módulo desactivado</span>
          )}
        </div>
      </div>

      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Configuración de httpSMS</h3>

      <div className="settings-field" style={{ marginBottom: '1rem' }}>
        <label>
          <strong>API Key</strong>
          <small>Obtenela desde el dashboard de httpSMS (Settings)</small>
        </label>
        <input
          type="password"
          className="input"
          value={form.httpsmsApiKey}
          onChange={(e) => setForm({ ...form, httpsmsApiKey: e.target.value })}
          placeholder="x-api-key..."
        />
      </div>

      <div className="settings-field" style={{ marginBottom: '1rem' }}>
        <label>
          <strong>Base URL</strong>
          <small>Por defecto https://api.httpsms.com. Editable para self-hosted.</small>
        </label>
        <input
          type="text"
          className="input"
          value={form.httpsmsBaseUrl}
          onChange={(e) => setForm({ ...form, httpsmsBaseUrl: e.target.value })}
          placeholder="https://api.httpsms.com"
        />
      </div>

      <div className="settings-field" style={{ marginBottom: '1rem' }}>
        <label>
          <strong>Número de origen</strong>
          <small>Formato E.164: 54911XXXXXXXX</small>
        </label>
        <input
          type="text"
          className="input"
          value={form.httpsmsFromNumber}
          onChange={(e) => setForm({ ...form, httpsmsFromNumber: e.target.value })}
          placeholder="54911XXXXXXXX"
        />
      </div>

      <div className="settings-field" style={{ marginBottom: '1rem' }}>
        <label>
          <strong>Signing Key de webhooks</strong>
          <small>Se configura en Settings &gt; Webhooks de httpSMS.</small>
        </label>
        <input
          type="password"
          className="input"
          value={form.httpsmsSigningKey}
          onChange={(e) => setForm({ ...form, httpsmsSigningKey: e.target.value })}
          placeholder="Signing key..."
        />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
        <button className="button primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
        <button className="button secondary" onClick={handleTestConnection} disabled={testConnection.isPending}>
          {testConnection.isPending ? 'Probando...' : 'Probar conexión'}
        </button>
      </div>

      {saveMsg && (
        <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', backgroundColor: saveMsg.includes('Error') ? '#fee2e2' : '#d1fae5', color: saveMsg.includes('Error') ? '#dc2626' : '#065f46' }}>
          {saveMsg}
        </div>
      )}

      {testResult && (
        <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', backgroundColor: testResult.ok ? '#d1fae5' : '#fee2e2', color: testResult.ok ? '#065f46' : '#dc2626' }}>
          {testResult.message}
        </div>
      )}

      <h3 style={{ margin: '2rem 0 1rem 0', fontSize: '1rem' }}>Plantilla de mensaje (Recordatorio de deuda)</h3>

      <div className="settings-field" style={{ marginBottom: '1rem' }}>
        <label>
          <strong>Mensaje</strong>
          <small>Placeholders: {'{{nombre}} {{saldo}} {{dias}} {{club}} {{alias}}'}</small>
        </label>
        <textarea
          className="input"
          rows={4}
          value={form.debtReminderTemplate}
          onChange={(e) => setForm({ ...form, debtReminderTemplate: e.target.value })}
        />
      </div>

      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
        {charCount} caracteres — {hasAccents ? 'Unicode (segmentos de 70)' : 'GSM-7 (segmentos de 160)'}
        {segments > 1 && (
          <span style={{ color: '#d97706', fontWeight: 500 }}>
            {' '}— <strong>{segments} segmentos SMS</strong>
          </span>
        )}
      </div>

      <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '0.5rem', marginBottom: '1rem' }}>
        <strong style={{ fontSize: '0.8rem', color: '#6b7280' }}>Vista previa:</strong>
        <p style={{ margin: '0.5rem 0 0 0', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem' }}>
          {previewText}
        </p>
      </div>
    </div>
  );
};
