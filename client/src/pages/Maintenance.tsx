import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Wrench, Pencil, Plus, Download, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { maintenanceStatusLabel } from '@/lib/statusLabels';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileDataInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    try {
      const { data } = await api.get('/api/templates/maintenance', { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla-mantenimiento-soundvault.xlsx';
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
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/api/import/maintenance', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success(`${data.success} equipo(s) enviado(s) a mantenimiento`);
      if (data.errors?.length) toast.error(`${data.errors.length} fila(s) con errores`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al cargar archivo';
      toast.error(msg);
    } finally {
      setImporting(false);
      e.target.value = '';
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
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/api/import/maintenance-update', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success(`${data.success} registro(s) de mantenimiento actualizado(s)`);
      if (data.errors?.length) toast.error(`${data.errors.length} fila(s) con errores`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al cargar datos';
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-foreground">Mantenimientos</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Plantilla
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
              {importing ? 'Cargando...' : 'Cargar'}
            </Button>
          </div>
          <Button variant="outline" onClick={downloadReportTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Reporte datos
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
            <Button variant="outline" onClick={() => fileDataInputRef.current?.click()} disabled={importingData}>
              <Upload className="h-4 w-4 mr-2" />
              {importingData ? 'Cargando datos...' : 'Cargar datos'}
            </Button>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar mantenimiento
          </Button>
        </div>
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
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        m.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' : m.status === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
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
