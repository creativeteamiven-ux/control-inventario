import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const ROLES = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'MANAGER', label: 'Gestor' },
  { value: 'TECHNICIAN', label: 'Técnico' },
  { value: 'VIEWER', label: 'Solo lectura' },
];

interface PermissionDef {
  key: string;
  label: string;
  module: string;
  description: string;
}

interface UserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: { id: string; name: string; email: string; role: string; permissions?: string[] | null } | null;
}

export default function UserModal({ open, onOpenChange, user }: UserModalProps) {
  const isEdit = !!user;
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'VIEWER',
    permissionKeys: [] as string[],
  });

  const { data: permissionsList = [] } = useQuery({
    queryKey: ['user-permissions'],
    queryFn: async () => {
      const { data } = await api.get<PermissionDef[]>('/api/users/permissions');
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role,
        permissionKeys: Array.isArray(user.permissions) ? user.permissions : [],
      });
    } else {
      setForm({
        name: '',
        email: '',
        password: '',
        role: 'VIEWER',
        permissionKeys: [],
      });
    }
  }, [user, open]);

  const loadDefaultsForRole = async () => {
    try {
      const { data } = await api.get<string[]>(`/api/users/permission-defaults/${form.role}`);
      setForm((f) => ({ ...f, permissionKeys: data ?? [] }));
      toast.success('Permisos por defecto del rol aplicados');
    } catch {
      toast.error('No se pudieron cargar los permisos por defecto');
    }
  };

  const togglePermission = (key: string) => {
    setForm((f) => ({
      ...f,
      permissionKeys: f.permissionKeys.includes(key)
        ? f.permissionKeys.filter((k) => k !== key)
        : [...f.permissionKeys, key],
    }));
  };

  const byModule = (permissionsList as PermissionDef[]).reduce<Record<string, PermissionDef[]>>((acc, p) => {
    const m = p.module || 'Otros';
    if (!acc[m]) acc[m] = [];
    acc[m].push(p);
    return acc;
  }, {});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Nombre requerido');
      return;
    }
    if (!form.email.trim()) {
      toast.error('Email requerido');
      return;
    }
    if (!isEdit && !form.password) {
      toast.error('Contraseña requerida (mínimo 6 caracteres)');
      return;
    }
    if (isEdit && form.password && form.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && user) {
        const payload: Record<string, unknown> = {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          permissions: form.permissionKeys,
        };
        if (form.password) payload.password = form.password;
        await api.patch(`/api/users/${user.id}`, payload);
        toast.success('Usuario actualizado');
      } else {
        await api.post('/api/users', {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          permissions: form.permissionKeys.length ? form.permissionKeys : undefined,
        });
        toast.success('Usuario creado');
      }
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al guardar';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar usuario' : 'Crear usuario'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nombre *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Juan Pérez"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email *</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="usuario@ejemplo.com"
                required
                disabled={isEdit}
              />
              {isEdit && <p className="text-xs text-muted mt-1">El email no se puede cambiar</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Rol</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            {!isEdit && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Contraseña *</label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                />
              </div>
            )}
            {isEdit && form.password && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Nueva contraseña</label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Dejar vacío para no cambiar"
                />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Permisos detallados</label>
              <Button type="button" variant="outline" size="sm" onClick={loadDefaultsForRole}>
                Aplicar permisos del rol
              </Button>
            </div>
            <p className="text-xs text-muted mb-3">
              Marca los permisos que tendrá este usuario. Sin marcar ninguno personalizado, se usan los del rol.
            </p>
            <div className="border border-border rounded-lg p-3 max-h-64 overflow-y-auto space-y-4">
              {Object.entries(byModule).map(([module, perms]) => (
                <div key={module}>
                  <h4 className="text-sm font-semibold text-foreground mb-2">{module}</h4>
                  <div className="space-y-1.5 pl-2">
                    {perms.map((p) => (
                      <label
                        key={p.key}
                        className={cn(
                          'flex items-start gap-2 cursor-pointer rounded px-2 py-1 hover:bg-card-hover',
                          p.key === 'sensitive.view_cost' && 'border border-amber-500/30 bg-amber-500/5'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={form.permissionKeys.includes(p.key)}
                          onChange={() => togglePermission(p.key)}
                          className="mt-1 h-4 w-4 rounded border-border"
                        />
                        <span className="text-sm">
                          {p.label}
                          {p.key === 'sensitive.view_cost' && (
                            <span className="text-amber-600 dark:text-amber-400 ml-1">(dato delicado)</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
