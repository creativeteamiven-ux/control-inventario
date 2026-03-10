import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Package, Pencil, QrCode } from 'lucide-react';
import EditDeviceModal from '@/components/EditDeviceModal';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { deviceStatusLabel, deviceLocationLabel } from '@/lib/statusLabels';
import { usePermissions } from '@/hooks/usePermissions';

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-500/20 text-green-400',
  MAINTENANCE: 'bg-amber-500/20 text-amber-400',
  LOANED: 'bg-blue-500/20 text-blue-400',
  DAMAGED: 'bg-red-500/20 text-red-400',
  LOST: 'bg-gray-500/20 text-gray-400',
  RETIRED: 'bg-slate-500/20 text-slate-400',
};

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const { canViewCost } = usePermissions();
  const [editOpen, setEditOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['device', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/devices/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const { data: qrData } = useQuery({
    queryKey: ['device-qr', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/devices/${id}/qr`);
      return data;
    },
    enabled: !!id,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-card rounded animate-pulse" />
        <div className="h-64 bg-card rounded animate-pulse" />
      </div>
    );
  }

  const d = data as {
    id: string;
    internalCode: string;
    name: string;
    brand: string;
    model: string;
    serialNumber?: string;
    status: string;
    location: string;
    condition: number;
    observation?: string | null;
    purchaseDate?: string;
    purchasePrice?: number;
    warrantyExpiry?: string;
    supplier?: string;
    notes?: string;
    category: { name: string };
    images: { url: string }[];
  };

  return (
    <div className="space-y-6">
      {/* Header: en móvil en dos filas para que Editar siempre sea visible */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap sm:gap-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link to="/inventory" className="shrink-0">
            <Button variant="ghost" size="icon" className="h-10 w-10 min-h-touch min-w-touch sm:min-h-0 sm:min-w-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground truncate">{d.name}</h1>
            <span className="font-mono text-sm text-primary">{d.internalCode}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('px-3 py-1.5 rounded-full text-sm font-medium shrink-0', STATUS_BADGE[d.status] ?? 'bg-muted')}>
            {deviceStatusLabel(d.status)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="min-h-touch sm:min-h-0 shrink-0"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </div>
      </div>

      <EditDeviceModal
        open={editOpen}
        onOpenChange={setEditOpen}
        device={data as { id: string; name: string; brand: string; model: string; serialNumber?: string | null; categoryId: string; status: string; location: string; purchasePrice?: number | null; supplier?: string | null; notes?: string | null; observation?: string | null; condition: number }}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="h-64 bg-card-hover flex items-center justify-center">
              {d.images?.[0]?.url ? (
                <img src={d.images[0].url} alt={d.name} className="h-full w-full object-cover" />
              ) : (
                <Package className="h-24 w-24 text-muted" />
              )}
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="font-display font-semibold text-lg mb-4">Información general</h2>
            <dl className="grid sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-muted">Marca / Modelo</dt>
                <dd className="font-medium">{d.brand} {d.model}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Número de serie</dt>
                <dd>{d.serialNumber || '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Categoría</dt>
                <dd>{d.category?.name}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Ubicación</dt>
                <dd>{deviceLocationLabel(d.location)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Condición</dt>
                <dd>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-card-hover rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          d.condition >= 70 ? 'bg-green-500' : d.condition >= 40 ? 'bg-amber-500' : 'bg-red-500'
                        )}
                        style={{ width: `${d.condition}%` }}
                      />
                    </div>
                    {d.condition}%
                  </div>
                </dd>
              </div>
              {d.observation && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted">Observación / Novedad</dt>
                  <dd className="mt-1 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    {d.observation}
                  </dd>
                </div>
              )}
              {canViewCost() && (
              <div>
                <dt className="text-sm text-muted">Precio de compra (COP)</dt>
                <dd>{d.purchasePrice != null ? `$ ${Number(d.purchasePrice).toLocaleString('es-CO')}` : '—'}</dd>
              </div>
              )}
              <div>
                <dt className="text-sm text-muted">Proveedor</dt>
                <dd>{d.supplier || '—'}</dd>
              </div>
            </dl>
            {d.notes && (
              <div className="mt-4 pt-4 border-t border-border">
                <dt className="text-sm text-muted">Notas</dt>
                <dd className="mt-1">{d.notes}</dd>
              </div>
            )}
            {/* En móvil: botón Editar también aquí para acceso rápido al final del scroll */}
            <div className="mt-6 pt-4 border-t border-border md:hidden">
              <Button
                variant="default"
                className="w-full min-h-touch"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Editar equipo
              </Button>
            </div>
          </div>
        </div>
        <div>
          <div className="bg-card rounded-xl border border-border p-6 sticky top-24">
            <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
              <QrCode className="h-5 w-5" /> Código QR
            </h2>
            {qrData?.qrCode ? (
              <div className="flex flex-col items-center">
                <img src={qrData.qrCode} alt="QR" className="w-48 h-48 rounded-lg bg-white p-2" />
                <p className="text-sm text-muted mt-2">Escanea para ver la ficha del equipo</p>
                <Button variant="outline" size="sm" className="mt-4">
                  Descargar QR
                </Button>
              </div>
            ) : (
              <p className="text-muted text-sm">Generando código QR...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
