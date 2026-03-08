import { useRef, useEffect } from 'react';
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
  /** IDs seleccionados para quitar varios a la vez */
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: () => void;
  onRemoveSelected?: () => void;
}

export default function TransferCart({
  items,
  onRemove,
  onClear,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onRemoveSelected,
}: TransferCartProps) {
  if (items.length === 0) return null;

  const hasSelection = selectedIds && selectedIds.size > 0;
  const allSelected = selectedIds && items.length > 0 && items.every((d) => selectedIds.has(d.id));
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = !!selectedIds && selectedIds.size > 0 && selectedIds.size < items.length;
  }, [selectedIds, items.length]);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card-hover/50">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <span className="font-medium">Equipos para trasladar</span>
          <span className="text-sm text-muted">({items.length})</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {onToggleSelect && (
            <>
              <label className="flex items-center gap-2 text-sm cursor-pointer min-h-touch md:min-h-0">
                <input
                  type="checkbox"
                  ref={selectAllRef}
                  checked={allSelected}
                  onChange={onSelectAll}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="text-muted">Seleccionar todo</span>
              </label>
              {hasSelection && onRemoveSelected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRemoveSelected}
                  className="text-destructive border-destructive/50 hover:bg-destructive/10 min-h-touch md:min-h-0"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Quitar ({selectedIds.size})
                </Button>
              )}
            </>
          )}
          <Button variant="ghost" size="sm" onClick={onClear} className="text-muted hover:text-destructive min-h-touch md:min-h-0">
            Vaciar carrito
          </Button>
        </div>
      </div>
      <ul className="divide-y divide-border max-h-48 overflow-y-auto">
        {items.map((d) => (
          <li
            key={d.id}
            className={`flex items-center gap-2 px-4 py-2 hover:bg-card-hover/30 ${selectedIds?.has(d.id) ? 'bg-primary/5' : ''}`}
          >
            {onToggleSelect && (
              <label className="shrink-0 cursor-pointer min-h-touch min-w-touch flex items-center justify-center md:min-h-0 md:min-w-0">
                <input
                  type="checkbox"
                  checked={selectedIds?.has(d.id) ?? false}
                  onChange={() => onToggleSelect(d.id)}
                  className="h-4 w-4 rounded border-border"
                />
              </label>
            )}
            <div className="min-w-0 flex-1">
              <span className="font-mono text-primary text-sm">{d.internalCode}</span>
              <span className="ml-2 text-sm text-foreground">{d.name}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:h-8 shrink-0 text-muted hover:text-destructive min-h-touch min-w-touch md:min-h-0 md:min-w-0"
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
