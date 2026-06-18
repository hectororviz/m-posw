import { useState } from 'react';
import { X } from 'lucide-react';
import { useLigasConfigs, useLigasCreateConfig, useLigasDeleteConfig, useLigasLeagues, useLigasTeams } from '../api/queries';

export const LigasConfigPage: React.FC = () => {
  const { data: configs, isLoading: configsLoading } = useLigasConfigs();
  const { data: leagues, isLoading: leaguesLoading } = useLigasLeagues();

  const [selectedLeagueId, setSelectedLeagueId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');

  const { data: teams, isLoading: teamsLoading } = useLigasTeams(
    selectedLeagueId || undefined,
  );

  const createConfig = useLigasCreateConfig();
  const deleteConfig = useLigasDeleteConfig();

  const selectedLeague = leagues?.find((l) => l.id === selectedLeagueId);
  const selectedTeam = teams?.find((t) => t.id === selectedTeamId);

  const handleAdd = async () => {
    if (!selectedLeague || !selectedTeam) return;
    await createConfig.mutateAsync({
      leagueId: selectedLeague.id,
      leagueName: selectedLeague.name,
      teamId: selectedTeam.id,
      teamName: selectedTeam.name,
    });
    setSelectedLeagueId('');
    setSelectedTeamId('');
  };

  return (
    <div>
      <h2>Torneos asociados</h2>

      {configsLoading ? (
        <div className="spinner" />
      ) : configs && configs.length > 0 ? (
        <div className="sales-table-wrapper" style={{ marginBottom: '2rem' }}>
          <div className="sales-table">
            <div className="sales-table-head">
              <span className="col-product">Liga</span>
              <span className="col-category">Equipo</span>
              <span className="col-action"></span>
            </div>
            {configs.map((cfg) => (
              <div key={cfg.id} className="sales-table-row">
                <span className="col-product">{cfg.leagueName}</span>
                <span className="col-category">{cfg.teamName}</span>
                <span className="col-action">
                  <button
                    className="btn-ghost btn-sm"
                    title="Eliminar asociación"
                    onClick={() => deleteConfig.mutate(cfg.id)}
                  >
                    <X size={14} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-muted" style={{ marginBottom: '2rem' }}>
          No hay torneos asociados. Agregá uno abajo.
        </p>
      )}

      <h3 style={{ marginBottom: '0.75rem' }}>Agregar torneo</h3>
      <div className="sales-filters" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <select
          value={selectedLeagueId}
          onChange={(e) => {
            setSelectedLeagueId(e.target.value);
            setSelectedTeamId('');
          }}
          disabled={leaguesLoading}
        >
          <option value="">
            {leaguesLoading ? 'Cargando ligas...' : 'Seleccionar liga'}
          </option>
          {leagues?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <select
          value={selectedTeamId}
          onChange={(e) => setSelectedTeamId(e.target.value)}
          disabled={!selectedLeagueId || teamsLoading}
        >
          <option value="">
            {!selectedLeagueId
              ? 'Primero elegí una liga'
              : teamsLoading
                ? 'Cargando equipos...'
                : 'Seleccionar equipo'}
          </option>
          {teams?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <button
          className="btn-primary"
          disabled={!selectedLeagueId || !selectedTeamId || createConfig.isPending}
          onClick={handleAdd}
        >
          {createConfig.isPending ? 'Agregando...' : 'Agregar'}
        </button>
      </div>

      {createConfig.isError && (
        <p className="text-danger" style={{ marginTop: '0.5rem' }}>
          Error al agregar: {String(createConfig.error)}
        </p>
      )}
    </div>
  );
};
