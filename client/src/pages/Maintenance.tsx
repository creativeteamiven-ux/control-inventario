import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Wrench, Pencil, Plus, Download, Upload, CheckCircle, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { maintenanceStatusLabel } from '@/lib/statusLabels';

type ValidationRow = { row: number; valid: boolean; errors: string[]; corrections: { field: string; from: string; to: string }[] };
type ValidateResult = { headerErrors?: string; totalRows: number; validCount: number; invalidCount: number; rows: ValidationRow[] };
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import EditMaintenanceModal from '@/components/EditMaintenanceModal';
import AddMaintenanceModal from '@/components/AddMaintenanceModal';

interface MaintenanceItem {
  id: string;
  deviceId: string;
  type: string;
  description?: string;
  cost?: number | null;
  technician?: string | null;
  startDate: string;
  endDate?: string | null;
  status: string;
  notes?: string | null;
  device?: { name: string; internalCode: string };
}

export default function Maintenance() {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MaintenanceItem | null>(null);
  const [importing, setImporting] = useState(false);
  const [importingData, setImportingData] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidateResult | null>(null);
  const [fileToImport, setFileToImport] = useState<File | null>(null);
  const [importKind, setImportKind] = useState<'maintenance' | 'maintenance-update' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileDataInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    try {
      const { data } = await api.get('/api/templates/maintenance', { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla-mantenimiento-thewarehouse.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Plantilla descargada');
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
    setImportKind(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post<ValidateResult>('/api/import/maintenance/validate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setValidationResult(data);
      setFileToImport(file);
      setImportKind('maintenance');
      if (data.headerErrors) toast.error(data.headerErrors);
      else if (data.invalidCount > 0 && data.validCount === 0) toast.error('El archivo tiene errores. Revisa el resultado de validación.');
      else if (data.validCount > 0) toast.success(`Validación: ${data.validCount} fila(s) correcta(s)${data.invalidCount > 0 ? `, ${data.invalidCount} con error(es)` : ''}. Revisa y confirma para cargar.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al validar el archivo';
      toast.error(msg);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!fileToImport || !importKind) return;
    setImporting(true);
    if (importKind === 'maintenance-update') setImportingData(true);
    try {
      const formData = new FormData();
      formData.append('file', fileToImport);
      const url = importKind === 'maintenance' ? '/api/import/maintenance' : '/api/import/maintenance-update';
      const { data } = await api.post<{ success: number; errors?: { row: number; message: string }[] }>(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      if (importKind === 'maintenance') {
        toast.success(`${data.success} equipo(s) enviado(s) a mantenimiento`);
      } else {
        toast.success(`${data.success} registro(s) de mantenimiento actualizado(s)`);
      }
      if (data.errors?.length) toast.error(`${data.errors.length} fila(s) con errores`);
      setValidationResult(null);
      setFileToImport(null);
      setImportKind(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || (importKind === 'maintenance' ? 'Error al cargar archivo' : 'Error al cargar datos');
      toast.error(msg);
    } finally {
      setImporting(false);
      setImportingData(false);
    }
  };

  const downloadReportTemplate = async () => {
    try {
      const { data } = await api.get('/api/templates/maintenance-report', { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reporte-mantenimiento-datos.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Reporte descargado. Completa Costo, Técnico, Fecha fin, Estado y cárgalo.');
    } catch {
      toast.error('Error al descargar reporte');
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingData(true);
    setValidationResult(null);
    setFileToImport(null);
    setImportKind(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post<ValidateResult>('/api/import/maintenance-update/validate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setValidationResult(data);
      setFileToImport(file);
      setImportKind('maintenance-update');
      if (data.headerErrors) toast.error(data.headerErrors);
      else if (data.invalidCount > 0 && data.validCount === 0) toast.error('El archivo tiene errores. Revisa el resultado de validación.');
      else if (data.validCount > 0) toast.success(`Validación: ${data.validCount} fila(s) correcta(s)${data.invalidCount > 0 ? `, ${data.invalidCount} con error(es)` : ''}. Revisa y confirma para cargar.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al validar el archivo';
      toast.error(msg);
    } finally {
      setImportingData(false);
      e.target.value = '';
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['maintenance'],
    queryFn: async () => {
      const { data } = await api.get('/api/maintenance');
      return data;
    },
  });

  const items = data ?? [];
  const { canViewCost } = usePermissions();

  const statusClass = (status: string) =>
    status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' : status === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-bold text-foreground">Mantenimientos</h1>
        {/* Botones: en móvil en grid 2 columnas y full-width el principal */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2">
          <Button variant="outline" onClick={downloadTemplate} className="min-h-touch sm:min-h-0">
            <Download className="h-4 w-4 mr-2 shrink-0" />
            <span className="truncate">Plantilla</span>
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
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing} className="w-full min-h-touch sm:min-h-0">
              <Upload className="h-4 w-4 mr-2 shrink-0" />
              <span className="truncate">{importing ? 'Cargando...' : 'Cargar'}</span>
            </Button>
          </div>
          <Button variant="outline" onClick={downloadReportTemplate} className="min-h-touch sm:min-h-0">
            <Download className="h-4 w-4 mr-2 shrink-0" />
            <span className="truncate">Reporte datos</span>
          </Button>
          <div className="relative">
            <input
              ref={fileDataInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImportData}
              disabled={importingData}
            />
            <Button variant="outline" onClick={() => fileDataInputRef.current?.click()} disabled={importingData} className="w-full min-h-touch sm:min-h-0">
              <Upload className="h-4 w-4 mr-2 shrink-0" />
              <span className="truncate">{importingData ? 'Cargando...' : 'Cargar datos'}</span>
            </Button>
          </div>
          <Button onClick={() => setAddOpen(true)} className="col-span-2 min-h-touch sm:col-span-1 sm:min-h-0">
            <Plus className="h-4 w-4 mr-2 shrink-0" />
            Agregar mantenimiento
          </Button>
        </div>
      </div>
      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted">
          Cargando...
        </div>
      ) : (
        <>
          {/* Vista móvil: cards */}
          <div className="md:hidden space-y-3">
            {items.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-12 text-center text-muted flex flex-col items-center gap-2">
                <Wrench className="h-12 w-12" />
                <p>No hay mantenimientos registrados</p>
              </div>
            ) : (
              items.map((m: MaintenanceItem) => (
                <div
                  key={m.id}
                  className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground leading-tight">{m.device?.name}</p>
                      <p className="text-sm text-muted font-mono">{m.device?.internalCode}</p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${statusClass(m.status)}`}>
                      {maintenanceStatusLabel(m.status)}
                    </span>
                  </div>
                  <dl className="grid gap-1.5 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">Tipo</dt>
                      <dd className="text-foreground font-medium capitalize">{m.type}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">Fecha inicio</dt>
                      <dd className="text-foreground">{format(new Date(m.startDate), 'dd MMM yyyy', { locale: es })}</dd>
                    </div>
                    {canViewCost() && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted">Costo</dt>
                        <dd className="text-foreground">{m.cost != null ? `$${m.cost}` : '—'}</dd>
                      </div>
                    )}
                  </dl>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full min-h-touch sm:min-h-0"
                    onClick={() => {
                      setEditingItem(m);
                      setEditOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Vista desktop: tabla */}
          <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 px-4 font-medium text-muted">Equipo</th>
                  <th className="text-left py-4 px-4 font-medium text-muted">Tipo</th>
                  <th className="text-left py-4 px-4 font-medium text-muted">Estado</th>
                  <th className="text-left py-4 px-4 font-medium text-muted">Fecha inicio</th>
                  {canViewCost() && <th className="text-left py-4 px-4 font-medium text-muted">Costo</th>}
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((m: MaintenanceItem) => (
                  <tr key={m.id} className="border-b border-border hover:bg-card-hover/50">
                    <td className="py-3 px-4">
                      <p className="font-medium">{m.device?.name}</p>
                      <p className="text-sm text-muted">{m.device?.internalCode}</p>
                    </td>
                    <td className="py-3 px-4">{m.type}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs ${statusClass(m.status)}`}>
                        {maintenanceStatusLabel(m.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">{format(new Date(m.startDate), 'dd MMM yyyy', { locale: es })}</td>
                    {canViewCost() && <td className="py-3 px-4">{m.cost ? `$${m.cost}` : '—'}</td>}
                    <td className="py-3 px-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted hover:text-primary"
                        onClick={() => {
                          setEditingItem(m);
                          setEditOpen(true);
                        }}
                        title="Editar mantenimiento"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && (
              <div className="p-12 text-center text-muted flex flex-col items-center gap-2">
                <Wrench className="h-12 w-12" />
                <p>No hay mantenimientos registrados</p>
              </div>
            )}
          </div>
        </>
      )}
      {validationResult && importKind && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { if (!importing && !importingData) { setValidationResult(null); setFileToImport(null); setImportKind(null); } }}>
          <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-lg text-foreground">
                {importKind === 'maintenance' ? 'Validación: plantilla de mantenimiento' : 'Validación: reporte de datos'}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => { setValidationResult(null); setFileToImport(null); setImportKind(null); }} disabled={importing || importingData}>Cerrar</Button>
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
                  {validationResult.rows.some((r) => r.corrections.length > 0) && (
                    <div>
                      <h4 className="font-medium text-foreground mb-2">Correcciones que se aplicarán al importar</h4>
                      <ul className="space-y-1.5 text-sm max-h-48 overflow-y-auto">
                        {validationResult.rows.flatMap((r) =>
                          r.corrections.map((c, j) => (
                            <li key={`${r.row}-${j}`} className="flex gap-2 py-1.5 px-2 rounded bg-primary/10 border border-primary/30">
                              <span className="font-mono text-primary shrink-0">Fila {r.row}</span>
                              <span className="text-foreground">
                                {c.field}: &quot;{c.from}&quot; → {c.field === 'Estado' ? maintenanceStatusLabel(c.to) : c.to}
                              </span>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
            {!validationResult.headerErrors && (
              <div className="p-4 border-t border-border flex gap-2 justify-end shrink-0">
                <Button variant="outline" onClick={() => { setValidationResult(null); setFileToImport(null); setImportKind(null); }} disabled={importing || importingData}>Cancelar</Button>
                <Button onClick={handleConfirmImport} disabled={importing || importingData || validationResult.validCount === 0}>
                  {(importing || importingData) ? 'Cargando...' : importKind === 'maintenance' ? `Cargar ${validationResult.validCount} fila(s)` : `Cargar datos (${validationResult.validCount} filas)`}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      <EditMaintenanceModal
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingItem(null);
        }}
        maintenance={editingItem}
      />
      <AddMaintenanceModal open={addOpen} onOpenChange={setAddOpen} />
    </motion.div>
  );
}
