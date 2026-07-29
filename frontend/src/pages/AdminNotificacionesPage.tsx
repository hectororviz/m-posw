import React, { useState } from 'react';
import { useNotificationsConfig, useNotificationsHistory, useNotificationsQueue, useCancelAllNotifications } from '../api/queries';

type Tab = 'history' | 'queue';

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
  const { data: config } = useNotificationsConfig();

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
              backgroundColor: config.provider === 'httpsms' && config.connected
                ? '#d1fae5' : config.provider === 'httpsms'
                ? '#fef3c7' : '#f3f4f6',
              color: config.provider === 'httpsms' && config.connected
                ? '#065f46' : config.provider === 'httpsms'
                ? '#92400e' : '#374151',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                backgroundColor: config.provider === 'httpsms' && config.phoneOnline
                  ? '#10b981' : config.provider === 'httpsms'
                  ? '#f59e0b' : '#d1d5db',
              }} />
              {config.provider === 'httpsms' && config.connected
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
        {(['history', 'queue'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`treasury-subnav-link${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'history' ? 'Historial' : 'Cola'}
          </button>
        ))}
      </div>

      {tab === 'history' && <HistoryTab />}
      {tab === 'queue' && <QueueTab />}
    </div>
  );
};

const HistoryTab: React.FC = () => {
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
        <table className="sales-table" style={{ width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: '140px' }}>Fecha</th>
              <th style={{ width: '130px' }}>Destinatario</th>
              <th style={{ width: '80px' }}>Proveedor</th>
              <th style={{ width: '100px' }}>Estado</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{job.createdAt ? new Date(job.createdAt).toLocaleString('es-AR') : '-'}</td>
                <td style={{ fontSize: '0.85rem' }}>{job.acreedor?.nombre || `#${job.creditorId || '-'}`}</td>
                <td style={{ fontSize: '0.8rem' }}>{job.provider || job.channel || '-'}</td>
                <td>
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    backgroundColor: (STATUS_COLORS[job.status] || '#6b7280') + '20',
                    color: STATUS_COLORS[job.status] || '#6b7280',
                  }}>
                    {STATUS_LABELS[job.status] || job.status}
                  </span>
                </td>
                <td style={{ fontSize: '0.8rem', wordBreak: 'break-word', whiteSpace: 'normal' }}>
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
        <table className="sales-table" style={{ width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: '140px' }}>Creado</th>
              <th style={{ width: '120px' }}>Destinatario</th>
              <th style={{ width: '100px' }}>Estado</th>
              <th style={{ width: '75px' }}>Proveedor</th>
              <th style={{ width: '65px' }}>Intentos</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{job.createdAt ? new Date(job.createdAt).toLocaleString('es-AR') : '-'}</td>
                <td style={{ fontSize: '0.85rem' }}>{job.acreedor?.nombre || `#${job.creditorId || '-'}`}</td>
                <td>
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    backgroundColor: (STATUS_COLORS[job.status] || '#6b7280') + '20',
                    color: STATUS_COLORS[job.status] || '#6b7280',
                  }}>
                    {STATUS_LABELS[job.status] || job.status}
                  </span>
                </td>
                <td style={{ fontSize: '0.8rem' }}>{job.provider || job.channel || '-'}</td>
                <td style={{ fontSize: '0.85rem', textAlign: 'center' }}>{job.attempts}</td>
                <td style={{ fontSize: '0.8rem', wordBreak: 'break-word', whiteSpace: 'normal' }}>
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
