import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../../api/client';
import {
  useEligiblePlayers,
  useTournamentPlayers,
  usePlayerCategories,
} from '../../api/queries';
import { useToast } from '../../components/ToastProvider';
import { AlertTriangle, Search, X } from 'lucide-react';
import type { EligiblePlayer, FichadoPlayer, Tournament } from '../../api/types';

interface Props {
  tournament: Tournament;
  onClose: () => void;
}

export const TournamentPlayersModal: React.FC<Props> = ({ tournament, onClose }) => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [tab, setTab] = useState<'fichar' | 'fichados'>('fichar');
  const [searchFichar, setSearchFichar] = useState('');
  const [searchFichados, setSearchFichados] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [fichando, setFichando] = useState(false);
  const [desfichandoId, setDesfichandoId] = useState<number | null>(null);

  const { data: eligible, isLoading: loadingEligible, refetch: refetchEligible } = useEligiblePlayers(tournament.id);
  const { data: fichados, isLoading: loadingFichados, refetch: refetchFichados } = useTournamentPlayers(tournament.id);
  const { data: allCategories } = usePlayerCategories();

  const categoryMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of allCategories ?? []) map.set(c.id, c.name);
    return map;
  }, [allCategories]);

  const eligibleFiltered = useMemo(() => {
    if (!eligible) return [];
    if (!searchFichar) return eligible.filter((p) => !p.alreadyFichado);
    const s = searchFichar.toLowerCase();
    return eligible.filter(
      (p) =>
        !p.alreadyFichado &&
        (p.firstName.toLowerCase().includes(s) ||
          p.lastName.toLowerCase().includes(s) ||
          p.dni.includes(s)),
    );
  }, [eligible, searchFichar]);

  const eligibleByCategory = useMemo(() => {
    const groups = new Map<number | null, EligiblePlayer[]>();
    for (const p of eligibleFiltered) {
      const key = p.assignedCategoryId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    const sorted = Array.from(groups.entries()).sort((a, b) => {
      const nameA = a[0] ? categoryMap.get(a[0]) ?? '' : 'Sin categoría';
      const nameB = b[0] ? categoryMap.get(b[0]) ?? '' : 'Sin categoría';
      return nameA.localeCompare(nameB);
    });
    return sorted;
  }, [eligibleFiltered, categoryMap]);

  const fichadosFiltered = useMemo(() => {
    if (!fichados) return [];
    if (!searchFichados) return fichados;
    const s = searchFichados.toLowerCase();
    return fichados.filter(
      (p) =>
        p.firstName.toLowerCase().includes(s) ||
        p.lastName.toLowerCase().includes(s) ||
        p.dni.includes(s),
    );
  }, [fichados, searchFichados]);

  const fichadosByCategory = useMemo(() => {
    const groups = new Map<number, FichadoPlayer[]>();
    for (const p of fichadosFiltered) {
      if (!groups.has(p.playerCategoryId)) groups.set(p.playerCategoryId, []);
      groups.get(p.playerCategoryId)!.push(p);
    }
    const sorted = Array.from(groups.entries()).sort((a, b) => {
      const nameA = categoryMap.get(a[0]) ?? '';
      const nameB = categoryMap.get(b[0]) ?? '';
      return nameA.localeCompare(nameB);
    });
    return sorted;
  }, [fichadosFiltered, categoryMap]);

  const togglePlayer = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCategory = (players: EligiblePlayer[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = players.every((p) => prev.has(p.id));
      for (const p of players) {
        if (allSelected) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  };

  const handleFichar = async () => {
    if (selected.size === 0) return;
    setFichando(true);
    try {
      const playerIds = Array.from(selected);
      const res = await apiClient.post(`/tournaments/${tournament.id}/players`, { playerIds });
      if (res.data.errores?.length > 0) {
        pushToast(res.data.errores.join('. '), 'error');
      }
      if (res.data.fichados > 0) {
        pushToast(`${res.data.fichados} jugadores fichados`, 'success');
      }
      setSelected(new Set());
      refetchEligible();
      refetchFichados();
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['players-dashboard'] });
    } catch (err: any) {
      pushToast(normalizeApiError(err) || 'Error al fichar jugadores', 'error');
    } finally {
      setFichando(false);
    }
  };

  const handleDesfichar = async (playerId: number) => {
    setDesfichandoId(playerId);
    try {
      await apiClient.delete(`/tournaments/${tournament.id}/players/${playerId}`);
      pushToast('Jugador desfichado', 'success');
      refetchEligible();
      refetchFichados();
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['players-dashboard'] });
    } catch (err: any) {
      pushToast(normalizeApiError(err) || 'Error al desfichar', 'error');
    } finally {
      setDesfichandoId(null);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-AR');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3>Gestionar jugadores — {tournament.name} ({tournament.year})</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '1rem' }}>
          <button
            className={`modal-tab ${tab === 'fichar' ? 'active' : ''}`}
            onClick={() => setTab('fichar')}
            style={{ padding: '0.5rem 1rem', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === 'fichar' ? 600 : 400, borderBottom: tab === 'fichar' ? '2px solid var(--color-accent)' : '2px solid transparent' }}
          >
            Fichar
          </button>
          <button
            className={`modal-tab ${tab === 'fichados' ? 'active' : ''}`}
            onClick={() => setTab('fichados')}
            style={{ padding: '0.5rem 1rem', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === 'fichados' ? 600 : 400, borderBottom: tab === 'fichados' ? '2px solid var(--color-accent)' : '2px solid transparent' }}
          >
            Fichados ({fichados?.length ?? 0})
          </button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflow: 'auto' }}>
          {tab === 'fichar' && (
            <div>
              <div className="search-box" style={{ marginBottom: '0.75rem' }}>
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Buscar por nombre, apellido o DNI..."
                  value={searchFichar}
                  onChange={(e) => setSearchFichar(e.target.value)}
                />
              </div>

              {loadingEligible ? (
                <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando jugadores elegibles...</p>
              ) : eligibleByCategory.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-faint)' }}>
                  No hay jugadores elegibles para fichar
                </p>
              ) : (
                eligibleByCategory.map(([catId, players]) => {
                  const catName = catId ? categoryMap.get(catId) ?? `Cat #${catId}` : 'Sin categoría';
                  const allSelected = players.every((p) => selected.has(p.id));
                  return (
                    <div key={catId ?? 'none'} style={{ marginBottom: '0.75rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.35rem 0',
                          borderBottom: '1px solid var(--color-border-light)',
                          cursor: 'pointer',
                        }}
                        onClick={() => toggleCategory(players)}
                      >
                        <input type="checkbox" checked={allSelected} readOnly />
                        <strong style={{ fontSize: '0.9rem', background: 'var(--color-blue-bg)', color: 'var(--color-blue-text)', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>
                          {catName}
                        </strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-faint)' }}>{players.length} jugadores</span>
                      </div>
                      <table className="admin-table" style={{ marginTop: '0.25rem' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '30px' }}></th>
                            <th>Apellido</th>
                            <th>Nombre</th>
                            <th>Año nac.</th>
                            <th>Sexo</th>
                            <th style={{ width: '30px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {players.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selected.has(p.id)}
                                  onChange={() => togglePlayer(p.id)}
                                />
                              </td>
                              <td>{p.lastName}</td>
                              <td>{p.firstName}</td>
                              <td>{new Date(p.birthDate).getFullYear()}</td>
                              <td>{p.sex === 'M' ? 'M' : 'F'}</td>
                              <td>
                                {p.fichadoEnOtroTorneoMismoAnio && (
                                  <span title={`Ya fichado en: ${p.otroTorneoNombre}`} style={{ cursor: 'help', color: 'var(--color-amber-text)' }}>
                                    <AlertTriangle size={14} />
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              )}

              {eligibleByCategory.length > 0 && (
                <div style={{ padding: '0.5rem 0', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-primary"
                    disabled={selected.size === 0 || fichando}
                    onClick={handleFichar}
                  >
                    {fichando ? 'Fichando...' : `Fichar seleccionados (${selected.size})`}
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'fichados' && (
            <div>
              <div className="search-box" style={{ marginBottom: '0.75rem' }}>
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Buscar por nombre, apellido o DNI..."
                  value={searchFichados}
                  onChange={(e) => setSearchFichados(e.target.value)}
                />
              </div>

              {loadingFichados ? (
                <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando jugadores fichados...</p>
              ) : fichadosByCategory.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-faint)' }}>
                  No hay jugadores fichados en este torneo
                </p>
              ) : (
                fichadosByCategory.map(([catId, players]) => {
                  const catName = categoryMap.get(catId) ?? `Cat #${catId}`;
                  return (
                    <div key={catId} style={{ marginBottom: '0.75rem' }}>
                      <div style={{ padding: '0.35rem 0', borderBottom: '1px solid var(--color-border-light)' }}>
                        <strong style={{ fontSize: '0.9rem', background: 'var(--color-green-bg)', color: 'var(--color-green-text)', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>
                          {catName}
                        </strong>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-faint)' }}>{players.length} jugadores</span>
                      </div>
                      <table className="admin-table" style={{ marginTop: '0.25rem' }}>
                        <thead>
                          <tr>
                            <th>Apellido</th>
                            <th>Nombre</th>
                            <th>DNI</th>
                            <th>F. Nac.</th>
                            <th style={{ width: '80px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {players.map((p) => (
                            <tr key={p.id}>
                              <td>{p.lastName}</td>
                              <td>{p.firstName}</td>
                              <td>{p.dni}</td>
                              <td>{formatDate(p.birthDate)}</td>
                              <td>
                                <button
                                  className="btn btn-sm btn-danger"
                                  disabled={desfichandoId === p.id}
                                  onClick={() => handleDesfichar(p.id)}
                                >
                                  {desfichandoId === p.id ? '...' : 'Desfichar'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
