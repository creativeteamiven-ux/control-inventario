import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { FileBarChart, FileSpreadsheet, FileText, History, Wrench, HandCoins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useLocations } from '@/hooks/useLocations';
import { usePermissions } from '@/hooks/usePermissions';
import toast from 'react-hot-toast';

const MOVEMENT_TYPE_OPTIONS = [
  { value: 'CHECK_IN', label: 'Entrada' },
  { value: 'CHECK_OUT', label: 'Salida' },
  { value: 'TRANSFER', label: 'Traslado' },
  { value: 'STATUS_CHANGE', label: 'Cambio de estado' },
];

const selectClass =
  'flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50';

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

function flattenCategories(
  cats: { id: string; name: string; children?: unknown[] }[],
  prefix = ''
): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  for (const c of cats) {
    const label = prefix ? `${prefix} › ${c.name}` : c.name;
    out.push({ id: c.id, name: label });
    const children = c.children as { id: string; name: string; children?: unknown[] }[] | undefined;
    if (children?.length) {
      out.push(...flattenCategories(children, label));
    }
  }
  return out;
}

export default function Reports() {
  const { locations } = useLocations();
  const { hasPermission } = usePermissions();
  const canExport = hasPermission('reports.export');
  const [downloading, setDownloading] = useState(false);
  const [invExcelBusy, setInvExcelBusy] = useState(false);
  const [movBusy, setMovBusy] = useState<'excel' | 'pdf' | null>(null);
  const [movFilters, setMovFilters] = useState({ from: '', to: '', type: '', userId: '' });
  const [invFilters, setInvFilters] = useState({ categoryId: '', location: '', eventId: '' });
  const [maintFilters, setMaintFilters] = useState({ from: '', to: '' });
  const [loanFilters, setLoanFilters] = useState({ from: '', to: '' });
  const [maintBusy, setMaintBusy] = useState(false);
  const [loanBusy, setLoanBusy] = useState(false);

  const { data: usersData } = useQuery({
    queryKey: ['users-for-reports'],
    queryFn: async () => {
      const { data } = await api.get<{ id: string; name: string }[]>('/api/users/names');
      return data;
    },
    retry: false,
    enabled: canExport,
  });
  const users: { id: string; name: string }[] = Array.isArray(usersData) ? usersData : [];

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/api/categories');
      return data;
    },
  });
  const categories = Array.isArray(categoriesData) ? flattenCategories(categoriesData) : [];

  const { data: events = [] } = useQuery({
    queryKey: ['events-for-reports'],
    queryFn: async () => {
      const { data } = await api.get<{ id: string; name: string; status: string; stats?: { total: number } }[]>(
        '/api/events'
      );
      return data;
    },
    retry: false,
  });

  const invParams = () => Object.fromEntries(Object.entries(invFilters).filter(([, v]) => v));

  const downloadInventoryPdf = async () => {
    setDownloading(true);
    try {
      await downloadBlob('/api/reports/inventory/pdf', invParams(), 'inventario-thewarehouse.pdf');
      toast.success('PDF descargado');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al descargar el PDF';
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  };

  const downloadInventoryExcel = async () => {
    setInvExcelBusy(true);
    try {
      await downloadBlob('/api/reports/inventory/export', invParams(), 'inventario-thewarehouse.xlsx');
      toast.success('Excel descargado');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al descargar el Excel');
    } finally {
      setInvExcelBusy(false);
    }
  };

  const downloadMaintenance = async () => {
    setMaintBusy(true);
    try {
      const params = Object.fromEntries(Object.entries(maintFilters).filter(([, v]) => v));
      await downloadBlob('/api/reports/maintenance/export', params, 'mantenimientos-thewarehouse.xlsx');
      toast.success('Reporte descargado');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al descargar el reporte');
    } finally {
      setMaintBusy(false);
    }
  };

  const downloadLoans = async () => {
    setLoanBusy(true);
    try {
      const params = Object.fromEntries(Object.entries(loanFilters).filter(([, v]) => v));
      await downloadBlob('/api/reports/loans/export', params, 'prestamos-thewarehouse.xlsx');
      toast.success('Reporte descargado');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al descargar el reporte');
    } finally {
      setLoanBusy(false);
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

      {/* Historial de movimientos */}
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
              className={selectClass}
            >
              <option value="">Todos</option>
              {MOVEMENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Responsable</label>
            <select
              value={movFilters.userId}
              onChange={(e) => setMovFilters((f) => ({ ...f, userId: e.target.value }))}
              disabled={users.length === 0}
              className={selectClass}
            >
              <option value="">Todos</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          {canExport && (
            <>
              <Button onClick={() => downloadMovements('excel')} disabled={movBusy !== null}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {movBusy === 'excel' ? 'Generando...' : 'Descargar Excel'}
              </Button>
              <Button variant="outline" onClick={() => downloadMovements('pdf')} disabled={movBusy !== null}>
                <FileText className="h-4 w-4 mr-2" />
                {movBusy === 'pdf' ? 'Generando...' : 'Descargar PDF'}
              </Button>
            </>
          )}
          {!canExport && (
            <p className="text-sm text-muted">No tienes permiso para exportar reportes.</p>
          )}
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
          Si no eliges fechas, se incluyen todos los movimientos. El Excel incluye equipo, tipo, origen/destino, motivo,
          responsable y correo.
        </p>
      </div>

      {/* Inventario con filtros */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-3 rounded-lg bg-primary/20">
            <FileBarChart className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-semibold">Inventario</h2>
            <p className="text-sm text-muted">
              Descarga el inventario en PDF o Excel. Filtra por categoría, lugar o evento (equipos de la lista).
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Categoría</label>
            <select
              value={invFilters.categoryId}
              onChange={(e) => setInvFilters((f) => ({ ...f, categoryId: e.target.value }))}
              className={selectClass}
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Lugar</label>
            <select
              value={invFilters.location}
              onChange={(e) => setInvFilters((f) => ({ ...f, location: e.target.value }))}
              className={selectClass}
            >
              <option value="">Todos</option>
              {locations.map((l) => (
                <option key={l.id} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Evento</label>
            <select
              value={invFilters.eventId}
              onChange={(e) => setInvFilters((f) => ({ ...f, eventId: e.target.value }))}
              className={selectClass}
            >
              <option value="">Ninguno (todo el inventario)</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.stats?.total != null ? ` (${e.stats.total} equipos)` : ''}
                  {e.status === 'DRAFT' ? ' — Borrador' : e.status === 'ACTIVE' ? ' — En curso' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          {canExport ? (
            <>
              <Button onClick={downloadInventoryPdf} disabled={downloading || invExcelBusy}>
                <FileText className="h-4 w-4 mr-2" />
                {downloading ? 'Generando...' : 'Descargar PDF'}
              </Button>
              <Button variant="outline" onClick={downloadInventoryExcel} disabled={invExcelBusy || downloading}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {invExcelBusy ? 'Generando...' : 'Descargar Excel'}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted">No tienes permiso para exportar.</p>
          )}
          {(invFilters.categoryId || invFilters.location || invFilters.eventId) && (
            <button
              onClick={() => setInvFilters({ categoryId: '', location: '', eventId: '' })}
              className="text-sm text-muted hover:text-primary transition-colors ml-1"
            >
              Limpiar filtros
            </button>
          )}
        </div>
        <p className="text-xs text-muted mt-3">
          Puedes combinar filtros. Si eliges un evento, el reporte incluye solo los equipos de esa lista. Sin filtros se
          descarga el inventario completo.
        </p>
      </div>

      {/* Otros reportes */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-6 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-primary/20">
              <Wrench className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-display font-semibold">Mantenimientos</h2>
          </div>
          <p className="text-sm text-muted mb-3">Historial de mantenimientos por rango de fechas (Excel).</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Input
              type="date"
              value={maintFilters.from}
              onChange={(e) => setMaintFilters((f) => ({ ...f, from: e.target.value }))}
            />
            <Input
              type="date"
              value={maintFilters.to}
              onChange={(e) => setMaintFilters((f) => ({ ...f, to: e.target.value }))}
            />
          </div>
          <Button variant="outline" onClick={downloadMaintenance} disabled={maintBusy || !canExport}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {maintBusy ? 'Generando...' : 'Descargar Excel'}
          </Button>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-primary/20">
              <HandCoins className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-display font-semibold">Préstamos</h2>
          </div>
          <p className="text-sm text-muted mb-3">Historial de préstamos por rango de fechas (Excel).</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Input
              type="date"
              value={loanFilters.from}
              onChange={(e) => setLoanFilters((f) => ({ ...f, from: e.target.value }))}
            />
            <Input
              type="date"
              value={loanFilters.to}
              onChange={(e) => setLoanFilters((f) => ({ ...f, to: e.target.value }))}
            />
          </div>
          <Button variant="outline" onClick={downloadLoans} disabled={loanBusy || !canExport}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {loanBusy ? 'Generando...' : 'Descargar Excel'}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
