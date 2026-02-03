import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useUsers } from '../api/queries';
import type { Role, User } from '../api/types';

const roleOptions: Role[] = ['ADMIN', 'USER'];

export const AdminUsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: users } = useUsers();
  const [error, setError] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER' as Role,
    externalPosId: '',
    externalStoreId: '',
  });
  const [edits, setEdits] = useState<Record<string, Partial<User> & { password?: string }>>({});

  const handleCreate = async () => {
    setError(null);
    try {
      await apiClient.post('/users', {
        name: newUser.name,
        email: newUser.email || undefined,
        password: newUser.password,
        role: newUser.role,
        externalPosId: newUser.externalPosId || undefined,
        externalStoreId: newUser.externalStoreId || undefined,
      });
      setNewUser({ name: '', email: '', password: '', role: 'USER', externalPosId: '', externalStoreId: '' });
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handleUpdate = async (userId: string) => {
    setError(null);
    try {
      await apiClient.patch(`/users/${userId}`, edits[userId]);
      setEdits((prev) => ({ ...prev, [userId]: {} }));
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const rendered = useMemo(() => users ?? [], [users]);

  return (
    <section className="card">
      <h2>Usuarios</h2>
      <div className="form-grid">
        <input
          type="text"
          placeholder="Nombre"
          value={newUser.name}
          onChange={(event) => setNewUser({ ...newUser, name: event.target.value })}
        />
        <input
          type="email"
          placeholder="Email"
          value={newUser.email}
          onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={newUser.password}
          inputMode="numeric"
          pattern="[0-9]*"
          onChange={(event) =>
            setNewUser({ ...newUser, password: event.target.value.replace(/\D/g, '') })
          }
        />
        <select
          value={newUser.role}
          onChange={(event) => setNewUser({ ...newUser, role: event.target.value as Role })}
        >
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="externalPosId"
          value={newUser.externalPosId}
          onChange={(event) => setNewUser({ ...newUser, externalPosId: event.target.value })}
        />
        <input
          type="text"
          placeholder="externalStoreId"
          value={newUser.externalStoreId}
          onChange={(event) => setNewUser({ ...newUser, externalStoreId: event.target.value })}
        />
        <button type="button" className="primary-button" onClick={handleCreate}>
          Crear usuario
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="table">
        {rendered.map((user) => {
          const draft = edits[user.id] ?? {};
          return (
            <div key={user.id} className="table-row">
              <input
                type="text"
                value={draft.name ?? user.name}
                onChange={(event) =>
                  setEdits((prev) => ({
                    ...prev,
                    [user.id]: { ...draft, name: event.target.value },
                  }))
                }
              />
              <select
                value={draft.role ?? user.role}
                onChange={(event) =>
                  setEdits((prev) => ({
                    ...prev,
                    [user.id]: { ...draft, role: event.target.value as Role },
                  }))
                }
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={draft.active ?? user.active ?? true}
                  onChange={(event) =>
                    setEdits((prev) => ({
                      ...prev,
                      [user.id]: { ...draft, active: event.target.checked },
                    }))
                  }
                />
                Activo
              </label>
              <input
                type="password"
                placeholder="Nueva clave"
                inputMode="numeric"
                pattern="[0-9]*"
                onChange={(event) => {
                  const numericPassword = event.target.value.replace(/\D/g, '');
                  setEdits((prev) => ({
                    ...prev,
                    [user.id]: { ...draft, password: numericPassword },
                  }));
                }}
              />
              <input
                type="text"
                value={draft.externalPosId ?? user.externalPosId ?? ''}
                placeholder="externalPosId"
                onChange={(event) =>
                  setEdits((prev) => ({
                    ...prev,
                    [user.id]: { ...draft, externalPosId: event.target.value },
                  }))
                }
              />
              <input
                type="text"
                value={draft.externalStoreId ?? user.externalStoreId ?? ''}
                placeholder="externalStoreId"
                onChange={(event) =>
                  setEdits((prev) => ({
                    ...prev,
                    [user.id]: { ...draft, externalStoreId: event.target.value },
                  }))
                }
              />
              <button type="button" className="secondary-button" onClick={() => handleUpdate(user.id)}>
                Guardar
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
