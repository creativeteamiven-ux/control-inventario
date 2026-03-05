import { useAuth } from './useAuth';

export function usePermissions() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];

  const hasPermission = (key: string) => permissions.includes(key);
  const canViewCost = () => hasPermission('sensitive.view_cost');

  return { permissions, hasPermission, canViewCost };
}
