import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../../api/client';
import { useTournaments, usePlayerCategories } from '../../api/queries';
import { useToast } from '../../components/ToastProvider';
import { Plus, UserPlus, X } from 'lucide-react';
import { TournamentPlayersModal } from './TournamentPlayersModal';
import type { Tournament } from '../../api/types';

const SEX_LABELS: Record<string, string> = { M: 'Masculino', F: 'Femenino', X: 'Mixto' };
const LIMITS = [10, 25, 50, 100];

export const TournamentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [yearFilter, setYearFilter] = useState('');
  const [sexFilter, setSexFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Tournament | null>(null);
  const [playersModalTournament, setPlayersModalTournament] = useState<Tournament | null>(null);

  const { data: tournamentsData, isLoading } = useTournaments({
    year: yearFilter ? +yearFilter : undefined,
    allowedSex: sexFilter || undefined,
    page,
    limit,
  });

  const { data: allCategories } = usePlayerCategories();

  const [form, setForm] = useState({
    name: '',
    year: new Date().getFullYear().toString(),
    allowedSex: 'M' as 'M' | 'F' | 'X',
    birthYearMin: '',
    birthYearMax: '',
    categoryIds: [] as number[],
  });
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', year: new Date().getFullYear().toString(), allowedSex: 'M', birthYearMin: '', birthYearMax: '', categoryIds: [] });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = async (id: number) => {
    try {
      const res = await apiClient.get<Tournament>(`/tournaments/${id}`);
      const t = res.data;
      setEditingId(id);
      setForm({
        name: t.name,
        year: t.year.toString(),
        allowedSex: t.allowedSex,
        birthYearMin: t.birthYearMin?.toString() ?? '',
        birthYearMax: t.birthYearMax?.toString() ?? '',
        categoryIds: (t.categories ?? []).map((c) => c.id),
      });
      setFormError(null);
      setModalOpen(true);
    } catch (err: any) {
      pushToast('Error al cargar torneo', 'error');
    }
  };

  const handleSave = async () => {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        year: +form.year,
        allowedSex: form.allowedSex,
        categoryIds: form.categoryIds,
      };
      if (form.birthYearMin) payload.birthYearMin = +form.birthYearMin;
      if (form.birthYearMax) payload.birthYearMax = +form.birthYearMax;

      if (editingId) {
        await apiClient.put(`/tournaments/${editingId}`, payload);
        pushToast('Torneo actualizado', 'success');
      } else {
        await apiClient.post('/tournaments', payload);
        pushToast('Torneo creado', 'success');
      }
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setModalOpen(false);
    } catch (err: any) {
      setFormError(normalizeApiError(err) || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await apiClient.delete(`/tournaments/${deleteConfirm.id}`);
      pushToast('Torneo eliminado', 'success');
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setDeleteConfirm(null);
    } catch (err: any) {
      pushToast(normalizeApiError(err) || 'Error al eliminar', 'error');
    }
  };

  const toggleCategory = (id: number) => {
    setForm((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id)
        ? prev.categoryIds.filter((c) => c !== id)
        : [...prev.categoryIds, id],
    }));
  };

  const totalPages = Math.ceil((tournamentsData?.total ?? 0) / limit);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>Torneos</h2>
      </div>

      <div className="admin-filters">
        <select value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}>
          <option value="">Todos los años</option>
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select value={sexFilter} onChange={(e) => { setSexFilter(e.target.value); setPage(1); }}>
          <option value="">Todos los sexos</option>
          <option value="M">Masculino</option>
          <option value="F">Femenino</option>
          <option value="X">Mixto</option>
        </select>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Año</th>
              <th>Sexo permitido</th>
              <th>Categorías</th>
              <th>Jugadores</th>
              <th style={{ width: '200px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center' }}>Cargando...</td></tr>
            ) : (tournamentsData?.data ?? []).length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center' }}>No hay torneos configurados</td></tr>
            ) : (
              (tournamentsData?.data ?? []).map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.year}</td>
                  <td>{SEX_LABELS[t.allowedSex] ?? t.allowedSex}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {(t.categories ?? []).map((c) => (
                        <span key={c.id} className="badge" style={{ background: 'var(--color-blue-bg)', color: 'var(--color-blue-text)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{t.playerCount ?? 0}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(t.id)}>Editar</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => setPlayersModalTournament(t)} title="Gestionar jugadores">
                        <UserPlus size={14} /> Jugadores
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(t)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-pagination">
        <span>Mostrando {tournamentsData?.data?.length ?? 0} de {tournamentsData?.total ?? 0}</span>
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          <select value={limit} onChange={(e) => { setLimit(+e.target.value); setPage(1); }}>
            {LIMITS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <span>Pág {page} de {totalPages || 1}</span>
          <button className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</button>
        </div>
      </div>

      <button className="fab" onClick={openCreate} title="Agregar torneo">
        <Plus size={24} />
      </button>

      {/* Modal crear/editar */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar torneo' : 'Nuevo torneo'}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {formError && <p className="form-error">{formError}</p>}
              <div className="form-group">
                <label>Nombre</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='Ej: "Sábados (M)"' />
              </div>
              <div className="form-row" style={{ display: 'flex', gap: '0.5rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Año</label>
                  <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Sexo permitido</label>
                  <select value={form.allowedSex} onChange={(e) => setForm({ ...form, allowedSex: e.target.value as 'M' | 'F' | 'X' })}>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="X">Mixto</option>
                  </select>
                </div>
              </div>
              <div className="form-row" style={{ display: 'flex', gap: '0.5rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Año de nacimiento mínimo</label>
                  <input type="number" value={form.birthYearMin} onChange={(e) => setForm({ ...form, birthYearMin: e.target.value })} placeholder="Opcional" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Año de nacimiento máximo</label>
                  <input type="number" value={form.birthYearMax} onChange={(e) => setForm({ ...form, birthYearMax: e.target.value })} placeholder="Opcional" />
                </div>
              </div>
              <div className="form-group">
                <label>Categorías habilitadas</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                  {(allCategories ?? []).map((cat) => (
                    <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.categoryIds.includes(cat.id)}
                        onChange={() => toggleCategory(cat.id)}
                      />
                      {cat.name}
                    </label>
                  ))}
                  {(allCategories ?? []).length === 0 && (
                    <span style={{ color: 'var(--color-text-faint)' }}>No hay categorías configuradas</span>
                  )}
                </div>
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
              <h3>Eliminar torneo</h3>
            </div>
            <div className="modal-body">
              <p>¿Eliminar el torneo "{deleteConfirm.name}" ({deleteConfirm.year})?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de gestión de jugadores */}
      {playersModalTournament && (
        <TournamentPlayersModal
          tournament={playersModalTournament}
          onClose={() => {
            setPlayersModalTournament(null);
            queryClient.invalidateQueries({ queryKey: ['tournaments'] });
          }}
        />
      )}
    </div>
  );
};
