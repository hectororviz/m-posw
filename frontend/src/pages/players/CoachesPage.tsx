import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../../api/client';
import { useCoaches, useCoach, useTournaments } from '../../api/queries';
import { useToast } from '../../components/ToastProvider';
import { Download, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import type { Coach as CoachType, Tournament } from '../../api/types';

const LIMITS = [10, 25, 50, 100];

export const CoachesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CoachType | null>(null);
  const [saving, setSaving] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | ''>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');

  const [form, setForm] = useState({
    firstName: '', lastName: '', dni: '', birthDate: '', phone: '', email: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: coachesData, isLoading } = useCoaches({ search: search || undefined, page, limit });
  const { data: editingCoach } = useCoach(editingId ?? undefined);
  const { data: allTournaments } = useTournaments({});

  useEffect(() => {
    if (editingCoach && editingId) {
      setForm({
        firstName: editingCoach.firstName,
        lastName: editingCoach.lastName,
        dni: editingCoach.dni ?? '',
        birthDate: editingCoach.birthDate?.slice(0, 10) ?? '',
        phone: editingCoach.phone ?? '',
        email: editingCoach.email ?? '',
      });
    }
  }, [editingCoach, editingId]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ firstName: '', lastName: '', dni: '', birthDate: '', phone: '', email: '' });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (id: number) => { setEditingId(id); setFormError(null); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const handleSave = async () => {
    setFormError(null);
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError('Completá los campos obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      };
      if (form.dni.trim()) payload.dni = form.dni.trim();
      if (form.birthDate) payload.birthDate = new Date(form.birthDate).toISOString();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.email.trim()) payload.email = form.email.trim();

      if (editingId) {
        await apiClient.put(`/coaches/${editingId}`, payload);
        pushToast('DT actualizado', 'success');
      } else {
        await apiClient.post('/coaches', payload);
        pushToast('DT creado', 'success');
      }
      queryClient.invalidateQueries({ queryKey: ['coaches'] });
      queryClient.invalidateQueries({ queryKey: ['players-dashboard'] });
      setModalOpen(false);
    } catch (err: any) {
      const msg = normalizeApiError(err);
      setFormError(typeof msg === 'string' ? msg : 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await apiClient.delete(`/coaches/${deleteConfirm.id}`);
      pushToast('DT eliminado', 'success');
      queryClient.invalidateQueries({ queryKey: ['coaches'] });
      queryClient.invalidateQueries({ queryKey: ['players-dashboard'] });
      setDeleteConfirm(null);
    } catch (err: any) { pushToast(normalizeApiError(err) || 'Error al eliminar', 'error'); }
  };

  const handleDownloadReport = () => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    const token = localStorage.getItem('authToken');
    const params = new URLSearchParams();
    if (selectedTournamentId) params.set('tournamentId', String(selectedTournamentId));
    if (selectedCategoryId) params.set('categoryId', String(selectedCategoryId));
    const url = `${baseUrl}/coaches/report?${params.toString()}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((resp) => {
        if (!resp.ok) throw new Error('Error al generar informe');
        return resp.blob();
      })
      .then((blob) => window.open(URL.createObjectURL(blob), '_blank'))
      .catch(() => pushToast('Error al generar el informe PDF', 'error'));
  };

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('es-AR') : '—';
  const totalPages = Math.ceil((coachesData?.total ?? 0) / limit);

  const tournaments = (allTournaments as any)?.data ?? (allTournaments as Tournament[] | undefined) ?? [];
  const selectedTournament = Array.isArray(tournaments)
    ? tournaments.find((t: any) => t.id === selectedTournamentId)
    : null;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>Directores Técnicos</h2>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="search-box" style={{ minWidth: '240px' }}>
            <Search size={16} />
            <input type="text" placeholder="Buscar..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-ghost" onClick={() => setReportModal(true)} title="Descargar informe PDF">
            <Download size={16} /> Informe
          </button>
        </div>
      </div>

      <div className="sales-table-wrapper" style={{ marginBottom: '1rem' }}>
        <div className="sales-table">
          <div className="sales-table-head">
            <span className="col-user" style={{ flex: 1 }}>Apellido</span>
            <span className="col-user" style={{ flex: 1 }}>Nombre</span>
            <span className="col-method" style={{ flex: '0 0 100px' }}>DNI</span>
            <span className="col-date" style={{ flex: '0 0 130px' }}>F. Nacimiento</span>
            <span className="col-method" style={{ flex: '0 0 110px' }}>Teléfono</span>
            <span className="col-num" style={{ flex: '0 0 70px' }}>Torneos</span>
            <span className="col-action" style={{ flex: '0 0 60px', textAlign: 'right' }}></span>
          </div>
          {isLoading ? (
            <div className="sales-table-row"><span style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Cargando...</span></div>
          ) : (coachesData?.data ?? []).length === 0 ? (
            <div className="sales-table-row"><span style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No se encontraron DTs</span></div>
          ) : (
            (coachesData?.data ?? []).map((c) => (
              <div key={c.id} className="sales-table-row">
                <span className="col-user" style={{ flex: 1, fontWeight: 500 }}>{c.lastName}</span>
                <span className="col-user" style={{ flex: 1 }}>{c.firstName}</span>
                <span className="col-method" style={{ flex: '0 0 100px' }}>{c.dni}</span>
                <span className="col-date" style={{ flex: '0 0 130px' }}>{formatDate(c.birthDate || '')}</span>
                <span className="col-method" style={{ flex: '0 0 110px' }}>{c.phone || '—'}</span>
                <span className="col-num" style={{ flex: '0 0 70px', textAlign: 'center' }}>{c.tournamentCount ?? 0}</span>
                <span className="col-action" style={{ flex: '0 0 60px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                  <button className="btn-ghost" onClick={() => openEdit(c.id)} title="Editar" style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem' }}><Pencil size={14} /></button>
                  <button className="btn-ghost" onClick={() => setDeleteConfirm(c)} title="Eliminar" style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
        <span>Mostrando {coachesData?.data?.length ?? 0} de {coachesData?.total ?? 0}</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select value={limit} onChange={(e) => { setLimit(+e.target.value); setPage(1); }} style={{ padding: '0.3rem 0.5rem', borderRadius: '0.4rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.8rem' }}>
            {LIMITS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}>Anterior</button>
          <span>Pág {page} de {totalPages || 1}</span>
          <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}>Siguiente</button>
        </div>
      </div>

      <button type="button" className="fab-button-v2" onClick={openCreate} aria-label="Nuevo DT" title="Nuevo DT">
        <Plus size={24} />
      </button>

      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar DT' : 'Nuevo DT'}</h3>
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
                  <label>DNI</label>
                  <input type="text" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} placeholder="DNI (opcional)" />
                </div>
                <div className="settings-field">
                  <label>Fecha de Nacimiento</label>
                  <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
                </div>
                <div className="settings-field">
                  <label>Teléfono</label>
                  <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Teléfono (opcional)" />
                </div>
                <div className="settings-field">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email (opcional)" />
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
              <h3>Eliminar DT</h3>
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

      {reportModal && (
        <div className="modal-backdrop" onClick={() => setReportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Descargar Informe de Plantel</h3>
              <button className="icon-button" onClick={() => setReportModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="settings-field" style={{ marginBottom: '0.75rem' }}>
                <label>Torneo</label>
                <select
                  value={selectedTournamentId}
                  onChange={(e) => {
                    setSelectedTournamentId(e.target.value ? +e.target.value : '');
                    setSelectedCategoryId('');
                  }}
                >
                  <option value="">Seleccionar torneo...</option>
                  {Array.isArray(tournaments) && tournaments.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.year})</option>
                  ))}
                </select>
              </div>
              {selectedTournament && (
                <div className="settings-field">
                  <label>Categoría</label>
                  <select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value ? +e.target.value : '')}>
                    <option value="">Todas</option>
                    {(selectedTournament.categories ?? (selectedTournament as any)?.categories ?? []).map((cat: any) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn-ghost" onClick={() => setReportModal(false)}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={handleDownloadReport}>Descargar PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
