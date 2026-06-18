import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { LigaMatchdayGroup } from '../api/types';
import { useLigasAllMatches, useLigasCategories, useLigasConfigs, useLigasStandings } from '../api/queries';

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

  const [expandedJornada, setExpandedJornada] = useState<number | null>(null);

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

  const toggleJornada = (matchday: number) => {
    setExpandedJornada((prev) => (prev === matchday ? null : matchday));
  };

  const groupKey = (g: LigaMatchdayGroup) =>
    `${g.match_date ?? 'null'}`;

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
            <div className="sales-table">
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
                const isExpanded = expandedJornada === g.matchday;

                return (
                  <div key={g.matchday}>
                    <div
                      className={
                        'sales-table-row ligas-row-highlight' +
                        (hasPlayed ? ' ligas-row-clickable' : '')
                      }
                      onClick={hasPlayed ? () => toggleJornada(g.matchday) : undefined}
                      style={hasPlayed ? { cursor: 'pointer' } : undefined}
                    >
                      <span className="col-date">
                        {sameDate ? '' : formatDate(g.match_date)}
                      </span>
                      <span className="col-product">
                        Jornada {g.matchday}
                      </span>
                      <span className="col-category">
                        {g.opponentName}
                        {hasPlayed && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: '0.65rem',
                              color: isExpanded ? 'var(--primary)' : '#888',
                              transition: 'transform 0.2s',
                              display: 'inline-block',
                              transform: isExpanded ? 'rotate(180deg)' : undefined,
                            }}
                          >
                            ▼
                          </span>
                        )}
                      </span>
                      <span className="col-num">
                        {g.isLocal ? 'Local' : 'Visitante'}
                      </span>
                    </div>
                    {isExpanded && hasPlayed && (
                      <div className="ligas-subrows">
                        {g.matches
                          .filter((m) => m.status !== 'pendiente')
                          .map((m) => {
                            const colors = m.isWon
                              ? '#16a34a'
                              : m.isDraw
                                ? '#ca8a04'
                                : '#dc2626';
                            const letter = m.isWon ? 'G' : m.isDraw ? 'E' : 'P';
                            return (
                              <div key={m.id} className="sales-table-row">
                                <span className="col-date" />
                                <span className="col-product" style={{ fontSize: '0.85rem', color: '#888' }}>
                                  {m.categoryName}
                                </span>
                                <span />
                                <span className="col-num">
                                  {m.localGoals != null && m.awayGoals != null ? (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        background: colors + '1a',
                                        color: colors,
                                        padding: '1px 8px',
                                        borderRadius: 6,
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                      }}
                                    >
                                      {m.localGoals} - {m.awayGoals}
                                      <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                                        {letter}
                                      </span>
                                    </span>
                                  ) : (
                                    'Pendiente'
                                  )}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    )}
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
    </div>
  );
};
