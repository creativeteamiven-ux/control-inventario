import { Package, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface CartDevice {
  id: string;
  internalCode: string;
  name: string;
}

interface TransferCartProps {
  items: CartDevice[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export default function TransferCart({ items, onRemove, onClear }: TransferCartProps) {
  if (items.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-card-hover/50">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <span className="font-medium">Equipos para trasladar</span>
          <span className="text-sm text-muted">({items.length})</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} className="text-muted hover:text-destructive">
          Vaciar carrito
        </Button>
      </div>
      <ul className="divide-y divide-border max-h-48 overflow-y-auto">
        {items.map((d) => (
          <li key={d.id} className="flex items-center justify-between px-4 py-2 hover:bg-card-hover/30">
            <div>
              <span className="font-mono text-primary text-sm">{d.internalCode}</span>
              <span className="ml-2 text-sm">{d.name}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted hover:text-destructive"
              onClick={() => onRemove(d.id)}
              aria-label="Quitar del carrito"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
