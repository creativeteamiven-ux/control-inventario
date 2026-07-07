import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { FileBarChart, Download, FileSpreadsheet, FileText, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const MOVEMENT_TYPE_OPTIONS = [
  { value: 'CHECK_IN', label: 'Entrada' },
  { value: 'CHECK_OUT', label: 'Salida' },
  { value: 'TRANSFER', label: 'Traslado' },
  { value: 'STATUS_CHANGE', label: 'Cambio de estado' },
];

/** Descarga un blob desde un endpoint, manejando errores JSON del servidor. */
async function downloadBlob(url: string, params: Record<string, string>, filename: string) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const blob = res.data as Blob;
  if (blob.type?.includes('application/json')) {
    const text = await blob.text();
    const json = JSON.parse(text);
    throw new Error(json.error || json.message || 'Error del servidor');
  }
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objUrl);
}

export default function Reports() {
  const [downloading, setDownloading] = useState(false);
  const [movBusy, setMovBusy] = useState<'excel' | 'pdf' | null>(null);
  const [movFilters, setMovFilters] = useState({ from: '', to: '', type: '', userId: '' });

  // Lista de usuarios para filtrar por responsable (best-effort; si no hay permiso, se omite).
  const { data: usersData } = useQuery({
    queryKey: ['users-for-reports'],
    queryFn: async () => {
      const { data } = await api.get('/api/users');
      return data;
    },
    retry: false,
  });
  const users: { id: string; name: string }[] = Array.isArray(usersData)
    ? usersData
    : Array.isArray(usersData?.users)
      ? usersData.users
      : [];

  const downloadInventoryPdf = async () => {
    setDownloading(true);
    try {
      await downloadBlob('/api/reports/inventory/pdf', {}, 'inventario-thewarehouse.pdf');
      toast.success('PDF descargado');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al descargar el PDF';
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  };

  const downloadMovements = async (fmt: 'excel' | 'pdf') => {
    setMovBusy(fmt);
    try {
      const params = Object.fromEntries(Object.entries(movFilters).filter(([, v]) => v));
      if (fmt === 'excel') {
        await downloadBlob('/api/reports/movements/export', params, 'historial-movimientos-thewarehouse.xlsx');
      } else {
        await downloadBlob('/api/reports/movements/pdf', params, 'reporte-movimientos-thewarehouse.pdf');
      }
      toast.success('Reporte descargado');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al descargar el reporte';
      toast.error(msg);
    } finally {
      setMovBusy(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Reportes</h1>

      {/* Reporte de historial de movimientos */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-3 rounded-lg bg-primary/20">
            <History className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-semibold">Historial de movimientos</h2>
            <p className="text-sm text-muted">Quién realizó cada traslado y cambio, con filtro por rango de fechas.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Desde</label>
            <Input
              type="date"
              value={movFilters.from}
              onChange={(e) => setMovFilters((f) => ({ ...f, from: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Hasta</label>
            <Input
              type="date"
              value={movFilters.to}
              onChange={(e) => setMovFilters((f) => ({ ...f, to: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Tipo de movimiento</label>
            <select
              value={movFilters.type}
              onChange={(e) => setMovFilters((f) => ({ ...f, type: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Todos</option>
              {MOVEMENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Responsable</label>
            <select
              value={movFilters.userId}
              onChange={(e) => setMovFilters((f) => ({ ...f, userId: e.target.value }))}
              disabled={users.length === 0}
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            >
              <option value="">Todos</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <Button onClick={() => downloadMovements('excel')} disabled={movBusy !== null}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {movBusy === 'excel' ? 'Generando...' : 'Descargar Excel'}
          </Button>
          <Button variant="outline" onClick={() => downloadMovements('pdf')} disabled={movBusy !== null}>
            <FileText className="h-4 w-4 mr-2" />
            {movBusy === 'pdf' ? 'Generando...' : 'Descargar PDF'}
          </Button>
          {(movFilters.from || movFilters.to || movFilters.type || movFilters.userId) && (
            <button
              onClick={() => setMovFilters({ from: '', to: '', type: '', userId: '' })}
              className="text-sm text-muted hover:text-primary transition-colors ml-1"
            >
              Limpiar filtros
            </button>
          )}
        </div>
        <p className="text-xs text-muted mt-3">
          Si no eliges fechas, se incluyen todos los movimientos. El Excel incluye equipo, tipo, origen/destino, motivo, responsable y correo.
        </p>
      </div>

      {/* Otros reportes */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-6 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-primary/20">
              <FileBarChart className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-display font-semibold">Inventario completo</h2>
          </div>
          <p className="text-sm text-muted mb-4">Exporta el inventario completo en PDF con logo y fecha de generación.</p>
          <Button onClick={downloadInventoryPdf} disabled={downloading}>
            <Download className="h-4 w-4 mr-2" />
            {downloading ? 'Generando...' : 'Descargar PDF'}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
