import { useMemo, useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useUsers } from '../api/queries';
import type { ModuleAccess, ModuleKey, ModulePermission, User } from '../api/types';

const ALL_MODULES: { key: ModuleKey; label: string }[] = [
  { key: 'POS', label: 'POS' },
  { key: 'VENTAS', label: 'Ventas' },
  { key: 'REPORTES', label: 'Estadisticas' },
  { key: 'PRODUCTOS', label: 'Categorias / Productos / Stock' },
  { key: 'ACREEDORES', label: 'Acreedores' },
  { key: 'SOCIOS', label: 'Socios' },
  { key: 'TESORERIA', label: 'Tesorería' },
  { key: 'PATRIMONIO', label: 'Patrimonio' },
  { key: 'LIGAS', label: 'Ligas' },
  { key: 'PLAYERS', label: 'Jugadores' },
  { key: 'INTERNET', label: 'Internet' },
  { key: 'CONFIGURACION', label: 'Usuarios / Configuración' },
];

const accessOptions: { value: ModuleAccess; label: string }[] = [
  { value: 'HIDDEN', label: 'Oculto' },
  { value: 'READ', label: 'Lectura' },
  { value: 'FULL', label: 'Total' },
];

const emptyForm = { username: '', password: '' };
const defaultPermissions = (): ModulePermission[] =>
  ALL_MODULES.filter((m) => m.key === 'POS').map((m) => ({ module: m.key, access: 'HIDDEN' as ModuleAccess }));

export const AdminUsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: users } = useUsers();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [permissions, setPermissions] = useState<ModulePermission[]>(defaultPermissions);
  const [homeModule, setHomeModule] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const rendered = useMemo(() => users ?? [], [users]);

  const getPermAccess = (module: ModuleKey): ModuleAccess =>
    permissions.find((p) => p.module === module)?.access ?? 'HIDDEN';

  const setPermAccess = (module: ModuleKey, access: ModuleAccess) => {
    if (module === 'POS' && access === 'READ') return;
    setPermissions((prev) => {
      const rest = prev.filter((p) => p.module !== module);
      if (access === 'HIDDEN') return rest;
      return [...rest, { module, access }];
    });
  };

  const openCreate = () => {
    setModalMode('create');
    setEditingUser(null);
    setForm(emptyForm);
    setPermissions(defaultPermissions());
    setHomeModule('');
    setError(null);
    setSuccess(null);
  };

  const openEdit = (user: User) => {
    setModalMode('edit');
    setEditingUser(user);
    setForm({ username: user.username, password: '' });
    setPermissions(user.permissions ?? defaultPermissions());
    setHomeModule(user.homeModule ?? '');
    setError(null);
    setSuccess(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingUser(null);
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    try {
      if (modalMode === 'create') {
        await apiClient.post('/users', {
          username: form.username,
          password: form.password,
          homeModule: homeModule || undefined,
          permissions,
        });
        setSuccess('Usuario creado exitosamente');
      } else if (editingUser) {
        const payload: Record<string, unknown> = {
          username: form.username,
          homeModule: homeModule || undefined,
          permissions,
        };
        if (form.password) payload.password = form.password;
        await apiClient.patch(`/users/${editingUser.id}`, payload);
        setSuccess('Usuario actualizado exitosamente');
      }
      closeModal();
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handleDelete = async (user: User) => {
    setError(null);
    setSuccess(null);
    setDeletingId(user.id);
    try {
      await apiClient.delete(`/users/${user.id}`);
      setSuccess(`Usuario "${user.username}" eliminado`);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setDeletingId(null);
    }
  };

  const getHomeLabel = (key?: string | null) => {
    if (!key) return 'Genérico';
    return ALL_MODULES.find((m) => m.key === key)?.label ?? key;
  };

  return (
    <section className="card admin-users-page">
      <h2>Usuarios</h2>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      {rendered.length === 0 ? (
        <p className="text-muted">No hay usuarios registrados.</p>
      ) : (
        <table className="users-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Home</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rendered.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>
                  <span className={`badge ${user.role === 'ADMIN' ? 'badge-info' : 'badge-neutral'}`}>
                    {user.role === 'ADMIN' ? 'Admin' : 'Caja'}
                  </span>
                </td>
                <td>{getHomeLabel(user.homeModule)}</td>
                <td className="users-table-actions">
                  {user.role !== 'ADMIN' && (
                    <>
                      <button type="button" className="btn-ghost" onClick={() => openEdit(user)} title="Editar">{<Pencil size={16} />}</button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => handleDelete(user)}
                        disabled={deletingId === user.id}
                        style={{ color: 'var(--color-danger-text)' }}
                        title="Eliminar"
                      >
                        {deletingId === user.id ? '...' : <X size={16} />}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button type="button" className="fab-button-v2" onClick={openCreate} aria-label="Nuevo usuario" title="Nuevo usuario"><Plus size={24} /></button>

      {modalMode && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalMode === 'create' ? 'Nuevo usuario' : 'Editar usuario'}</h3>
              <button type="button" className="icon-button" onClick={closeModal} aria-label="Cerrar">{<X size={16} />}</button>
            </div>
            <div className="modal-body">
              <div className="user-modal-fields">
                <div className="settings-field">
                  <label htmlFor="user-username">Usuario</label>
                  <input
                    id="user-username"
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="Nombre de usuario"
                    autoComplete="off"
                  />
                </div>
                <div className="settings-field">
                  <label htmlFor="user-password">
                    {modalMode === 'create' ? 'Contraseña' : 'Nueva clave (dejar vacío para no cambiar)'}
                  </label>
                  <input
                    id="user-password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={modalMode === 'create' ? 'Contraseña' : 'Opcional'}
                    autoComplete="new-password"
                  />
                </div>
                <div className="settings-field">
                  <label htmlFor="user-home">Home</label>
                  <select
                    id="user-home"
                    value={homeModule}
                    onChange={(e) => setHomeModule(e.target.value)}
                  >
                    <option value="">Home genérico</option>
                    {ALL_MODULES.map((m) => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="user-modal-perms">
                <h4 style={{ margin: '0 0 0.75rem' }}>Permisos</h4>
                <table className="perms-table">
                  <thead>
                    <tr>
                      <th>Módulo</th>
                      {accessOptions.map((o) => (
                        <th key={o.value} className="perms-col-header">{o.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_MODULES.map((mod) => {
                      const cur = getPermAccess(mod.key);
                      const isPos = mod.key === 'POS';
                      return (
                        <tr key={mod.key}>
                          <td className="perms-module-label">{mod.label}</td>
                          {accessOptions.map((o) => {
                            const disabled = isPos && o.value === 'READ';
                            return (
                              <td key={o.value} className="perms-radio-cell">
                                <label className={`radio-btn ${disabled ? 'radio-btn--disabled' : ''}`}>
                                  <input
                                    type="radio"
                                    name={`perm-${mod.key}`}
                                    value={o.value}
                                    checked={cur === o.value}
                                    onChange={() => setPermAccess(mod.key, o.value)}
                                    disabled={disabled}
                                  />
                                  <span className="radio-btn-circle" />
                                </label>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="modal-footer" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={closeModal}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={!form.username || (modalMode === 'create' && !form.password)}
                >
                  {modalMode === 'create' ? 'Crear' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
