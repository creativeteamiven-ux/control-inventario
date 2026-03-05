import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, Grid3X3, List, Plus, Search, Download, Upload, Truck, FolderTree, AlertCircle } from 'lucide-react';
import { addToStoredCart, addManyToStoredCart, getStoredCart } from '@/lib/transferCart';
import { api } from '@/lib/api';
import AddDeviceModal from '@/components/AddDeviceModal';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { deviceStatusLabel, deviceLocationLabel, DEVICE_STATUS_LABELS } from '@/lib/statusLabels';

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-500/20 text-green-400',
  MAINTENANCE: 'bg-amber-500/20 text-amber-400',
  LOANED: 'bg-blue-500/20 text-blue-400',
  DAMAGED: 'bg-red-500/20 text-red-400',
  LOST: 'bg-gray-500/20 text-gray-400',
  RETIRED: 'bg-slate-500/20 text-slate-400',
};

export default function Inventory() {
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [inTransferCart, setInTransferCart] = useState<Set<string>>(
    () => new Set(getStoredCart().map((x) => x.id))
  );

  const addToTransfer = (d: { id: string; internalCode: string; name: string }, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToStoredCart({ id: d.id, internalCode: d.internalCode, name: d.name });
    setInTransferCart((prev) => new Set(prev).add(d.id));
    toast.success('Agregado al traslado. Ve a Movimientos para descargar la plantilla.');
  };
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [needsReview, setNeedsReview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<string>('ACTIVE');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [limit, setLimit] = useState(25);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/api/categories');
      return data;
    },
  });

  function flattenCategories(
    cats: { id: string; name: string; _count?: { devices: number }; children?: unknown[] }[],
    prefix = ''
  ): { id: string; name: string; count: number }[] {
    const out: { id: string; name: string; count: number }[] = [];
    for (const c of cats) {
      const count = c._count?.devices ?? 0;
      const label = prefix ? `${prefix} › ${c.name}` : c.name;
      out.push({ id: c.id, name: label, count });
      const children = c.children as { id: string; name: string; _count?: { devices: number }; children?: unknown[] }[] | undefined;
      if (children?.length) {
        out.push(...flattenCategories(children, prefix ? `${prefix} › ${c.name}` : c.name));
      }
    }
    return out;
  }
  const categoriesFlat = Array.isArray(categoriesData) ? flattenCategories(categoriesData) : [];
  const totalDevicesInCategories = categoriesFlat.reduce((s, c) => s + c.count, 0);

  const downloadTemplate = async () => {
    try {
      const { data } = await api.get('/api/templates/equipment', { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla-equipos-soundvault.xlsx';
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
      const { data } = await api.post('/api/import/devices', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success(`${data.success} equipos importados correctamente`);
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
    queryKey: ['devices', search, page, categoryId, statusFilter, needsReview],
    queryFn: async () => {
      const { data } = await api.get('/api/devices', {
        params: {
          search: search || undefined,
          page,
          limit,
          categoryId: categoryId || undefined,
          status: statusFilter || undefined,
          needsReview: needsReview ? 'true' : undefined,
        },
      });
      return data;
    },
  });

  const devices = data?.devices ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const onPageIds = devices.map((d: { id: string }) => d.id);
  const allOnPageSelected = onPageIds.length > 0 && onPageIds.every((id: string) => selectedIds.has(id));
  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        onPageIds.forEach((id: string) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => new Set([...prev, ...onPageIds]));
    }
  };
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const bulkAddToTransfer = () => {
    const toAdd = devices.filter((d: { id: string }) => selectedIds.has(d.id)) as { id: string; internalCode: string; name: string }[];
    const added = addManyToStoredCart(toAdd);
    setInTransferCart((prev) => new Set([...prev, ...toAdd.map((d) => d.id)]));
    clearSelection();
    toast.success(added ? `${added} equipo(s) agregado(s) al traslado` : 'Ya estaban en el traslado');
  };

  const downloadMaintenanceTemplate = async () => {
    const ids = Array.from(selectedIds).slice(0, 500);
    try {
      const { data } = await api.get('/api/templates/maintenance', {
        params: { deviceIds: ids.join(',') },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla-mantenimiento-soundvault.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Plantilla descargada con los equipos seleccionados');
    } catch {
      toast.error('Error al descargar plantilla');
    }
  };

  const bulkChangeStatus = async () => {
    if (selectedIds.size === 0) return;
    setBulkUpdating(true);
    try {
      const { data } = await api.patch('/api/devices/bulk', {
        deviceIds: Array.from(selectedIds),
        status: bulkStatusValue,
      });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success(`${data.updated} equipo(s) actualizado(s)`);
      setBulkStatusOpen(false);
      clearSelection();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al actualizar';
      toast.error(msg);
    } finally {
      setBulkUpdating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex gap-6"
    >
      <aside className="w-56 shrink-0 hidden lg:block">
        <div className="sticky top-24 rounded-xl border border-border bg-card p-3">
          <h2 className="flex items-center gap-2 font-semibold text-foreground mb-3 px-1">
            <FolderTree className="h-4 w-4 text-primary" />
            Ver por categoría
          </h2>
          <nav className="space-y-0.5">
            <button
              onClick={() => { setCategoryId(null); setNeedsReview(false); setPage(1); }}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                !categoryId && !needsReview ? 'bg-primary/20 text-primary' : 'text-muted hover:bg-card-hover hover:text-foreground'
              )}
            >
              Todas ({totalDevicesInCategories})
            </button>
            <button
              onClick={() => { setNeedsReview(true); setPage(1); }}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                needsReview ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'text-muted hover:bg-card-hover hover:text-foreground'
              )}
              title="Operativos pero con observación o condición &lt; 70%"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              Con observación
            </button>
            {categoriesFlat.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setCategoryId(cat.id); setNeedsReview(false); setPage(1); }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex justify-between items-center gap-2',
                  categoryId === cat.id ? 'bg-primary/20 text-primary font-medium' : 'text-muted hover:bg-card-hover hover:text-foreground'
                )}
                title={cat.name}
              >
                <span className="truncate">{cat.name}</span>
                <span className="text-xs text-muted shrink-0">({cat.count})</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <div className="flex-1 min-w-0 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-foreground">Inventario</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="lg:hidden flex flex-wrap items-center gap-2">
            <select
              value={needsReview ? '__needs_review__' : (categoryId ?? '')}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '__needs_review__') { setNeedsReview(true); setCategoryId(null); }
                else { setNeedsReview(false); setCategoryId(v || null); }
                setPage(1);
              }}
              className="flex h-10 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-w-[180px]"
            >
              <option value="">Todas las categorías</option>
              <option value="__needs_review__">Con observación</option>
              {categoriesFlat.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name} ({cat.count})</option>
              ))}
            </select>
          </div>
          <select
            value={statusFilter ?? ''}
            onChange={(e) => {
              setStatusFilter(e.target.value || null);
              setPage(1);
            }}
            className="flex h-10 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-w-[160px]"
            title="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            {Object.entries(DEVICE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            className="flex h-10 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-w-[100px]"
            title="Mostrar por página"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <div className="flex border border-border rounded-md p-1">
            <button
              onClick={() => setView('table')}
              className={cn('p-2 rounded', view === 'table' ? 'bg-card-hover' : 'hover:bg-card-hover')}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('grid')}
              className={cn('p-2 rounded', view === 'grid' ? 'bg-card-hover' : 'hover:bg-card-hover')}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
          </div>
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
              {importing ? 'Importando...' : 'Importar'}
            </Button>
          </div>
          <Button onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar equipo
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <span className="font-medium text-foreground">{selectedIds.size} seleccionado(s)</span>
          <Button variant="outline" size="sm" onClick={bulkAddToTransfer}>
            <Truck className="h-4 w-4 mr-2" />
            Agregar al traslado
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkStatusOpen(true)}>
            Cambiar estado
          </Button>
          <Button variant="outline" size="sm" onClick={downloadMaintenanceTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Plantilla mantenimiento
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            Limpiar selección
          </Button>
        </div>
      )}

      {bulkStatusOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !bulkUpdating && setBulkStatusOpen(false)}>
          <div className="bg-card rounded-xl border border-border p-6 shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-3">Cambiar estado de {selectedIds.size} equipo(s)</h3>
            <select
              value={bulkStatusValue}
              onChange={(e) => setBulkStatusValue(e.target.value)}
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-4"
            >
              {Object.entries(DEVICE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setBulkStatusOpen(false)} disabled={bulkUpdating}>Cancelar</Button>
              <Button onClick={bulkChangeStatus} disabled={bulkUpdating}>{bulkUpdating ? 'Guardando...' : 'Aplicar'}</Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted">
          Cargando inventario...
        </div>
      ) : view === 'table' ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-12 py-4 px-2 text-left">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && !allOnPageSelected; }}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-border"
                    />
                  </th>
                  <th className="text-left py-4 px-4 font-medium text-muted">Código</th>
                  <th className="text-left py-4 px-4 font-medium text-muted">Nombre</th>
                  <th className="text-left py-4 px-4 font-medium text-muted">Marca/Modelo</th>
                  <th className="text-left py-4 px-4 font-medium text-muted">Categoría</th>
                  <th className="text-left py-4 px-4 font-medium text-muted">Estado</th>
                  <th className="text-left py-4 px-4 font-medium text-muted">Ubicación</th>
                  <th className="text-left py-4 px-4 font-medium text-muted">Condición</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d: { id: string; internalCode: string; name: string; brand: string; model: string; category: { name: string }; status: string; location: string; condition: number; observation?: string | null }) => {
                  const hasObservation = d.status === 'ACTIVE' && (!!(d.observation?.trim()) || d.condition < 70);
                  return (
                  <tr
                    key={d.id}
                    className={cn('border-b border-border hover:bg-card-hover/50 transition-colors', selectedIds.has(d.id) && 'bg-primary/5')}
                  >
                    <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(d.id)}
                        onChange={() => toggleOne(d.id)}
                        className="h-4 w-4 rounded border-border"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <Link to={`/inventory/${d.id}`} className="text-primary hover:underline font-mono">
                        {d.internalCode}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-medium">{d.name}</td>
                    <td className="py-3 px-4 text-muted">{d.brand} {d.model}</td>
                    <td className="py-3 px-4">{d.category?.name}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', STATUS_BADGE[d.status] ?? 'bg-muted')}>
                          {deviceStatusLabel(d.status)}
                        </span>
                        {hasObservation && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Con observación
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted">{deviceLocationLabel(d.location)}</td>
                    <td className="py-3 px-4">
                      <div className="w-20 h-2 bg-card-hover rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            d.condition >= 70 ? 'bg-green-500' : d.condition >= 40 ? 'bg-amber-500' : 'bg-red-500'
                          )}
                          style={{ width: `${d.condition}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-8 w-8',
                          inTransferCart.has(d.id)
                            ? 'text-orange-500 bg-orange-500/20 hover:bg-orange-500/30'
                            : 'text-muted hover:text-primary'
                        )}
                        onClick={(e) => addToTransfer(d, e)}
                        title={inTransferCart.has(d.id) ? 'En carrito de traslado' : 'Agregar al traslado'}
                      >
                        <Truck className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 py-4 border-t border-border">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <span className="py-2 px-4 text-sm text-muted">
                Página {page} de {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Siguiente
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {devices.map((d: { id: string; internalCode: string; name: string; brand: string; model: string; category: { name: string; color: string }; status: string; condition?: number; observation?: string | null; images: { url: string }[] }) => {
            const hasObservation = d.status === 'ACTIVE' && (!!(d.observation?.trim()) || (d.condition ?? 100) < 70);
            return (
            <div key={d.id} className={cn('relative group', selectedIds.has(d.id) && 'ring-2 ring-primary rounded-xl')}>
              <div className="absolute top-2 left-2 z-10" onClick={(e) => e.preventDefault()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(d.id)}
                  onChange={() => toggleOne(d.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded border-border bg-card"
                />
              </div>
              <Link to={`/inventory/${d.id}`}>
                <motion.div
                  whileHover={{ y: -4 }}
                  className="bg-card rounded-xl border border-border overflow-hidden hover:border-primary/50 transition-colors"
                >
                  <div className="h-32 bg-card-hover flex items-center justify-center">
                    {d.images?.[0]?.url ? (
                      <img src={d.images[0].url} alt={d.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-12 w-12 text-muted" />
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-mono text-xs text-primary">{d.internalCode}</p>
                    <h3 className="font-medium text-foreground mt-1">{d.name}</h3>
                    <p className="text-sm text-muted">{d.brand} {d.model}</p>
                    <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
                      <span className="text-xs text-muted">{d.category?.name}</span>
                      <div className="flex items-center gap-1">
                        <span className={cn('px-2 py-0.5 rounded text-xs', STATUS_BADGE[d.status] ?? 'bg-muted')}>
                          {deviceStatusLabel(d.status)}
                        </span>
                        {hasObservation && (
                          <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400" title="Tiene observación o requiere revisión">
                            <AlertCircle className="h-3 w-3 inline" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Link>
              <Button
                variant="secondary"
                size="icon"
                className={cn(
                  'absolute top-2 right-2 h-8 w-8 transition-opacity',
                  inTransferCart.has(d.id)
                    ? 'opacity-100 text-orange-500 bg-orange-500/20 border-orange-500/50'
                    : 'opacity-0 group-hover:opacity-100'
                )}
                onClick={(e) => addToTransfer(d, e)}
                title={inTransferCart.has(d.id) ? 'En carrito de traslado' : 'Agregar al traslado'}
              >
                <Truck className="h-4 w-4" />
              </Button>
            </div>
          );})}
        </div>
      )}

      <AddDeviceModal open={addModalOpen} onOpenChange={setAddModalOpen} />

      {!isLoading && devices.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted">
          No hay equipos que coincidan con la búsqueda{needsReview ? ' (ninguno operativo con observación)' : statusFilter ? ` con estado "${deviceStatusLabel(statusFilter)}"` : categoryId ? ' en esta categoría' : ''}.
        </div>
      )}
      </div>
    </motion.div>
  );
}
