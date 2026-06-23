import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../../api/client';
import { usePlayers, usePlayer } from '../../api/queries';
import { useToast } from '../../components/ToastProvider';
import { Download, Plus, Search, Upload, X } from 'lucide-react';
import type { Player as PlayerType } from '../../api/types';

const LIMITS = [10, 25, 50, 100];

export const PlayersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [search, setSearch] = useState('');
  const [sexFilter, setSexFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PlayerType | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ creados: number; errores: { fila: number; mensaje: string }[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ firstName: '', lastName: '', dni: '', birthDate: '', sex: 'M' as 'M' | 'F' });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: playersData, isLoading } = usePlayers({ search: search || undefined, sex: sexFilter || undefined, page, limit });
  const { data: editingPlayer } = usePlayer(editingId ?? undefined);

  useEffect(() => {
    if (editingPlayer && editingId) {
      setForm({
        firstName: editingPlayer.firstName,
        lastName: editingPlayer.lastName,
        dni: editingPlayer.dni,
        birthDate: editingPlayer.birthDate?.slice(0, 10) ?? '',
        sex: editingPlayer.sex,
      });
    }
  }, [editingPlayer, editingId]);

  const openCreate = () => { setEditingId(null); setForm({ firstName: '', lastName: '', dni: '', birthDate: '', sex: 'M' }); setFormError(null); setModalOpen(true); };
  const openEdit = (id: number) => { setEditingId(id); setFormError(null); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const handleSave = async () => {
    setFormError(null);
    if (!form.firstName.trim() || !form.lastName.trim() || !form.dni.trim() || !form.birthDate) {
      setFormError('Completá todos los campos obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), dni: form.dni.trim(), birthDate: new Date(form.birthDate).toISOString(), sex: form.sex };
      if (editingId) {
        await apiClient.put(`/players/${editingId}`, payload);
        pushToast('Jugador actualizado', 'success');
      } else {
        await apiClient.post('/players', payload);
        pushToast('Jugador creado', 'success');
      }
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setModalOpen(false);
    } catch (err: any) {
      const msg = normalizeApiError(err);
      setFormError(typeof msg === 'string' ? msg : 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await apiClient.delete(`/players/${deleteConfirm.id}`);
      pushToast('Jugador eliminado', 'success');
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setDeleteConfirm(null);
    } catch (err: any) { pushToast(normalizeApiError(err) || 'Error al eliminar', 'error'); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const formData = new FormData(); formData.append('file', file);
      const res = await apiClient.post('/players/import-excel', formData);
      setImportResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['players'] });
      if (res.data.creados > 0) pushToast(`${res.data.creados} jugadores importados`, 'success');
      if (res.data.errores.length > 0) pushToast(`${res.data.errores.length} errores en la importación`, 'error');
    } catch (err: any) { pushToast(normalizeApiError(err) || 'Error al importar', 'error'); }
    finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (sexFilter) params.set('sex', sexFilter);
      const res = await apiClient.get(`/players/export?${params.toString()}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'jugadores.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) { pushToast(normalizeApiError(err) || 'Error al exportar', 'error'); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-AR');
  const totalPages = Math.ceil((playersData?.total ?? 0) / limit);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>Jugadores</h2>
        <div className="admin-page-actions">
          <button className="btn-ghost" onClick={handleExport} title="Exportar Excel"><Download size={16} /> Exportar</button>
          <label className="btn-ghost" style={{ cursor: 'pointer' }}>
            <Upload size={16} /> Importar Excel
            <input type="file" accept=".xlsx" ref={fileInputRef} onChange={handleImport} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      <div className="admin-filters">
        <div className="search-box">
          <Search size={16} />
          <input type="text" placeholder="Buscar por nombre, apellido o DNI..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select value={sexFilter} onChange={(e) => { setSexFilter(e.target.value); setPage(1); }}>
          <option value="">Todos los sexos</option>
          <option value="M">Masculino</option>
          <option value="F">Femenino</option>
        </select>
      </div>

      {importing && <p style={{ padding: '0.5rem 0' }}>Importando archivo...</p>}
      {importResult && (
        <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--color-surface)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Resultado de importación:</strong>
            <button onClick={() => setImportResult(null)} className="icon-button"><X size={14} /></button>
          </div>
          <p style={{ color: 'var(--color-green-text)', margin: '0.25rem 0' }}>{importResult.creados} jugadores creados</p>
          {importResult.errores.length > 0 && (
            <div style={{ maxHeight: '200px', overflow: 'auto', marginTop: '0.5rem' }}>
              {importResult.errores.map((e, i) => <p key={i} className="error-text" style={{ margin: '0.1rem 0', fontSize: '0.85rem' }}>Fila {e.fila}: {e.mensaje}</p>)}
            </div>
          )}
        </div>
      )}

      <div className="sales-table-wrapper">
        <div className="sales-table">
          <div className="sales-table-head">
            <span className="col-user" style={{ flex: 1 }}>Apellido</span>
            <span className="col-user" style={{ flex: 1 }}>Nombre</span>
            <span className="col-method" style={{ flex: '0 0 100px' }}>DNI</span>
            <span className="col-date" style={{ flex: '0 0 130px' }}>F. Nacimiento</span>
            <span className="col-method" style={{ flex: '0 0 90px' }}>Sexo</span>
            <span className="col-num" style={{ flex: '0 0 70px' }}>Torneos</span>
            <span className="col-action" style={{ flex: '0 0 130px', textAlign: 'right' }}></span>
          </div>
          {isLoading ? (
            <div className="sales-table-row"><span style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Cargando...</span></div>
          ) : (playersData?.data ?? []).length === 0 ? (
            <div className="sales-table-row"><span style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No se encontraron jugadores</span></div>
          ) : (
            (playersData?.data ?? []).map((p) => (
              <div key={p.id} className="sales-table-row">
                <span className="col-user" style={{ flex: 1, fontWeight: 500 }}>{p.lastName}</span>
                <span className="col-user" style={{ flex: 1 }}>{p.firstName}</span>
                <span className="col-method" style={{ flex: '0 0 100px' }}>{p.dni}</span>
                <span className="col-date" style={{ flex: '0 0 130px' }}>{formatDate(p.birthDate)}</span>
                <span className="col-method" style={{ flex: '0 0 90px' }}>{p.sex === 'M' ? 'Masculino' : 'Femenino'}</span>
                <span className="col-num" style={{ flex: '0 0 70px', textAlign: 'center' }}>{p.tournamentCount ?? 0}</span>
                <span className="col-action" style={{ flex: '0 0 130px', textAlign: 'right' }}>
                  <button className="btn-ghost" onClick={() => openEdit(p.id)} style={{ marginRight: '0.25rem' }}>Editar</button>
                  <button className="btn-ghost" onClick={() => setDeleteConfirm(p)} style={{ color: 'var(--color-danger)' }}>Eliminar</button>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="admin-pagination">
        <span>Mostrando {playersData?.data?.length ?? 0} de {playersData?.total ?? 0}</span>
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          <select value={limit} onChange={(e) => { setLimit(+e.target.value); setPage(1); }}>
            {LIMITS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <span>Pág {page} de {totalPages || 1}</span>
          <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</button>
        </div>
      </div>

      <button type="button" className="fab-button-v2" onClick={openCreate} aria-label="Nuevo jugador" title="Nuevo jugador">
        <Plus size={24} />
      </button>

      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar jugador' : 'Nuevo jugador'}</h3>
              <button className="icon-button" onClick={closeModal}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {formError && <p className="error-text" style={{ marginBottom: '0.75rem' }}>{formError}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="settings-field">
                  <label>Apellido *</label>
                  <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Apellido" />
                </div>
                <div className="settings-field">
                  <label>Nombre *</label>
                  <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Nombre" />
                </div>
                <div className="settings-field">
                  <label>DNI *</label>
                  <input type="text" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} placeholder="DNI" />
                </div>
                <div className="settings-field">
                  <label>Fecha de Nacimiento *</label>
                  <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
                </div>
                <div className="settings-field">
                  <label>Sexo</label>
                  <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value as 'M' | 'F' })}>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
              <button type="button" className="btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="modal delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Eliminar jugador</h3>
              <button className="icon-button" onClick={() => setDeleteConfirm(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p>¿Eliminar a {deleteConfirm.lastName}, {deleteConfirm.firstName}?</p>
            </div>
            <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className="btn-primary" onClick={handleDelete} style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
