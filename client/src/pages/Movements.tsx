import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Download, Upload, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import TransferCart, { type CartDevice } from '@/components/TransferCart';
import DevicePickerModal from '@/components/DevicePickerModal';
import { getStoredCart, clearStoredCart } from '@/lib/transferCart';

export default function Movements() {
  const [importing, setImporting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cart, setCart] = useState<CartDevice[]>([]);

  useEffect(() => {
    const stored = getStoredCart();
    if (stored.length > 0) {
      setCart((prev) => {
        const ids = new Set(prev.map((d) => d.id));
        const newOnes = stored.filter((d) => !ids.has(d.id));
        return [...prev, ...newOnes];
      });
      clearStoredCart();
      toast.success(`${stored.length} equipo(s) agregado(s) desde el inventario`);
    }
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const downloadTemplate = async () => {
    try {
      const params = cart.length > 0 ? { deviceIds: cart.map((d) => d.id).join(',') } : {};
      const { data } = await api.get('/api/templates/transfers', {
        params,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla-traslados-soundvault.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success(cart.length > 0 ? `Plantilla con ${cart.length} equipos descargada` : 'Plantilla descargada');
    } catch {
      toast.error('Error al descargar plantilla');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/api/import/movements', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success(`${data.success} traslados registrados`);
      if (data.errors?.length) toast.error(`${data.errors.length} filas con errores`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al importar';
      toast.error(msg);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['movements'],
    queryFn: async () => {
      const { data } = await api.get('/api/movements');
      return data;
    },
  });

  const items = data?.items ?? [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-foreground">Movimientos</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPickerOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar equipos
            {cart.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
                {cart.length}
              </span>
            )}
          </Button>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            {cart.length > 0 ? 'Descargar plantilla con carrito' : 'Plantilla traslados'}
          </Button>
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImport}
              disabled={importing}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              <Upload className="h-4 w-4 mr-2" />
              {importing ? 'Importando...' : 'Importar traslados'}
            </Button>
          </div>
        </div>
      </div>
      <TransferCart
        items={cart}
        onRemove={(id) => setCart((prev) => prev.filter((d) => d.id !== id))}
        onClear={() => setCart([])}
      />
      <DevicePickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        cartIds={cart.map((d) => d.id)}
        onAdd={(devices) => setCart((prev) => {
          const ids = new Set(prev.map((d) => d.id));
          const newOnes = devices.filter((d) => !ids.has(d.id));
          return [...prev, ...newOnes];
        })}
      />
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
                <th className="text-left py-4 px-4 font-medium text-muted">Tipo</th>
                <th className="text-left py-4 px-4 font-medium text-muted">Razón</th>
                <th className="text-left py-4 px-4 font-medium text-muted">Usuario</th>
                <th className="text-left py-4 px-4 font-medium text-muted">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m: { id: string; type: string; reason: string; createdAt: string; device: { name: string }; user: { name: string } }) => (
                <tr key={m.id} className="border-b border-border hover:bg-card-hover/50">
                  <td className="py-3 px-4 font-medium">{m.device?.name}</td>
                  <td className="py-3 px-4">{m.type?.replace(/_/g, ' ')}</td>
                  <td className="py-3 px-4">{m.reason}</td>
                  <td className="py-3 px-4 text-sm">{m.user?.name}</td>
                  <td className="py-3 px-4 text-sm text-muted">{format(new Date(m.createdAt), 'dd MMM yyyy HH:mm', { locale: es })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <div className="p-12 text-center text-muted flex flex-col items-center gap-2">
              <ArrowLeftRight className="h-12 w-12" />
              <p>No hay movimientos registrados</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
