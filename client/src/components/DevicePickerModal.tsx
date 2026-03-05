import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import type { CartDevice } from './TransferCart';

interface DevicePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartIds: string[];
  onAdd: (devices: CartDevice[]) => void;
}

export default function DevicePickerModal({ open, onOpenChange, cartIds, onAdd }: DevicePickerModalProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['devices', 'picker', search],
    queryFn: async () => {
      const { data } = await api.get('/api/devices', {
        params: { search: search || undefined, page: 1, limit: 100 },
      });
      return data;
    },
    enabled: open,
  });

  const devices = (data?.devices ?? []) as { id: string; internalCode: string; name: string }[];
  const alreadyInCart = new Set(cartIds);

  const toggle = (d: { id: string; internalCode: string; name: string }) => {
    if (alreadyInCart.has(d.id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(d.id)) next.delete(d.id);
      else next.add(d.id);
      return next;
    });
  };

  const handleAdd = () => {
    const toAdd = devices.filter((d) => selected.has(d.id)).map((d) => ({ id: d.id, internalCode: d.internalCode, name: d.name }));
    onAdd(toAdd);
    setSelected(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Agregar equipos al traslado</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Buscar por nombre, marca, modelo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <ul className="flex-1 overflow-y-auto border border-border rounded-md divide-y divide-border min-h-[200px]">
            {isLoading ? (
              <li className="p-6 text-center text-muted">Cargando...</li>
            ) : devices.length === 0 ? (
              <li className="p-6 text-center text-muted">No hay equipos</li>
            ) : (
              devices.map((d) => {
                const inCart = alreadyInCart.has(d.id);
                const checked = selected.has(d.id);
                return (
                  <li
                    key={d.id}
                    className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                      inCart ? 'opacity-50 cursor-not-allowed bg-muted/30' : checked ? 'bg-primary/10' : 'hover:bg-card-hover'
                    }`}
                    onClick={() => !inCart && toggle(d)}
                  >
                    <div
                      className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${
                        inCart ? 'border-muted' : checked ? 'border-primary bg-primary' : 'border-muted-foreground'
                      }`}
                    >
                      {inCart ? (
                        <span className="text-xs text-muted">✓</span>
                      ) : checked ? (
                        <Plus className="h-3 w-3 text-primary-foreground" />
                      ) : null}
                    </div>
                    <span className="font-mono text-sm text-primary">{d.internalCode}</span>
                    <span className="text-sm truncate">{d.name}</span>
                    {inCart && <span className="text-xs text-muted ml-auto">En carrito</span>}
                  </li>
                );
              })
            )}
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAdd} disabled={selected.size === 0}>
            Agregar {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
