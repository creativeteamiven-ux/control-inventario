import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { HandCoins, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { loanStatusLabel } from '@/lib/statusLabels';
import { Button } from '@/components/ui/button';
import AddLoanModal from '@/components/AddLoanModal';

export default function Loans() {
  const [addOpen, setAddOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['loans'],
    queryFn: async () => {
      const { data } = await api.get('/api/loans');
      return data;
    },
  });

  const items = data ?? [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-foreground">Préstamos</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar préstamo
        </Button>
      </div>
      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted">
          Cargando...
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 px-4 font-medium text-muted">Equipo</th>
                <th className="text-left py-4 px-4 font-medium text-muted">Prestatario</th>
                <th className="text-left py-4 px-4 font-medium text-muted">Propósito</th>
                <th className="text-left py-4 px-4 font-medium text-muted">Préstamo</th>
                <th className="text-left py-4 px-4 font-medium text-muted">Devolución</th>
                <th className="text-left py-4 px-4 font-medium text-muted">Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l: { id: string; borrowerName: string; purpose: string; loanDate: string; expectedReturn: string; status: string; device: { name: string; internalCode: string } }) => (
                <tr key={l.id} className="border-b border-border hover:bg-card-hover/50">
                  <td className="py-3 px-4">
                    <p className="font-medium">{l.device?.name}</p>
                    <p className="text-sm text-muted">{l.device?.internalCode}</p>
                  </td>
                  <td className="py-3 px-4">{l.borrowerName}</td>
                  <td className="py-3 px-4">{l.purpose}</td>
                  <td className="py-3 px-4 text-sm">{format(new Date(l.loanDate), 'dd MMM yyyy', { locale: es })}</td>
                  <td className="py-3 px-4 text-sm">{format(new Date(l.expectedReturn), 'dd MMM yyyy', { locale: es })}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        l.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : l.status === 'RETURNED' ? 'bg-slate-500/20 text-slate-400' : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {loanStatusLabel(l.status)}
                    </span>
                  </td>
                </tr>
              ))}
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
