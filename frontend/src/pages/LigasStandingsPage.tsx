import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { LigaProximoPartido, LigaResultado } from '../api/types';
import { useLigasCategories, useLigasConfigs, useLigasNextMatches, useLigasResults, useLigasStandings } from '../api/queries';

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

  const { data: nextMatches } = useLigasNextMatches(config?.teamId, config?.leagueId);

  const { data: results } = useLigasResults(config?.teamId, config?.leagueId, categoryId || undefined);

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

      {results && results.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>
            Resultados de {config.teamName}
          </h3>
          <div className="sales-table-wrapper">
            <div className="sales-table">
              <div className="sales-table-head">
                <span className="col-date">Fecha</span>
                <span className="col-product">Jornada</span>
                <span className="col-category">Local</span>
                <span className="col-num">Resultado</span>
                <span className="col-category">Visitante</span>
              </div>
              {results.map((r) => {
                const resultBadge = r.localGoals != null && r.awayGoals != null
                  ? { letter: r.isWon ? 'G' : r.isDraw ? 'E' : 'P', color: r.isWon ? '#16a34a' : r.isDraw ? '#ca8a04' : '#dc2626' }
                  : null;
                return (
                  <div key={r.id} className="sales-table-row ligas-row-highlight">
                    <span className="col-date">{formatDate(r.match_date)}</span>
                    <span className="col-product">
                      {r.matchday != null ? `Jornada ${r.matchday}` : '—'}
                    </span>
                    <span className="col-category">{r.localName}</span>
                    <span className="col-num" style={{ fontWeight: 600 }}>
                      {r.localGoals != null && r.awayGoals != null
                        ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              background: resultBadge!.color + '1a',
                              color: resultBadge!.color,
                              padding: '1px 8px',
                              borderRadius: 6,
                              fontSize: '0.85rem',
                              fontWeight: 700,
                            }}
                          >
                            {r.localGoals} - {r.awayGoals}
                            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{resultBadge!.letter}</span>
                          </span>
                        )
                        : '—'}
                    </span>
                    <span className="col-category">{r.awayName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {(() => {
          if (!nextMatches || nextMatches.length === 0) return null;

          const groupKey = (m: LigaProximoPartido) =>
            `${m.matchday ?? 'null'}|${m.match_date ?? 'null'}`;

          const upcoming = nextMatches.filter((m) => !m.isPast);
          const past = nextMatches.filter((m) => m.isPast);

          const renderTable = (matches: LigaProximoPartido[], title: string, subtitle?: string) => (
            <div style={{ marginTop: '2rem' }} key={title}>
              <h3 style={{ marginBottom: '0.25rem' }}>{title}</h3>
              {subtitle && (
                <p className="text-muted" style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                  {subtitle}
                </p>
              )}
              <div className="sales-table-wrapper">
                <div className="sales-table">
                  <div className="sales-table-head">
                    <span className="col-date">Fecha</span>
                    <span className="col-product">Jornada</span>
                    <span className="col-category">Rival</span>
                    <span className="col-num">Localía</span>
                  </div>
                  {matches.map((m, i) => {
                    const prev = i > 0 ? matches[i - 1] : null;
                    const sameGroup = prev && groupKey(m) === groupKey(prev);
                    return (
                      <div key={m.id} className="sales-table-row">
                        <span className="col-date">
                          {sameGroup ? '' : formatDate(m.match_date)}
                        </span>
                        <span className="col-product">
                          {sameGroup
                            ? ''
                            : m.matchday != null
                              ? `Jornada ${m.matchday}`
                              : '—'}
                        </span>
                        <span className="col-category">{m.opponentName}</span>
                        <span className="col-num">
                          {m.isLocal ? 'Local' : 'Visitante'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );

          return (
            <>
              {upcoming.length > 0
                ? renderTable(upcoming, `Próximos partidos de ${config.teamName}`)
                : null}
              {past.length > 0
                ? renderTable(
                    past,
                    `Partidos pendientes (fechas anteriores)`,
                    'Estos partidos aún figuran como pendientes en el sistema; sus fechas ya pasaron pero el estado no se actualizó.',
                  )
                : null}
              {upcoming.length === 0 && past.length === 0 && (
                <div style={{ marginTop: '2rem' }}>
                  <h3 style={{ marginBottom: '0.75rem' }}>Próximos partidos</h3>
                  <p className="text-muted">No hay partidos pendientes para {config.teamName}</p>
                </div>
              )}
            </>
          );
        })()}
    </div>
  );
};
