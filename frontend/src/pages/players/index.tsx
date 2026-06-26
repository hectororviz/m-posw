import { useState } from 'react';
import { usePlayersDashboard, useTournaments } from '../../api/queries';
import { Cake, Download } from 'lucide-react';
import { useToast } from '../../components/ToastProvider';

export const PlayersDashboardPage: React.FC = () => {
  const { data: d, isLoading } = usePlayersDashboard();
  const { data: allTournaments } = useTournaments({});
  const { pushToast } = useToast();
  const [reportModal, setReportModal] = useState(false);
  const [selectedReportTournamentId, setSelectedReportTournamentId] = useState<number | ''>('');
  const [selectedReportCategoryId, setSelectedReportCategoryId] = useState<number | ''>('');

  if (isLoading) {
    return <div className="page-loader">Cargando...</div>;
  }

  const bars = d?.playersByCategory ?? [];

  const barColor = (count: number, min: number | null, max: number | null) => {
    if (min != null && max != null && max > min) {
      const ratio = Math.max(0, Math.min(1, (count - min) / (max - min)));
      const r = Math.round(220 - ratio * 200);
      const g = Math.round(38 + ratio * 182);
      return `rgb(${r},${g},38)`;
    }
    const maxCount = Math.max(1, ...bars.map((b) => b.count));
    const ratio = count / maxCount;
    const r = Math.round(220 - ratio * 200);
    const g = Math.round(38 + ratio * 182);
    return `rgb(${r},${g},38)`;
  };

  // Group bars by tournament
  const grouped = bars.reduce((acc, bar) => {
    if (!acc[bar.tournamentName]) acc[bar.tournamentName] = [];
    acc[bar.tournamentName].push(bar);
    return acc;
  }, {} as Record<string, typeof bars>);

  const formatDateLong = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
  };

  const birthdayBorderColor = (daysUntil: number) => {
    const ratio = Math.max(0, Math.min(1, (20 - daysUntil) / 20));
    const r = Math.round(22 + ratio * (220 - 22));
    const g = Math.round(163 + ratio * (38 - 163));
    const b = Math.round(74 + ratio * (38 - 74));
    return `rgb(${r},${g},${b})`;
  };

  const birthdayDisplay = (d?.upcomingBirthdays ?? []).slice(0, 10);

  const tournaments = (allTournaments as any)?.data ?? [];
  const selectedTournament = Array.isArray(tournaments)
    ? tournaments.find((t: any) => t.id === selectedReportTournamentId)
    : null;

  const handleDownloadReport = () => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    const token = localStorage.getItem('authToken');
    const params = new URLSearchParams();
    if (selectedReportTournamentId) params.set('tournamentId', String(selectedReportTournamentId));
    if (selectedReportCategoryId) params.set('categoryId', String(selectedReportCategoryId));
    const url = `${baseUrl}/coaches/report?${params.toString()}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((resp) => {
        if (!resp.ok) throw new Error('Error al generar informe');
        return resp.blob();
      })
      .then((blob) => window.open(URL.createObjectURL(blob), '_blank'))
      .catch(() => pushToast('Error al generar el informe PDF', 'error'));
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>Jugadores</h2>
        <button className="btn-ghost" onClick={() => setReportModal(true)} title="Descargar informe PDF">
          <Download size={16} /> Informe
        </button>
      </div>

      <div className="summary-cards">
        <div className="summary-card summary-card--accent">
          <span className="summary-card__label">Jugadores</span>
          <span className="summary-card__value">{d?.totalPlayers ?? 0}</span>
        </div>
        <div className="summary-card summary-card--success">
          <span className="summary-card__label">Fichados {new Date().getFullYear()}</span>
          <span className="summary-card__value">{d?.playersInTournaments ?? 0}</span>
        </div>
        <div className="summary-card summary-card--info">
          <span className="summary-card__label">Torneos</span>
          <span className="summary-card__value">{d?.totalTournaments ?? 0}</span>
        </div>
        <div className="summary-card summary-card--danger">
          <span className="summary-card__label">Categorías</span>
          <span className="summary-card__value">{d?.totalCategories ?? 0}</span>
        </div>
        <div className="summary-card summary-card--info">
          <span className="summary-card__label">DT's</span>
          <span className="summary-card__value">{(d as any)?.totalCoaches ?? 0}</span>
        </div>
      </div>

      {Object.keys(grouped).length > 0 && (
        <div className="settings-section" style={{ marginBottom: '1.5rem' }}>
          <h3 className="settings-section-header">Fichados por torneo y categoría</h3>
          {Object.entries(grouped).map(([tname, tbars]) => {
            const maxW = Math.max(1, ...tbars.map((b) => b.count));
            return (
              <div key={tname} style={{ marginTop: '1rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-body)', marginBottom: '0.5rem' }}>{tname}:</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }}>
                  {tbars.map((bar) => (
                    <div key={bar.categoryName} className="stats-bar" style={{ background: 'var(--color-surface)', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', border: '1px solid var(--color-border-light)' }}>
                      <div className="stats-bar-meta" style={{ marginTop: 0 }}>
                        <span className="stats-bar-name">{bar.categoryName}</span>
                        <span className="stats-bar-qty">{bar.count}</span>
                      </div>
                      <div className="stats-bar-track">
                        <div
                          className="stats-bar-fill"
                          style={{
                            width: `${(bar.count / maxW) * 100}%`,
                            background: barColor(bar.count, bar.tournamentMinPlayers, bar.tournamentMaxPlayers),
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(d?.upcomingBirthdays ?? []).length > 0 && (
        <div className="settings-section">
          <h3 className="settings-section-header" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Cake size={16} />
            Próximos cumpleaños
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', padding: '0.75rem 0', scrollSnapType: 'x mandatory' }}>
            {birthdayDisplay.map((p) => (
              <div
                key={p.id}
                style={{
                  flex: '0 0 160px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderLeft: `4px solid ${birthdayBorderColor(p.daysUntil)}`,
                  borderRadius: '0.75rem',
                  padding: '1rem 0.75rem',
                  scrollSnapAlign: 'start',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2, marginBottom: '0.5rem' }}>
                  {p.lastName}
                  <br />
                  {p.firstName}
                </div>
                <div style={{ fontSize: '1rem', color: '#444', lineHeight: 1.2, marginBottom: 0 }}>
                  {formatDateLong(p.birthDate)}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#444', lineHeight: 1.2, marginBottom: '1.2rem' }}>
                  ({p.daysUntil === 0 ? 'hoy' : `${p.daysUntil} dias`})
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2, marginBottom: 2 }}>
                  {p.age} años
                </div>
                <div style={{ fontSize: '0.85rem', color: '#888', lineHeight: 1.2 }}>
                  Cat.: {p.categoryName ?? '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {reportModal && (
        <div className="modal-backdrop" onClick={() => setReportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Descargar Informe de Plantel</h3>
              <button className="icon-button" onClick={() => setReportModal(false)}><Download size={16} style={{ transform: 'rotate(0deg)' }} /></button>
            </div>
            <div className="modal-body">
              <div className="settings-field" style={{ marginBottom: '0.75rem' }}>
                <label>Torneo</label>
                <select
                  value={selectedReportTournamentId}
                  onChange={(e) => {
                    setSelectedReportTournamentId(e.target.value ? +e.target.value : '');
                    setSelectedReportCategoryId('');
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
                  <select value={selectedReportCategoryId} onChange={(e) => setSelectedReportCategoryId(e.target.value ? +e.target.value : '')}>
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
