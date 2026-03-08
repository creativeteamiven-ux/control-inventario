import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users as UsersIcon, Plus, Pencil, Trash2, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import UserModal from '@/components/UserModal';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gestor',
  TECHNICIAN: 'Técnico',
  VIEWER: 'Solo lectura',
};

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions?: string[] | null;
  createdAt?: string;
}

export default function Users() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get<UserRow[]>('/api/users');
      return data;
    },
  });

  const users = data ?? [];

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar al usuario "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/api/users/${id}`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario eliminado');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al eliminar';
      toast.error(msg);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-foreground">Usuarios</h1>
        <Button onClick={() => { setEditingUser(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Crear usuario
        </Button>
      </div>
      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted">
          Cargando...
        </div>
      ) : (
        <>
          {/* Vista móvil: cards con Editar / Eliminar visibles */}
          <div className="md:hidden space-y-3">
            {users.map((u) => (
              <div
                key={u.id}
                className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{u.name}</p>
                    <p className="text-sm text-muted truncate">{u.email}</p>
                  </div>
                  <span className={cn(
                    'shrink-0 px-2 py-0.5 rounded text-xs font-medium',
                    u.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                    u.role === 'MANAGER' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                    u.role === 'TECHNICIAN' ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </div>
                {u.permissions && u.permissions.length > 0 && (
                  <p className="text-xs text-muted flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5" />
                    Permisos personalizados ({u.permissions.length})
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 min-h-touch"
                    onClick={() => { setEditingUser(u); setModalOpen(true); }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-touch text-destructive border-destructive/50 hover:bg-destructive/10"
                    onClick={() => handleDelete(u.id, u.name)}
                  >
                    <Trash2 className="h-4 w-4 md:mr-0" />
                  </Button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="bg-card rounded-xl border border-border p-8 text-center text-muted flex flex-col items-center gap-3">
                <UsersIcon className="h-12 w-12" />
                <p>No hay usuarios</p>
                <Button className="min-h-touch w-full max-w-xs" onClick={() => setModalOpen(true)}>
                  Crear primer usuario
                </Button>
              </div>
            )}
          </div>

          {/* Vista desktop: tabla */}
          <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 px-4 font-medium text-muted">Nombre</th>
                  <th className="text-left py-4 px-4 font-medium text-muted">Email</th>
                  <th className="text-left py-4 px-4 font-medium text-muted">Rol</th>
                  <th className="text-left py-4 px-4 font-medium text-muted">Permisos</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border hover:bg-card-hover/50">
                    <td className="py-3 px-4 font-medium">{u.name}</td>
                    <td className="py-3 px-4 text-muted">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        u.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                        u.role === 'MANAGER' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                        u.role === 'TECHNICIAN' ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted">
                      {u.permissions && u.permissions.length > 0 ? (
                        <span className="flex items-center gap-1" title={u.permissions.join(', ')}>
                          <Shield className="h-4 w-4" />
                          Personalizado ({u.permissions.length})
                        </span>
                      ) : (
                        'Por defecto del rol'
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => { setEditingUser(u); setModalOpen(true); }}
                          title="Editar usuario y permisos"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(u.id, u.name)}
                          title="Eliminar usuario"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="p-12 text-center text-muted flex flex-col items-center gap-2">
                <UsersIcon className="h-12 w-12" />
                <p>No hay usuarios</p>
                <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>
                  Crear primer usuario
                </Button>
              </div>
            )}
          </div>
        </>
      )}
      <UserModal
        open={modalOpen}
        onOpenChange={(open) => { if (!open) setEditingUser(null); setModalOpen(open); }}
        user={editingUser}
      />
    </motion.div>
  );
}
