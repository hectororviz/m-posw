import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../../api/client';
import { useTournaments, usePlayerCategories } from '../../api/queries';
import { useToast } from '../../components/ToastProvider';
import { Pencil, Plus, Search, Trash2, UserPlus, X } from 'lucide-react';
import { TournamentPlayersModal } from './TournamentPlayersModal';
import type { Tournament } from '../../api/types';

const SEX_LABELS: Record<string, string> = { M: 'Masculino', F: 'Femenino', X: 'Mixto' };
const LIMITS = [10, 25, 50, 100];

export const TournamentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [yearFilter, setYearFilter] = useState('');
  const [sexFilter, setSexFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Tournament | null>(null);
  const [playersModalTournament, setPlayersModalTournament] = useState<Tournament | null>(null);

  const { data: tournamentsData, isLoading } = useTournaments({ year: yearFilter ? +yearFilter : undefined, allowedSex: sexFilter || undefined, page, limit });
  const { data: allCategories } = usePlayerCategories();
  const activeCategories = (allCategories ?? []).filter((c) => c.active !== false);

  const [form, setForm] = useState({ name: '', year: new Date().getFullYear().toString(), allowedSex: 'M' as 'M' | 'F' | 'X', birthYearMin: '', birthYearMax: '', minPlayers: '', maxPlayers: '', categoryIds: [] as number[] });
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => { setEditingId(null); setForm({ name: '', year: new Date().getFullYear().toString(), allowedSex: 'M', birthYearMin: '', birthYearMax: '', minPlayers: '', maxPlayers: '', categoryIds: [] }); setFormError(null); setModalOpen(true); };
  const openEdit = async (id: number) => {
    try { const res = await apiClient.get<Tournament>(`/tournaments/${id}`); const t = res.data; setEditingId(id); setForm({ name: t.name, year: t.year.toString(), allowedSex: t.allowedSex, birthYearMin: t.birthYearMin?.toString() ?? '', birthYearMax: t.birthYearMax?.toString() ?? '', minPlayers: t.minPlayers?.toString() ?? '', maxPlayers: t.maxPlayers?.toString() ?? '', categoryIds: (t.categories ?? []).map((c) => c.id) }); setFormError(null); setModalOpen(true); }
    catch (err: any) { pushToast('Error al cargar torneo', 'error'); }
  };
  const closeModal = () => setModalOpen(false);

  const handleSave = async () => {
    setFormError(null);
    if (!form.name.trim()) { setFormError('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const payload: any = { name: form.name.trim(), year: +form.year, allowedSex: form.allowedSex, categoryIds: form.categoryIds };
      if (form.birthYearMin) payload.birthYearMin = +form.birthYearMin;
      if (form.birthYearMax) payload.birthYearMax = +form.birthYearMax;
      if (form.minPlayers) payload.minPlayers = +form.minPlayers;
      if (form.maxPlayers) payload.maxPlayers = +form.maxPlayers;
      if (editingId) { await apiClient.put(`/tournaments/${editingId}`, payload); pushToast('Torneo actualizado', 'success'); }
      else { await apiClient.post('/tournaments', payload); pushToast('Torneo creado', 'success'); }
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setModalOpen(false);
    } catch (err: any) { setFormError(normalizeApiError(err) || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try { await apiClient.delete(`/tournaments/${deleteConfirm.id}`); pushToast('Torneo eliminado', 'success'); queryClient.invalidateQueries({ queryKey: ['tournaments'] }); setDeleteConfirm(null); }
    catch (err: any) { pushToast(normalizeApiError(err) || 'Error al eliminar', 'error'); }
  };

  const toggleCategory = (id: number) => setForm((prev) => ({ ...prev, categoryIds: prev.categoryIds.includes(id) ? prev.categoryIds.filter((c) => c !== id) : [...prev.categoryIds, id] }));
  const totalPages = Math.ceil((tournamentsData?.total ?? 0) / limit);

  return (
    <div className="admin-page">
      <div className="admin-page-header"><h2>Torneos</h2></div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <select value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}>
            <option value="">Año</option>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={sexFilter} onChange={(e) => { setSexFilter(e.target.value); setPage(1); }}>
            <option value="">Sexo</option>
            <option value="M">Masculino</option>
            <option value="F">Femenino</option>
            <option value="X">Mixto</option>
          </select>
          <div className="search-box" style={{ minWidth: '240px' }}>
            <Search size={16} />
            <input type="text" placeholder="Buscar torneo..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="sales-table-wrapper" style={{ marginBottom: '1rem' }}>
        <div className="sales-table">
          <div className="sales-table-head">
            <span className="col-user" style={{ flex: 1 }}>Nombre</span>
            <span className="col-num" style={{ flex: '0 0 60px' }}>Año</span>
            <span className="col-method" style={{ flex: '0 0 100px' }}>Sexo</span>
            <span className="col-num" style={{ flex: '0 0 80px' }}>Jugadores</span>
            <span className="col-action" style={{ flex: '0 0 110px', textAlign: 'right' }}></span>
          </div>
          {isLoading ? (
            <div className="sales-table-row"><span style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Cargando...</span></div>
          ) : (tournamentsData?.data ?? []).length === 0 ? (
            <div className="sales-table-row"><span style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No hay torneos configurados</span></div>
          ) : (
            (tournamentsData?.data ?? []).map((t) => (
              <div key={t.id} className="sales-table-row">
                <span className="col-user" style={{ flex: 1, fontWeight: 500 }}>{t.name}</span>
                <span className="col-num" style={{ flex: '0 0 60px', textAlign: 'center' }}>{t.year}</span>
                <span className="col-method" style={{ flex: '0 0 100px' }}>{SEX_LABELS[t.allowedSex] ?? t.allowedSex}</span>
                <span className="col-num" style={{ flex: '0 0 80px', textAlign: 'center' }}>{t.playerCount ?? 0}</span>
                <span className="col-action" style={{ flex: '0 0 110px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                  <button className="btn-ghost" onClick={() => openEdit(t.id)} title="Editar" style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem' }}><Pencil size={14} /></button>
                  <button className="btn-ghost" onClick={() => setPlayersModalTournament(t)} title="Gestionar jugadores" style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem' }}><UserPlus size={14} /></button>
                  <button className="btn-ghost" onClick={() => setDeleteConfirm(t)} title="Eliminar" style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
        <span>Mostrando {tournamentsData?.data?.length ?? 0} de {tournamentsData?.total ?? 0}</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select value={limit} onChange={(e) => { setLimit(+e.target.value); setPage(1); }} style={{ padding: '0.3rem 0.5rem', borderRadius: '0.4rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.8rem' }}>
            {LIMITS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}>Anterior</button>
          <span>Pág {page} de {totalPages || 1}</span>
          <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}>Siguiente</button>
        </div>
      </div>

      <button type="button" className="fab-button-v2" onClick={openCreate} aria-label="Nuevo torneo" title="Nuevo torneo">
        <Plus size={24} />
      </button>

      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar torneo' : 'Nuevo torneo'}</h3>
              <button className="icon-button" onClick={closeModal}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {formError && <p className="error-text" style={{ marginBottom: '0.75rem' }}>{formError}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="settings-field">
                  <label>Nombre</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='Ej: "Sábados (M)"' />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div className="settings-field" style={{ flex: 1 }}>
                    <label>Año</label>
                    <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
                  </div>
                  <div className="settings-field" style={{ flex: 1 }}>
                    <label>Sexo permitido</label>
                    <select value={form.allowedSex} onChange={(e) => setForm({ ...form, allowedSex: e.target.value as 'M' | 'F' | 'X' })}>
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                      <option value="X">Mixto</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div className="settings-field" style={{ flex: 1 }}>
                    <label>Año nac. mínimo</label>
                    <input type="number" value={form.birthYearMin} onChange={(e) => setForm({ ...form, birthYearMin: e.target.value })} placeholder="Opcional" />
                  </div>
                  <div className="settings-field" style={{ flex: 1 }}>
                    <label>Año nac. máximo</label>
                    <input type="number" value={form.birthYearMax} onChange={(e) => setForm({ ...form, birthYearMax: e.target.value })} placeholder="Opcional" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div className="settings-field" style={{ flex: 1 }}>
                    <label>Mín. jugadores</label>
                    <input type="number" value={form.minPlayers} onChange={(e) => setForm({ ...form, minPlayers: e.target.value })} placeholder="Para gráfico" />
                  </div>
                  <div className="settings-field" style={{ flex: 1 }}>
                    <label>Máx. jugadores</label>
                    <input type="number" value={form.maxPlayers} onChange={(e) => setForm({ ...form, maxPlayers: e.target.value })} placeholder="Para gráfico" />
                  </div>
                </div>
                <div className="settings-field">
                  <label>Categorías habilitadas</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.35rem' }}>
                    {activeCategories.map((cat) => (
                      <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input type="checkbox" checked={form.categoryIds.includes(cat.id)} onChange={() => toggleCategory(cat.id)} />{cat.name}
                      </label>
                    ))}
                    {activeCategories.length === 0 && <span style={{ color: 'var(--color-text-muted)' }}>No hay categorías activas</span>}
                  </div>
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
              <h3>Eliminar torneo</h3>
              <button className="icon-button" onClick={() => setDeleteConfirm(null)}><X size={16} /></button>
            </div>
            <div className="modal-body"><p>¿Eliminar el torneo "{deleteConfirm.name}" ({deleteConfirm.year})?</p></div>
            <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className="btn-primary" onClick={handleDelete} style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {playersModalTournament && (
        <TournamentPlayersModal tournament={playersModalTournament} onClose={() => { setPlayersModalTournament(null); queryClient.invalidateQueries({ queryKey: ['tournaments'] }); }} />
      )}
    </div>
  );
};
