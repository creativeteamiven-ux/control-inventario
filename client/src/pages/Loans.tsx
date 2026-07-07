import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { HandCoins, Plus, RotateCcw, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { loanStatusLabel } from '@/lib/statusLabels';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import toast from 'react-hot-toast';
import AddLoanModal from '@/components/AddLoanModal';

interface Loan {
  id: string;
  borrowerName: string;
  purpose: string;
  loanDate: string;
  expectedReturn: string;
  returnDate?: string | null;
  status: string;
  device: { name: string; internalCode: string };
}

const isOverdue = (l: Loan) => l.status === 'ACTIVE' && new Date(l.expectedReturn).getTime() < Date.now();

export default function Loans() {
  const [addOpen, setAddOpen] = useState(false);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('loans.create');

  const { data, isLoading } = useQuery({
    queryKey: ['loans', statusFilter],
    queryFn: async () => {
      const { data } = await api.get('/api/loans', { params: statusFilter ? { status: statusFilter } : {} });
      return data;
    },
  });

  const items: Loan[] = data ?? [];
  const overdueCount = items.filter(isOverdue).length;

  const handleReturn = async (id: string, name: string) => {
    if (!confirm(`¿Registrar la devolución del equipo "${name}"?`)) return;
    setReturningId(id);
    try {
      await api.post(`/api/loans/${id}/return`, {});
      await queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Devolución registrada. El equipo vuelve a estar operativo.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al registrar la devolución';
      toast.error(msg);
    } finally {
      setReturningId(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-foreground">Préstamos</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex h-10 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="RETURNED">Devueltos</option>
          </select>
          {canManage && (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar préstamo
            </Button>
          )}
        </div>
      </div>

      {overdueCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Hay <strong>{overdueCount}</strong> préstamo(s) vencido(s) sin devolver. Se incluyen en las alertas por correo.</span>
        </div>
      )}

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted">Cargando...</div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 px-4 font-medium text-muted">Equipo</th>
                <th className="text-left py-4 px-4 font-medium text-muted">Prestatario</th>
                <th className="text-left py-4 px-4 font-medium text-muted">Propósito</th>
                <th className="text-left py-4 px-4 font-medium text-muted">Préstamo</th>
                <th className="text-left py-4 px-4 font-medium text-muted">Devolución esperada</th>
                <th className="text-left py-4 px-4 font-medium text-muted">Estado</th>
                {canManage && <th className="text-right py-4 px-4 font-medium text-muted">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((l) => {
                const overdue = isOverdue(l);
                return (
                  <tr key={l.id} className="border-b border-border hover:bg-card-hover/50">
                    <td className="py-3 px-4">
                      <p className="font-medium">{l.device?.name}</p>
                      <p className="text-sm text-muted">{l.device?.internalCode}</p>
                    </td>
                    <td className="py-3 px-4">{l.borrowerName}</td>
                    <td className="py-3 px-4">{l.purpose}</td>
                    <td className="py-3 px-4 text-sm">{format(new Date(l.loanDate), 'dd MMM yyyy', { locale: es })}</td>
                    <td className={`py-3 px-4 text-sm ${overdue ? 'text-red-500 font-medium' : ''}`}>
                      {format(new Date(l.expectedReturn), 'dd MMM yyyy', { locale: es })}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          overdue
                            ? 'bg-red-500/20 text-red-400'
                            : l.status === 'ACTIVE'
                              ? 'bg-green-500/20 text-green-400'
                              : l.status === 'RETURNED'
                                ? 'bg-slate-500/20 text-slate-400'
                                : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {overdue ? 'Vencido' : loanStatusLabel(l.status)}
                      </span>
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-right">
                        {l.status === 'ACTIVE' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReturn(l.id, l.device?.name ?? 'equipo')}
                            disabled={returningId === l.id}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            {returningId === l.id ? 'Registrando...' : 'Marcar devuelto'}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted">
                            {l.returnDate ? `Devuelto ${format(new Date(l.returnDate), 'dd MMM yyyy', { locale: es })}` : '—'}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 && (
            <div className="p-12 text-center text-muted flex flex-col items-center gap-2">
              <HandCoins className="h-12 w-12" />
              <p>No hay préstamos registrados</p>
            </div>
          )}
        </div>
      )}
      <AddLoanModal open={addOpen} onOpenChange={setAddOpen} />
    </motion.div>
  );
}
