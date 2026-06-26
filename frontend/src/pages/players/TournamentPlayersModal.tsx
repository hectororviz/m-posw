import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../../api/client';
import { useEligiblePlayers, useTournamentPlayers, usePlayerCategories, useTournamentCoaches, useCoaches } from '../../api/queries';
import { useToast } from '../../components/ToastProvider';
import { AlertTriangle, Search, X } from 'lucide-react';
import type { EligiblePlayer, FichadoPlayer, Tournament, TournamentCoachCategory } from '../../api/types';

interface Props { tournament: Tournament; onClose: () => void; }

export const TournamentPlayersModal: React.FC<Props> = ({ tournament, onClose }) => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [tab, setTab] = useState<'fichar' | 'fichados' | 'dts'>('fichar');
  const [searchFichar, setSearchFichar] = useState('');
  const [searchFichados, setSearchFichados] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [fichando, setFichando] = useState(false);
  const [desfichandoId, setDesfichandoId] = useState<number | null>(null);
  const [assigningCatId, setAssigningCatId] = useState<number | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<number>(0);
  const [assigningCoach, setAssigningCoach] = useState(false);

  const { data: eligible, isLoading: loadingEligible, refetch: refetchEligible } = useEligiblePlayers(tournament.id);
  const { data: fichados, isLoading: loadingFichados, refetch: refetchFichados } = useTournamentPlayers(tournament.id);
  const { data: allCategories } = usePlayerCategories();
  const { data: tournamentCoaches, refetch: refetchTournamentCoaches } = useTournamentCoaches(tournament.id);
  const { data: allCoaches } = useCoaches({});

  const categoryMap = useMemo(() => { const map = new Map<number, string>(); for (const c of allCategories ?? []) map.set(c.id, c.name); return map; }, [allCategories]);

  const eligibleFiltered = useMemo(() => {
    if (!eligible) return [];
    if (!searchFichar) return eligible.filter((p) => !p.alreadyFichado);
    const s = searchFichar.toLowerCase();
    return eligible.filter((p) => !p.alreadyFichado && (p.firstName.toLowerCase().includes(s) || p.lastName.toLowerCase().includes(s) || p.dni.includes(s)));
  }, [eligible, searchFichar]);

  const eligibleByCategory = useMemo(() => {
    const groups = new Map<number | null, EligiblePlayer[]>();
    for (const p of eligibleFiltered) { const key = p.assignedCategoryId; if (!groups.has(key)) groups.set(key, []); groups.get(key)!.push(p); }
    return Array.from(groups.entries()).sort((a, b) => { const nameA = a[0] ? categoryMap.get(a[0]) ?? '' : 'Sin categoría'; const nameB = b[0] ? categoryMap.get(b[0]) ?? '' : 'Sin categoría'; return nameA.localeCompare(nameB); });
  }, [eligibleFiltered, categoryMap]);

  const fichadosFiltered = useMemo(() => {
    if (!fichados) return [];
    if (!searchFichados) return fichados;
    const s = searchFichados.toLowerCase();
    return fichados.filter((p) => p.firstName.toLowerCase().includes(s) || p.lastName.toLowerCase().includes(s) || p.dni.includes(s));
  }, [fichados, searchFichados]);

  const fichadosByCategory = useMemo(() => {
    const groups = new Map<number, FichadoPlayer[]>();
    for (const p of fichadosFiltered) { if (!groups.has(p.playerCategoryId)) groups.set(p.playerCategoryId, []); groups.get(p.playerCategoryId)!.push(p); }
    return Array.from(groups.entries()).sort((a, b) => { const nameA = categoryMap.get(a[0]) ?? ''; const nameB = categoryMap.get(b[0]) ?? ''; return nameA.localeCompare(nameB); });
  }, [fichadosFiltered, categoryMap]);

  const togglePlayer = (id: number) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const toggleCategory = (players: EligiblePlayer[]) => setSelected((prev) => {
    const next = new Set(prev);
    const allSelected = players.every((p) => prev.has(p.id));
    for (const p of players) { if (allSelected) next.delete(p.id); else next.add(p.id); }
    return next;
  });

  const handleFichar = async () => {
    if (selected.size === 0) return;
    setFichando(true);
    try {
      const playerIds = Array.from(selected);
      const res = await apiClient.post(`/tournaments/${tournament.id}/players`, { playerIds });
      if (res.data.errores?.length > 0) pushToast(res.data.errores.join('. '), 'error');
      if (res.data.fichados > 0) pushToast(`${res.data.fichados} jugadores fichados`, 'success');
      setSelected(new Set());
      refetchEligible(); refetchFichados();
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['players-dashboard'] });
    } catch (err: any) { pushToast(normalizeApiError(err) || 'Error al fichar jugadores', 'error'); }
    finally { setFichando(false); }
  };

  const handleDesfichar = async (playerId: number) => {
    setDesfichandoId(playerId);
    try {
      await apiClient.delete(`/tournaments/${tournament.id}/players/${playerId}`);
      pushToast('Jugador desfichado', 'success');
      refetchEligible(); refetchFichados();
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['players-dashboard'] });
    } catch (err: any) { pushToast(normalizeApiError(err) || 'Error al desfichar', 'error'); }
    finally { setDesfichandoId(null); }
  };

  const handleAssignCoach = async (categoryId: number) => {
    if (!selectedCoachId) return;
    setAssigningCoach(true);
    try {
      await apiClient.post(`/tournaments/${tournament.id}/coaches`, {
        coachId: selectedCoachId,
        playerCategoryId: categoryId,
      });
      pushToast('DT asignado', 'success');
      refetchTournamentCoaches();
      setAssigningCatId(null);
      setSelectedCoachId(0);
    } catch (err: any) {
      pushToast(normalizeApiError(err) || 'Error al asignar DT', 'error');
    } finally { setAssigningCoach(false); }
  };

  const handleUnassignCoach = async (coachId: number) => {
    try {
      await apiClient.delete(`/tournaments/${tournament.id}/coaches/${coachId}`);
      pushToast('DT desfichado', 'success');
      refetchTournamentCoaches();
    } catch (err: any) {
      pushToast(normalizeApiError(err) || 'Error al desfichar DT', 'error');
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-AR');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(800px, 95%)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
        <div className="modal-header">
          <h3>Gestionar jugadores — {tournament.name} ({tournament.year})</h3>
          <button className="icon-button" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="sort-segmented" style={{ marginBottom: '1rem', width: '100%', display: 'flex' }}>
          <button type="button" className={`sort-segment ${tab === 'fichar' ? 'sort-segment--active' : ''}`} onClick={() => setTab('fichar')} style={{ flex: 1 }}>
            Fichar
          </button>
          <button type="button" className={`sort-segment ${tab === 'fichados' ? 'sort-segment--active' : ''}`} onClick={() => setTab('fichados')} style={{ flex: 1 }}>
            Fichados ({fichados?.length ?? 0})
          </button>
          <button type="button" className={`sort-segment ${tab === 'dts' ? 'sort-segment--active' : ''}`} onClick={() => setTab('dts')} style={{ flex: 1 }}>
            DT's
          </button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {tab === 'fichar' && (
            <div>
              <div className="search-box" style={{ marginBottom: '0.75rem' }}>
                <Search size={16} />
                <input type="text" placeholder="Buscar por nombre, apellido o DNI..." value={searchFichar} onChange={(e) => setSearchFichar(e.target.value)} />
              </div>

              {loadingEligible ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Cargando jugadores elegibles...</p>
              ) : eligibleByCategory.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No hay jugadores elegibles para fichar</p>
              ) : (
                eligibleByCategory.map(([catId, players]) => {
                  const catName = catId ? categoryMap.get(catId) ?? `Cat #${catId}` : 'Sin categoría';
                  const allSelected = players.every((p) => selected.has(p.id));
                  return (
                    <div key={catId ?? 'none'} style={{ marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0', borderBottom: '1px solid var(--color-border-light)', cursor: 'pointer' }} onClick={() => toggleCategory(players)}>
                        <input type="checkbox" checked={allSelected} readOnly />
                        <strong style={{ fontSize: '0.85rem', background: 'var(--color-blue-bg)', color: 'var(--color-blue-text)', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>{catName}</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{players.length} jugadores</span>
                      </div>
                      <div className="sales-table-wrapper" style={{ borderRadius: '0.5rem', marginTop: '0.25rem' }}>
                        <div className="sales-table">
                          <div className="sales-table-head">
                            <span className="col-action" style={{ flex: '0 0 30px' }}></span>
                            <span className="col-user" style={{ flex: 1 }}>Apellido</span>
                            <span className="col-user" style={{ flex: 1 }}>Nombre</span>
                            <span className="col-num" style={{ flex: '0 0 70px' }}>Año nac.</span>
                            <span className="col-method" style={{ flex: '0 0 50px' }}>Sexo</span>
                            <span className="col-action" style={{ flex: '0 0 30px' }}></span>
                          </div>
                          {players.map((p) => (
                            <div key={p.id} className="sales-table-row">
                              <span style={{ flex: '0 0 30px' }}><input type="checkbox" checked={selected.has(p.id)} onChange={() => togglePlayer(p.id)} /></span>
                              <span className="col-user" style={{ flex: 1 }}>{p.lastName}</span>
                              <span className="col-user" style={{ flex: 1 }}>{p.firstName}</span>
                              <span className="col-num" style={{ flex: '0 0 70px', textAlign: 'center' }}>{new Date(p.birthDate).getFullYear()}</span>
                              <span className="col-method" style={{ flex: '0 0 50px' }}>{p.sex === 'M' ? 'M' : 'F'}</span>
                              <span style={{ flex: '0 0 30px' }}>
                                {p.fichadoEnOtroTorneoMismoAnio && (
                                  <span title={`Ya fichado en: ${p.otroTorneoNombre}`} style={{ cursor: 'help', color: 'var(--color-amber-text)' }}>
                                    <AlertTriangle size={14} />
                                  </span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {eligibleByCategory.length > 0 && (
                <div style={{ padding: '0.5rem 0', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-primary" disabled={selected.size === 0 || fichando} onClick={handleFichar}>
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
                <input type="text" placeholder="Buscar por nombre, apellido o DNI..." value={searchFichados} onChange={(e) => setSearchFichados(e.target.value)} />
              </div>

              {loadingFichados ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Cargando jugadores fichados...</p>
              ) : fichadosByCategory.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No hay jugadores fichados en este torneo</p>
              ) : (
                fichadosByCategory.map(([catId, players]) => {
                  const catName = categoryMap.get(catId) ?? `Cat #${catId}`;
                  return (
                    <div key={catId} style={{ marginBottom: '0.75rem' }}>
                      <div style={{ padding: '0.35rem 0', borderBottom: '1px solid var(--color-border-light)' }}>
                        <strong style={{ fontSize: '0.85rem', background: 'var(--color-green-bg)', color: 'var(--color-green-text)', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>{catName}</strong>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{players.length} jugadores</span>
                      </div>
                      <div className="sales-table-wrapper" style={{ borderRadius: '0.5rem', marginTop: '0.25rem' }}>
                        <div className="sales-table">
                          <div className="sales-table-head">
                            <span className="col-user" style={{ flex: 1 }}>Apellido</span>
                            <span className="col-user" style={{ flex: 1 }}>Nombre</span>
                            <span className="col-method" style={{ flex: '0 0 100px' }}>DNI</span>
                            <span className="col-date" style={{ flex: '0 0 110px' }}>F. Nac.</span>
                            <span className="col-action" style={{ flex: '0 0 80px', textAlign: 'right' }}></span>
                          </div>
                          {players.map((p) => (
                            <div key={p.id} className="sales-table-row">
                              <span className="col-user" style={{ flex: 1 }}>{p.lastName}</span>
                              <span className="col-user" style={{ flex: 1 }}>{p.firstName}</span>
                              <span className="col-method" style={{ flex: '0 0 100px' }}>{p.dni}</span>
                              <span className="col-date" style={{ flex: '0 0 110px' }}>{formatDate(p.birthDate)}</span>
                              <span className="col-action" style={{ flex: '0 0 80px', textAlign: 'right' }}>
                                <button className="btn-ghost" disabled={desfichandoId === p.id} onClick={() => handleDesfichar(p.id)} style={{ color: 'var(--color-danger)', fontSize: '0.8rem' }}>
                                  {desfichandoId === p.id ? '...' : 'Desfichar'}
                                </button>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'dts' && (
            <div>
              {!tournamentCoaches ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Cargando...</p>
              ) : (tournamentCoaches ?? []).length === 0 ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No hay categorías en este torneo</p>
              ) : (
                (tournamentCoaches ?? []).map((tc: TournamentCoachCategory) => (
                  <div key={tc.categoryId} style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--color-surface)', borderRadius: '0.5rem', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '0.9rem', background: 'var(--color-blue-bg)', color: 'var(--color-blue-text)', padding: '0.15rem 0.6rem', borderRadius: '4px' }}>{tc.categoryName}</strong>
                    </div>

                    {tc.coach ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontWeight: 600 }}>{tc.coach.lastName}, {tc.coach.firstName}</span>
                          {tc.coach.dni && <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>DNI: {tc.coach.dni}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button className="btn-ghost" onClick={() => { setAssigningCatId(tc.categoryId); setSelectedCoachId(tc.coach!.id); }} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>Cambiar</button>
                          <button className="btn-ghost" onClick={() => handleUnassignCoach(tc.coach!.id)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', color: 'var(--color-danger)' }}>Quitar</button>
                        </div>
                      </div>
                    ) : assigningCatId === tc.categoryId ? (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select value={selectedCoachId} onChange={(e) => setSelectedCoachId(+e.target.value)} style={{ flex: 1, padding: '0.35rem 0.5rem', borderRadius: '0.4rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.85rem' }}>
                          <option value={0}>Seleccionar DT...</option>
                          {(allCoaches as any)?.data?.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.lastName}, {c.firstName}</option>
                          ))}
                        </select>
                        <button className="btn-primary" disabled={!selectedCoachId || assigningCoach} onClick={() => handleAssignCoach(tc.categoryId)} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
                          {assigningCoach ? '...' : 'Asignar'}
                        </button>
                        <button className="btn-ghost" onClick={() => { setAssigningCatId(null); setSelectedCoachId(0); }} style={{ fontSize: '0.8rem' }}>Cancelar</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Sin DT asignado</span>
                        <button className="btn-ghost" onClick={() => { setAssigningCatId(tc.categoryId); setSelectedCoachId(0); }} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>Asignar</button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
