import { useState } from 'react';
import QRCode from 'react-qr-code';
import { MonitorSmartphone, Plus, RefreshCw, Repeat, Trash2, X, Zap, ZapOff } from 'lucide-react';
import { apiClient, normalizeApiError } from '../api/client';
import { useDispositivosMpStores, useInvalidateDispositivos, usePosDevices } from '../api/queries';
import type { MpStoresResponse, PosDevice, PosDeviceCreated, PosDeviceTipo } from '../api/types';
import { useToast } from '../components/ToastProvider';

const fmtDateTime = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
};

const usedByFor = (mp: MpStoresResponse | undefined, storeId: string, posId: string) =>
  mp?.used.find((u) => u.storeId === storeId && u.posId === posId)?.usedBy ?? null;

export const AdminDispositivosPage: React.FC = () => {
  const { pushToast } = useToast();
  const invalidate = useInvalidateDispositivos();
  const { data: devices } = usePosDevices();
  const [createOpen, setCreateOpen] = useState(false);
  const [mpDevice, setMpDevice] = useState<PosDevice | null>(null);

  const err = (e: unknown) => pushToast(normalizeApiError(e), 'error');

  const changeTipo = async (id: string, nombre: string, next: PosDeviceTipo, force = false) => {
    try {
      await apiClient.patch(`/dispositivos/${id}/tipo`, { tipo: next, force });
      invalidate();
    } catch (e) {
      const apiErr = e as { response?: { status?: number; data?: { code?: string; pending?: number } } };
      const data = apiErr.response?.data;
      if (apiErr.response?.status === 409 && data?.code === 'DEVICE_HAS_PENDING_SALES') {
        if (confirm(`${nombre} tiene ${data.pending ?? ''} venta(s) pendiente(s) sin sincronizar. ¿Cambiar el modo igual?`)) {
          await changeTipo(id, nombre, next, true);
        }
        return;
      }
      err(e);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <section>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <MonitorSmartphone size={16} /> Dispositivos
        </h3>
        <p><small>Cada terminal necesita su POS de Mercado Pago propio para QR (sin fallback: evita colisiones). CASH opera sin vincular.</small></p>
        <div className="sales-table-wrapper">
          <div className="sales-table">
            <div className="sales-table-head">
              <span className="col-user" style={{ flex: 2 }}>Nombre</span>
              <span className="col-method" style={{ flex: '0 0 80px' }}>Tipo</span>
              <span className="col-user" style={{ flex: 2 }}>MP</span>
              <span className="col-method" style={{ flex: '0 0 70px' }}>Activo</span>
              <span className="col-date" style={{ flex: '0 0 130px' }}>Últ. conexión</span>
              <span className="col-action" style={{ flex: '0 0 150px', textAlign: 'right' }}></span>
            </div>
            {(devices ?? []).length === 0 ? (
              <div className="sales-table-row"><span style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Sin dispositivos</span></div>
            ) : (
              (devices ?? []).map((d) => (
                <div key={d.id} className="sales-table-row">
                  <span className="col-user" style={{ flex: 2, fontWeight: 500 }}>{d.nombre}</span>
                  <span className="col-method" style={{ flex: '0 0 80px' }}>{d.tipo === 'POS' ? 'POS' : 'Entradas'}</span>
                  <span className="col-user" style={{ flex: 2 }}>
                    {d.mpPosId ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Zap size={13} /> {d.mpStoreName ?? ''} / {d.mpPosName ?? ''}
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-warning)' }}>
                        <ZapOff size={13} /> Sin vincular
                      </span>
                    )}
                  </span>
                  <span className="col-method" style={{ flex: '0 0 70px' }}>{d.activo ? 'Sí' : 'No'}</span>
                  <span className="col-date" style={{ flex: '0 0 130px' }}>{fmtDateTime(d.lastSeenAt)}</span>
                  <span className="col-action" style={{ flex: '0 0 150px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                    <button className="btn-ghost" onClick={() => setMpDevice(d)} title="Vincular MP" style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem' }}>
                      <Zap size={14} />
                    </button>
                    <button className="btn-ghost" onClick={async () => {
                      const next = d.tipo === 'POS' ? 'ENTRADAS' : 'POS';
                      if (!confirm(`Cambiar ${d.nombre} a modo ${next === 'POS' ? 'POS' : 'Entradas'}? La terminal lo toma sin re-vincular.`)) return;
                      await changeTipo(d.id, d.nombre, next);
                    }} title="Cambiar modo" style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem' }}><Repeat size={14} /></button>
                    <button className="btn-ghost" onClick={async () => {
                      try {
                        const baseUrl = `${window.location.origin}/api`;
                        const res = await apiClient.post<PosDeviceCreated>(`/dispositivos/${d.id}/rotate`, { baseUrl });
                        pushToast(`Token rotado. Nuevo pairing: ${JSON.stringify(res.data.pairing)}`, 'success');
                        invalidate();
                      } catch (e) { err(e); }
                    }} title="Rotar token" style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem' }}><RefreshCw size={14} /></button>
                    <button className="btn-ghost" onClick={async () => {
                      if (!confirm(`Revocar ${d.nombre}?`)) return;
                      try { await apiClient.post(`/dispositivos/${d.id}/revoke`); invalidate(); } catch (e) { err(e); }
                    }} title="Revocar" style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
      <button type="button" className="fab-button-v2" onClick={() => setCreateOpen(true)} aria-label="Nuevo dispositivo" title="Nuevo dispositivo">
        <Plus size={24} />
      </button>
      {createOpen && <CreateDeviceModal onClose={() => setCreateOpen(false)} />}
      {mpDevice && <MpLinkModal deviceId={mpDevice.id} deviceNombre={mpDevice.nombre} mpPosId={mpDevice.mpPosId} mpLabel={mpDevice.mpPosId ? `${mpDevice.mpStoreName ?? ''} / ${mpDevice.mpPosName ?? ''}` : null} onClose={() => setMpDevice(null)} />}
    </div>
  );
};

// ── Sección MP reutilizable (modal de alta + modal por fila) ──
const MpLinkSection: React.FC<{
  deviceId: string;
  mpPosId: string | null;
  mpLabel: string | null;
  onLinked: (storeId: string, posId: string, storeName: string, posName: string) => void;
  onUnlinked: () => void;
}> = ({ deviceId, mpPosId, mpLabel, onLinked, onUnlinked }) => {
  const { pushToast } = useToast();
  const invalidate = useInvalidateDispositivos();
  const { data: mp, refetch, isFetching } = useDispositivosMpStores(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ storeName: '', posName: '', streetName: '', streetNumber: '', cityName: '', stateName: '', zipCode: '' });
  const err = (e: unknown) => pushToast(normalizeApiError(e), 'error');

  const detect = async () => {
    try {
      const res = await refetch();
      if (((res.data?.stores ?? []).length) === 0) pushToast('Sin tiendas/POS en la cuenta MP', 'error');
    } catch (e) { err(e); }
  };

  const select = async (storeId: string, posId: string, storeName: string, posName: string) => {
    try {
      await apiClient.post(`/dispositivos/${deviceId}/mp-select`, { storeId, posId });
      pushToast('POS vinculado al dispositivo', 'success');
      invalidate();
      onLinked(storeId, posId, storeName, posName);
    } catch (e) { err(e); }
  };

  const create = async () => {
    try {
      await apiClient.post(`/dispositivos/${deviceId}/mp-setup`, form);
      pushToast('POS creado en MP y vinculado', 'success');
      invalidate();
      onLinked('', '', form.storeName, form.posName);
    } catch (e) { err(e); }
  };

  const disconnect = async () => {
    if (!confirm('¿Desvincular el MP? Su QR dejará de operar.')) return;
    try {
      await apiClient.post(`/dispositivos/${deviceId}/mp-disconnect`);
      invalidate();
      onUnlinked();
    } catch (e) { err(e); }
  };

  return (
    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
      <p style={{ margin: '0 0 0.5rem' }}><strong>Mercado Pago</strong><br />
        <small>{mpPosId ? `Vinculado: ${mpLabel ?? ''}` : 'Sin vincular: el QR no opera hasta vincular un POS propio.'}</small>
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary btn-sm" onClick={detect} disabled={isFetching}>
          {isFetching ? 'Detectando...' : 'Detectar tiendas/POS'}
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setShowCreate((v) => !v)}>
          <Plus size={14} /> Crear nuevo en MP
        </button>
        {mpPosId && (
          <button type="button" className="btn-secondary btn-sm" onClick={disconnect}>
            <Trash2 size={12} /> Desvincular
          </button>
        )}
      </div>
      {mp && (
        <div className="sales-table-wrapper" style={{ marginTop: '0.75rem' }}>
          <div className="sales-table">
            <div className="sales-table-head">
              <span className="col-user" style={{ flex: 2 }}>Tienda</span>
              <span className="col-user" style={{ flex: 2 }}>POS</span>
              <span className="col-user" style={{ flex: 2 }}>Uso</span>
              <span className="col-action" style={{ flex: '0 0 110px', textAlign: 'right' }}></span>
            </div>
            {mp.stores.flatMap((s) => s.pos.map((p) => {
              const usedBy = usedByFor(mp, s.id, p.id);
              const mineExact = mpPosId === p.id;
              return (
                <div key={`${s.id}-${p.id}`} className="sales-table-row">
                  <span className="col-user" style={{ flex: 2, fontWeight: 500 }}>{s.name}</span>
                  <span className="col-user" style={{ flex: 2 }}>{p.name}</span>
                  <span className="col-user" style={{ flex: 2 }}>
                    {mineExact ? <strong>Este dispositivo</strong> : usedBy ?? <span style={{ color: 'var(--color-success)' }}>Libre</span>}
                  </span>
                  <span className="col-action" style={{ flex: '0 0 110px', textAlign: 'right' }}>
                    {!mineExact && (
                      <button type="button" className="btn-primary btn-sm" onClick={() => select(s.id, p.id, s.name, p.name)}>Usar este</button>
                    )}
                  </span>
                </div>
              );
            }))}
          </div>
        </div>
      )}
      {showCreate && (
        <div className="settings-field" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'end', marginTop: '0.75rem' }}>
          {[['storeName', 'Tienda'], ['posName', 'Caja'], ['streetName', 'Calle'], ['streetNumber', 'Número'], ['cityName', 'Ciudad'], ['stateName', 'Provincia'], ['zipCode', 'CP']].map(([key, label]) => (
            <div key={key}><label>{label}</label>
              <input value={form[key as keyof typeof form]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
          <button type="button" className="btn-primary btn-sm" onClick={create}>Crear en MP</button>
        </div>
      )}
    </div>
  );
};

// ── Modal "+" : alta + QR + MP en el mismo modal ────────────
const CreateDeviceModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { pushToast } = useToast();
  const invalidate = useInvalidateDispositivos();
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<PosDeviceTipo>('ENTRADAS');
  const [created, setCreated] = useState<PosDeviceCreated | null>(null);
  const [mpLinked, setMpLinked] = useState<{ storeId: string; posId: string; storeName: string; posName: string } | null>(null);

  const create = async () => {
    if (!nombre.trim()) { pushToast('Nombre del dispositivo requerido', 'error'); return; }
    try {
      const baseUrl = `${window.location.origin}/api`;
      const res = await apiClient.post<PosDeviceCreated>('/dispositivos', { nombre: nombre.trim(), tipo, baseUrl });
      setCreated(res.data);
      invalidate();
    } catch (e) { pushToast(normalizeApiError(e), 'error'); }
  };

  const close = () => {
    setCreated(null);
    setMpLinked(null);
    setNombre('');
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal user-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h3>{created ? 'Dispositivo vinculado' : 'Nuevo dispositivo'}</h3>
          <button type="button" className="icon-button" onClick={close}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {!created ? (
            <>
              <div className="settings-field">
                <label>Nombre</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="POS puerta 1" autoFocus />
              </div>
              <div className="settings-field">
                <label>Tipo</label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {(['ENTRADAS', 'POS'] as const).map((t) => (
                    <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                      <input type="radio" name="new-device-tipo" checked={tipo === t} onChange={() => setTipo(t)} />
                      {t === 'POS' ? 'POS' : 'Entradas'}
                    </label>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <p><strong>Token (se muestra una sola vez):</strong></p>
              <code style={{ display: 'block', wordBreak: 'break-all', margin: '0.5rem 0' }}>{created.token}</code>
              <div style={{ background: '#fff', padding: '0.5rem', borderRadius: 8, width: 'fit-content' }}>
                <QRCode value={JSON.stringify(created.pairing)} size={200} />
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <small>Escaneá este QR desde la app del POS para vincularlo.</small>
                <small style={{ display: 'block', marginTop: '0.25rem' }}>Pairing: <code style={{ wordBreak: 'break-all' }}>{JSON.stringify(created.pairing)}</code></small>
              </div>
              <MpLinkSection
                deviceId={created.id}
                mpPosId={mpLinked?.posId || null}
                mpLabel={mpLinked ? `${mpLinked.storeName} / ${mpLinked.posName}` : null}
                onLinked={(storeId, posId, storeName, posName) => setMpLinked({ storeId, posId, storeName, posName })}
                onUnlinked={() => setMpLinked(null)}
              />
            </>
          )}
        </div>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          {!created ? (
            <>
              <button type="button" className="btn-ghost" onClick={close}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={create}>Generar</button>
            </>
          ) : (
            <button type="button" className="btn-primary" onClick={close}>Cerrar</button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Modal vincular MP de una fila existente ──────────────────
const MpLinkModal: React.FC<{
  deviceId: string;
  deviceNombre: string;
  mpPosId: string | null;
  mpLabel: string | null;
  onClose: () => void;
}> = ({ deviceId, deviceNombre, mpPosId, mpLabel, onClose }) => {
  const [linked, setLinked] = useState<{ posId: string; label: string } | null>(
    mpPosId ? { posId: mpPosId, label: mpLabel ?? '' } : null,
  );
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal user-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h3>MP de {deviceNombre}</h3>
          <button type="button" className="icon-button" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <MpLinkSection
            deviceId={deviceId}
            mpPosId={linked?.posId ?? null}
            mpLabel={linked?.label ?? null}
            onLinked={(_storeId, posId, storeName, posName) => setLinked({ posId, label: `${storeName} / ${posName}` })}
            onUnlinked={() => setLinked(null)}
          />
        </div>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
};
