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

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dni: '',
    birthDate: '',
    sex: 'M' as 'M' | 'F',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: playersData, isLoading } = usePlayers({
    search: search || undefined,
    sex: sexFilter || undefined,
    page,
    limit,
  });

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

  const openCreate = () => {
    setEditingId(null);
    setForm({ firstName: '', lastName: '', dni: '', birthDate: '', sex: 'M' });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (id: number) => {
    setEditingId(id);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    setFormError(null);
    if (!form.firstName.trim() || !form.lastName.trim() || !form.dni.trim() || !form.birthDate) {
      setFormError('Completá todos los campos obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dni: form.dni.trim(),
        birthDate: new Date(form.birthDate).toISOString(),
        sex: form.sex,
      };
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
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await apiClient.delete(`/players/${deleteConfirm.id}`);
      pushToast('Jugador eliminado', 'success');
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setDeleteConfirm(null);
    } catch (err: any) {
      pushToast(normalizeApiError(err) || 'Error al eliminar', 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/players/import-excel', formData);
      setImportResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['players'] });
      if (res.data.creados > 0) {
        pushToast(`${res.data.creados} jugadores importados`, 'success');
      }
      if (res.data.errores.length > 0) {
        pushToast(`${res.data.errores.length} errores en la importación`, 'error');
      }
    } catch (err: any) {
      pushToast(normalizeApiError(err) || 'Error al importar', 'error');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (sexFilter) params.set('sex', sexFilter);
      const res = await apiClient.get(`/players/export?${params.toString()}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'jugadores.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      pushToast(normalizeApiError(err) || 'Error al exportar', 'error');
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('es-AR');
  };

  const totalPages = Math.ceil((playersData?.total ?? 0) / limit);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>Jugadores</h2>
        <div className="admin-page-actions">
          <button className="btn btn-secondary" onClick={handleExport} title="Exportar Excel">
            <Download size={16} /> Exportar
          </button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            <Upload size={16} /> Importar Excel
            <input type="file" accept=".xlsx" ref={fileInputRef} onChange={handleImport} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      <div className="admin-filters">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre, apellido o DNI..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select value={sexFilter} onChange={(e) => { setSexFilter(e.target.value); setPage(1); }}>
          <option value="">Todos los sexos</option>
          <option value="M">Masculino</option>
          <option value="F">Femenino</option>
        </select>
      </div>

      {importing && <p style={{ padding: '0.5rem 0' }}>Importando archivo...</p>}

      {importResult && (
        <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--color-surface)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Resultado de importación:</strong>
            <button onClick={() => setImportResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
          </div>
          <p style={{ color: 'var(--color-green-text)', margin: '0.25rem 0' }}>{importResult.creados} jugadores creados</p>
          {importResult.errores.length > 0 && (
            <div style={{ maxHeight: '200px', overflow: 'auto', marginTop: '0.5rem' }}>
              {importResult.errores.map((e, i) => (
                <p key={i} style={{ color: 'var(--color-red-text)', margin: '0.1rem 0', fontSize: '0.85rem' }}>
                  Fila {e.fila}: {e.mensaje}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Apellido</th>
              <th>Nombre</th>
              <th>DNI</th>
              <th>Fecha de Nacimiento</th>
              <th>Sexo</th>
              <th>Torneos</th>
              <th style={{ width: '100px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center' }}>Cargando...</td></tr>
            ) : (playersData?.data ?? []).length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center' }}>No se encontraron jugadores</td></tr>
            ) : (
              (playersData?.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{p.lastName}</td>
                  <td>{p.firstName}</td>
                  <td>{p.dni}</td>
                  <td>{formatDate(p.birthDate)}</td>
                  <td>{p.sex === 'M' ? 'Masculino' : 'Femenino'}</td>
                  <td>{p.tournamentCount ?? 0}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(p.id)}>Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(p)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-pagination">
        <span>Mostrando {playersData?.data?.length ?? 0} de {playersData?.total ?? 0}</span>
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          <select value={limit} onChange={(e) => { setLimit(+e.target.value); setPage(1); }}>
            {LIMITS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <span>Pág {page} de {totalPages || 1}</span>
          <button className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</button>
        </div>
      </div>

      <button className="fab" onClick={openCreate} title="Agregar jugador">
        <Plus size={24} />
      </button>

      {/* Modal crear/editar */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar jugador' : 'Nuevo jugador'}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {formError && <p className="form-error">{formError}</p>}
              <div className="form-group">
                <label>Apellido</label>
                <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Nombre</label>
                <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>DNI</label>
                <input type="text" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Fecha de Nacimiento</label>
                <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Sexo</label>
                <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value as 'M' | 'F' })}>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación eliminar */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Eliminar jugador</h3>
            </div>
            <div className="modal-body">
              <p>¿Eliminar a {deleteConfirm.lastName}, {deleteConfirm.firstName}?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
