import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Download, Upload, Plus, CheckCircle, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import TransferCart, { type CartDevice } from '@/components/TransferCart';
import DevicePickerModal from '@/components/DevicePickerModal';
import { getStoredCart, clearStoredCart } from '@/lib/transferCart';
import { DEVICE_LOCATION_LABELS } from '@/lib/statusLabels';

type ValidationRow = { row: number; valid: boolean; errors: string[]; corrections: { field: string; from: string; to: string }[] };
type ValidateResult = { headerErrors?: string; totalRows: number; validCount: number; invalidCount: number; rows: ValidationRow[] };
const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  CHECK_IN: 'Entrada',
  CHECK_OUT: 'Salida',
  TRANSFER: 'Traslado',
  STATUS_CHANGE: 'Cambio estado',
};

export default function Movements() {
  const [importing, setImporting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cart, setCart] = useState<CartDevice[]>([]);
  const [validationResult, setValidationResult] = useState<ValidateResult | null>(null);
  const [fileToImport, setFileToImport] = useState<File | null>(null);

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
      a.download = 'plantilla-traslados-thewarehouse.xlsx';
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
    setValidationResult(null);
    setFileToImport(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post<ValidateResult>('/api/import/movements/validate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setValidationResult(data);
      setFileToImport(file);
      if (data.headerErrors) toast.error(data.headerErrors);
      else if (data.invalidCount > 0 && data.validCount === 0) toast.error('El archivo tiene errores. Revisa el resultado de validación.');
      else if (data.validCount > 0) toast.success(`Validación: ${data.validCount} fila(s) correcta(s)${data.invalidCount > 0 ? `, ${data.invalidCount} con error(es)` : ''}. Revisa y confirma para importar.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al validar el archivo';
      toast.error(msg);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!fileToImport) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', fileToImport);
      const { data } = await api.post<{ success: number; errors?: { row: number; message: string }[] }>('/api/import/movements', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success(`${data.success} traslados registrados`);
      if (data.errors?.length) toast.error(`${data.errors.length} fila(s) con errores`);
      setValidationResult(null);
      setFileToImport(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al importar';
      toast.error(msg);
    } finally {
      setImporting(false);
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
      {validationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { if (!importing) { setValidationResult(null); setFileToImport(null); } }}>
          <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-lg text-foreground">Validación del archivo de traslados</h3>
              <Button variant="ghost" size="sm" onClick={() => { setValidationResult(null); setFileToImport(null); }} disabled={importing}>Cerrar</Button>
            </div>
            <div className="overflow-y-auto p-4 flex-1 min-h-0 space-y-4">
              {validationResult.headerErrors ? (
                <p className="text-destructive font-medium">{validationResult.headerErrors}</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-4 items-center">
                    <span className="text-muted">Total filas: <strong className="text-foreground">{validationResult.totalRows}</strong></span>
                    <span className="text-green-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Válidas: <strong>{validationResult.validCount}</strong></span>
                    {validationResult.invalidCount > 0 && (
                      <span className="text-red-600 flex items-center gap-1"><XCircle className="h-4 w-4" /> Con error: <strong>{validationResult.invalidCount}</strong></span>
                    )}
                  </div>
                  {validationResult.invalidCount > 0 && (
                    <div>
                      <h4 className="font-medium text-foreground mb-2">Errores por fila (corrige en Excel y vuelve a validar)</h4>
                      <ul className="space-y-1.5 text-sm max-h-48 overflow-y-auto">
                        {validationResult.rows.filter((r) => !r.valid).map((r, i) => (
                          <li key={i} className="flex gap-2 py-1.5 px-2 rounded bg-red-500/10 border border-red-500/30">
                            <span className="font-mono text-primary shrink-0">Fila {r.row}</span>
                            <span className="text-foreground">{r.errors.join('. ')}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(() => {
                    const correctionsToShow = validationResult.rows.flatMap((r) =>
                      r.corrections
                        .map((c, j) => ({ row: r.row, j, c }))
                        .filter(({ c }) => {
                          const displayTo = c.field === 'Tipo' ? (MOVEMENT_TYPE_LABELS[c.to] ?? c.to) : (DEVICE_LOCATION_LABELS[c.to] ?? c.to);
                          return c.from.trim().toLowerCase() !== displayTo.trim().toLowerCase();
                        })
                    );
                    return correctionsToShow.length > 0 ? (
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Correcciones que se aplicarán al importar</h4>
                        <ul className="space-y-1.5 text-sm max-h-48 overflow-y-auto">
                          {correctionsToShow.map(({ row, j, c }) => (
                            <li key={`${row}-${j}`} className="flex gap-2 py-1.5 px-2 rounded bg-primary/10 border border-primary/30">
                              <span className="font-mono text-primary shrink-0">Fila {row}</span>
                              <span className="text-foreground">
                                {c.field}: &quot;{c.from}&quot; → {c.field === 'Tipo' ? (MOVEMENT_TYPE_LABELS[c.to] ?? c.to) : (DEVICE_LOCATION_LABELS[c.to] ?? c.to)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null;
                  })()}
                </>
              )}
            </div>
            {!validationResult.headerErrors && (
              <div className="p-4 border-t border-border flex gap-2 justify-end shrink-0">
                <Button variant="outline" onClick={() => { setValidationResult(null); setFileToImport(null); }} disabled={importing}>Cancelar</Button>
                <Button onClick={handleConfirmImport} disabled={importing || validationResult.validCount === 0}>
                  {importing ? 'Importando...' : `Importar ${validationResult.validCount} fila(s)`}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
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
