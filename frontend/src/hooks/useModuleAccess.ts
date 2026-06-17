import { useAuth } from '../context/AuthContext';
import type { ModuleAccess, ModuleKey } from '../api/types';

export function useModuleAccess(module: ModuleKey): ModuleAccess {
  const { user, permissions } = useAuth();

  if (user?.role === 'ADMIN') return 'FULL';

  const perm = permissions.find((p) => p.module === module);
  return perm?.access ?? 'HIDDEN';
}
