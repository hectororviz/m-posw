import { usePlayersDashboard } from '../../api/queries';
import { useSettings } from '../../api/queries';
import { Users, UserMinus, Trophy } from 'lucide-react';

export const PlayersDashboardPage: React.FC = () => {
  const { data: dashboard, isLoading } = usePlayersDashboard();
  const { data: settings } = useSettings();
  const storeName = settings?.storeName ?? 'm-POSw';

  if (isLoading) {
    return <div className="page-loader">Cargando...</div>;
  }

  const d = dashboard;

  return (
    <div className="home-page">
      <div className="home-header">
        <h1 className="home-title">Módulo de Jugadores</h1>
        <p className="home-subtitle">{storeName}</p>
      </div>
      <div className="home-grid">
        <div className="module-card">
          <div className="module-card-icon" style={{ background: 'var(--color-blue-bg, #dbeafe)', color: 'var(--color-blue-text, #1e40af)' }}>
            <Users size={24} />
          </div>
          <div className="module-card-body">
            <div className="module-card-value">{d?.totalPlayersRegistered ?? 0}</div>
            <div className="module-card-label">Jugadores registrados</div>
          </div>
        </div>
        <div className="module-card">
          <div className="module-card-icon" style={{ background: 'var(--color-amber-bg, #fef3c7)', color: 'var(--color-amber-text, #92400e)' }}>
            <UserMinus size={24} />
          </div>
          <div className="module-card-body">
            <div className="module-card-value">{d?.totalWithoutTournament ?? 0}</div>
            <div className="module-card-label">Sin fichar este año</div>
          </div>
        </div>
      </div>

      {d?.tournaments && d.tournaments.length > 0 && (
        <>
          <h2 style={{ margin: '1.5rem 0 0.75rem', fontSize: '1.1rem' }}>Torneos {new Date().getFullYear()}</h2>
          <div className="home-grid">
            {d.tournaments.map((t) => (
              <div key={t.id} className="module-card">
                <div className="module-card-icon" style={{ background: 'var(--color-green-bg, #dcfce7)', color: 'var(--color-green-text, #166534)' }}>
                  <Trophy size={24} />
                </div>
                <div className="module-card-body">
                  <div className="module-card-value">{t.totalPlayers}</div>
                  <div className="module-card-label">{t.name}</div>
                  {t.byCategory.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      {t.byCategory.map((c) => (
                        <span key={c.name} style={{ display: 'inline-block', marginRight: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-faint)' }}>
                          {c.name}: {c.count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
