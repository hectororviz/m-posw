import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useUsers } from '../api/queries';
import type { ModuleAccess, ModuleKey, ModulePermission, User } from '../api/types';

const ALL_MODULES: { key: ModuleKey; label: string }[] = [
  { key: 'POS', label: 'POS' },
  { key: 'SOCIOS', label: 'Socios' },
  { key: 'TESORERIA', label: 'Tesorería' },
  { key: 'ACREEDORES', label: 'Acreedores' },
  { key: 'INTERNET', label: 'Internet' },
  { key: 'STOCK', label: 'Stock' },
  { key: 'REPORTES', label: 'Reportes' },
  { key: 'CONFIGURACION', label: 'Configuración' },
];

const accessOptions: { value: ModuleAccess; label: string }[] = [
  { value: 'HIDDEN', label: 'Oculto' },
  { value: 'READ', label: 'Solo lectura' },
  { value: 'FULL', label: 'Control total' },
];

export const AdminUsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: users } = useUsers();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    homeModule: '' as string,
  });
  const [newPermissions, setNewPermissions] = useState<ModulePermission[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    username: string;
    password: string;
    homeModule: string;
  }>({ username: '', password: '', homeModule: '' });
  const [editPermissions, setEditPermissions] = useState<ModulePermission[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredUsers = useMemo(
    () => (users ?? []).filter((u) => u.role !== 'ADMIN'),
    [users],
  );

  const toggleNewPerm = (module: ModuleKey, access: ModuleAccess) => {
    if (module === 'POS' && access === 'READ') return;
    setNewPermissions((prev) => {
      const rest = prev.filter((p) => p.module !== module);
      if (access === 'HIDDEN') return rest;
      return [...rest, { module, access }];
    });
  };

  const toggleEditPerm = (module: ModuleKey, access: ModuleAccess) => {
    if (module === 'POS' && access === 'READ') return;
    setEditPermissions((prev) => {
      const rest = prev.filter((p) => p.module !== module);
      if (access === 'HIDDEN') return rest;
      return [...rest, { module, access }];
    });
  };

  const getPermAccess = (perms: ModulePermission[], module: ModuleKey): ModuleAccess =>
    perms.find((p) => p.module === module)?.access ?? 'HIDDEN';

  const handleCreate = async () => {
    setError(null);
    setSuccess(null);
    try {
      await apiClient.post('/users', {
        username: newUser.username,
        password: newUser.password,
        homeModule: newUser.homeModule || undefined,
        permissions: newPermissions,
      });
      setNewUser({ username: '', password: '', homeModule: '' });
      setNewPermissions([]);
      setSuccess('Usuario creado exitosamente');
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setEditForm({
      username: user.username,
      password: '',
      homeModule: user.homeModule ?? '',
    });
    setEditPermissions(user.permissions ?? []);
    setError(null);
    setSuccess(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ username: '', password: '', homeModule: '' });
    setEditPermissions([]);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, unknown> = {
        username: editForm.username,
        homeModule: editForm.homeModule || undefined,
        permissions: editPermissions,
      };
      if (editForm.password) {
        payload.password = editForm.password;
      }
      await apiClient.patch(`/users/${editingId}`, payload);
      setEditingId(null);
      setSuccess('Usuario actualizado exitosamente');
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

  const availableHomeModules = [
    { value: '', label: 'Home genérico' },
    ...ALL_MODULES.filter((m) => (editingId ? getPermAccess(editPermissions, m.key) : true)).map((m) => ({
      value: m.key,
      label: m.label,
    })),
  ];

  return (
    <section className="card admin-users-page">
      <h2>Usuarios</h2>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <div className="section-title">Nuevo usuario</div>
      <div className="user-create-form">
        <div className="user-create-row">
          <input
            type="text"
            placeholder="Nombre de usuario"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
          />
          <select
            value={newUser.homeModule}
            onChange={(e) => setNewUser({ ...newUser, homeModule: e.target.value })}
          >
            <option value="">Home genérico</option>
            {ALL_MODULES.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
          <button type="button" className="btn-primary" onClick={handleCreate} disabled={!newUser.username || !newUser.password}>
            Crear
          </button>
        </div>
        <div className="user-perms-grid">
          {ALL_MODULES.map((mod) => {
            const current = getPermAccess(newPermissions, mod.key);
            const opts = mod.key === 'POS'
              ? accessOptions.filter((o) => o.value !== 'READ')
              : accessOptions;
            return (
              <div key={mod.key} className="user-perm-item">
                <span className="user-perm-label">{mod.label}</span>
                <select
                  className="user-perm-select"
                  value={current}
                  onChange={(e) => toggleNewPerm(mod.key, e.target.value as ModuleAccess)}
                >
                  {opts.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section-title">Usuarios registrados</div>
      {filteredUsers.length === 0 && (
        <p className="text-muted">No hay usuarios registrados.</p>
      )}
      {filteredUsers.map((user) =>
        editingId === user.id ? (
          <div key={user.id} className="user-edit-card">
            <div className="user-edit-row">
              <input
                type="text"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                placeholder="Nombre de usuario"
              />
              <input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder="Nueva clave (dejar vacío para no cambiar)"
              />
              <select
                value={editForm.homeModule}
                onChange={(e) => setEditForm({ ...editForm, homeModule: e.target.value })}
              >
                {availableHomeModules.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <button type="button" className="btn-primary" onClick={handleUpdate}>Guardar</button>
              <button type="button" className="btn-ghost" onClick={cancelEdit}>Cancelar</button>
            </div>
            <div className="user-perms-grid">
              {ALL_MODULES.map((mod) => {
                const current = getPermAccess(editPermissions, mod.key);
                const opts = mod.key === 'POS'
                  ? accessOptions.filter((o) => o.value !== 'READ')
                  : accessOptions;
                return (
                  <div key={mod.key} className="user-perm-item">
                    <span className="user-perm-label">{mod.label}</span>
                    <select
                      className="user-perm-select"
                      value={current}
                      onChange={(e) => toggleEditPerm(mod.key, e.target.value as ModuleAccess)}
                    >
                      {opts.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div key={user.id} className="user-list-item">
            <div className="user-list-info">
              <span className="user-list-username">{user.username}</span>
              <span className="user-list-home">
                Home: {user.homeModule ? ALL_MODULES.find((m) => m.key === user.homeModule)?.label ?? user.homeModule : 'Genérico'}
              </span>
            </div>
            <div className="user-list-actions">
              <button type="button" className="btn-ghost" onClick={() => startEdit(user)}>✎</button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => handleDelete(user)}
                disabled={deletingId === user.id}
                style={{ color: 'var(--color-danger-text)' }}
              >
                {deletingId === user.id ? '...' : '✕'}
              </button>
            </div>
          </div>
        ),
      )}
    </section>
  );
};
