import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { LigaMatchdayGroup, LigaMatchdayMatch } from '../api/types';
import { useLigasAllMatches, useLigasCategories, useLigasConfigs, useLigasStandings } from '../api/queries';

const sortCategories = (matches: LigaMatchdayMatch[]): LigaMatchdayMatch[] => {
  const extractNum = (name: string): number => {
    const m = name.match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  };
  return [...matches].sort((a, b) => {
    const na = extractNum(a.categoryName);
    const nb = extractNum(b.categoryName);
    if (na !== nb) return nb - na;
    return a.categoryName.localeCompare(b.categoryName);
  });
};

const ResultModal: React.FC<{
  group: LigaMatchdayGroup;
  teamName: string;
  onClose: () => void;
}> = ({ group, teamName, onClose }) => {
  const formatDate = (d: string | null) =>
    d
      ? new Date(d + 'T00:00:00').toLocaleDateString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '';

  const played = group.matches.filter((m) => m.status !== 'pendiente');
  const sorted = sortCategories(played);

  return (
    <div className="ligas-modal-overlay" onClick={onClose}>
      <div className="ligas-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ligas-modal-header">
          <h3>
            Jornada {group.matchday}
            {group.match_date ? ` — ${formatDate(group.match_date)}` : ''}
          </h3>
          <button className="ligas-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="ligas-modal-body">
          {sorted.map((m) => {
            const score =
              m.localGoals != null && m.awayGoals != null
                ? `${m.localGoals} - ${m.awayGoals}`
                : null;
            const badge = score
              ? m.isWon
                ? { letter: 'G', color: '#16a34a' }
                : m.isDraw
                  ? { letter: 'E', color: '#ca8a04' }
                  : { letter: 'P', color: '#dc2626' }
              : null;

            return (
              <div key={m.id} className="ligas-modal-result">
                <span className="ligas-modal-cat">{m.categoryName}</span>
                <span
                  className="ligas-modal-score"
                  style={badge ? { color: badge.color } : undefined}
                >
                  {group.isLocal
                    ? `${teamName} ${score || 'vs'} ${group.opponentName}`
                    : `${group.opponentName} ${score || 'vs'} ${teamName}`}
                  {badge && (
                    <span
                      style={{
                        background: badge.color + '1a',
                        padding: '1px 7px',
                        borderRadius: 6,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      {badge.letter}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const LigasStandingsPage: React.FC = () => {
  const { configId } = useParams<{ configId: string }>();
  const { data: configs } = useLigasConfigs();
  const config = configs?.find((c) => c.id === configId);

  const [categoryId, setCategoryId] = useState('');

  const {
    data: standings,
    isLoading: standingsLoading,
  } = useLigasStandings(config?.leagueId, categoryId || undefined);

  const { data: categories } = useLigasCategories(config?.leagueId);

  const { data: matchdayGroups } = useLigasAllMatches(config?.teamId, config?.leagueId);

  const [modalGroup, setModalGroup] = useState<LigaMatchdayGroup | null>(null);

  const formatDate = (d: string | null) =>
    d
      ? new Date(d + 'T00:00:00').toLocaleDateString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '—';

  if (!config) {
    return <p className="text-muted">Torneo no encontrado</p>;
  }

  const groupKey = (g: LigaMatchdayGroup) => g.match_date ?? 'null';

  return (
    <div>
      <h2>{config.leagueName}</h2>
      <p className="text-muted" style={{ marginBottom: '1rem' }}>
        Siguiendo a: <strong>{config.teamName}</strong>
      </p>

      {categories && categories.length > 0 && (
        <div className="sales-filters" style={{ marginBottom: '1rem' }}>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">General (todas las categorías)</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {standingsLoading ? (
        <div className="spinner" />
      ) : standings && standings.length > 0 ? (
        <div className="sales-table-wrapper">
          <div className="sales-table">
            <div className="sales-table-head">
              <span className="col-num">#</span>
              <span className="col-team">Equipo</span>
              <span className="col-num">PJ</span>
              <span className="col-num">PG</span>
              <span className="col-num">PE</span>
              <span className="col-num">PP</span>
              <span className="col-num">GF</span>
              <span className="col-num">GC</span>
              <span className="col-num">DG</span>
              <span className="col-num">Pts</span>
            </div>
            {standings.map((row) => (
              <div
                key={row.teamId}
                className={
                  'sales-table-row' +
                  (row.teamId === config.teamId ? ' ligas-row-highlight' : '')
                }
              >
                <span className="col-num">{row.position}</span>
                <span className="col-team">
                  {row.teamName}
                  {row.teamId === config.teamId && (
                    <span className="ligas-star"> ⭐</span>
                  )}
                </span>
                <span className="col-num">{row.pj}</span>
                <span className="col-num">{row.pg}</span>
                <span className="col-num">{row.pe}</span>
                <span className="col-num">{row.pp}</span>
                <span className="col-num">{row.gf}</span>
                <span className="col-num">{row.gc}</span>
                <span className="col-num">{row.dg}</span>
                <span className="col-num" style={{ fontWeight: 600 }}>
                  {row.pts}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-muted">No hay partidos finalizados para mostrar la tabla</p>
      )}

      {matchdayGroups && matchdayGroups.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>
            Partidos de {config.teamName}
          </h3>
          <div className="sales-table-wrapper">
            <div className="sales-table ligas-matchday-table">
              <div className="sales-table-head">
                <span className="col-date">Fecha</span>
                <span className="col-product">Jornada</span>
                <span className="col-category">Rival</span>
                <span className="col-num">Localía</span>
              </div>
              {matchdayGroups.map((g, i) => {
                const prev = i > 0 ? matchdayGroups[i - 1] : null;
                const sameDate = prev && groupKey(g) === groupKey(prev);
                const hasPlayed = g.matches.some((m) => m.status !== 'pendiente');

                return (
                  <div
                    key={g.matchday}
                    className={
                      'sales-table-row ligas-row-highlight' +
                      (hasPlayed ? ' ligas-row-clickable' : '')
                    }
                    onClick={hasPlayed ? () => setModalGroup(g) : undefined}
                    style={hasPlayed ? { cursor: 'pointer' } : undefined}
                  >
                    <span className="col-date">
                      {sameDate ? '' : formatDate(g.match_date)}
                    </span>
                    <span className="col-product">
                      {g.matchday}
                    </span>
                    <span className="col-category">{g.opponentName}</span>
                    <span className="col-num">
                      {g.isLocal ? 'Local' : 'Visitante'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {matchdayGroups && matchdayGroups.length === 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>Partidos</h3>
          <p className="text-muted">No hay partidos registrados para {config.teamName}</p>
        </div>
      )}

      {modalGroup && (
        <ResultModal
          group={modalGroup}
          teamName={config.teamName}
          onClose={() => setModalGroup(null)}
        />
      )}
    </div>
  );
};
