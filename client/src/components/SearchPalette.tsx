import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Package, Loader2, CornerDownLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface DeviceResult {
  id: string;
  name: string;
  brand: string;
  internalCode: string;
  serialNumber?: string | null;
  status: string;
}

interface SearchPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SearchPalette({ open, onOpenChange }: SearchPaletteProps) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery('');
      setDebounced('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: async () => {
      const { data } = await api.get('/api/devices', { params: { search: debounced, limit: 8 } });
      return data;
    },
    enabled: open && debounced.length >= 2,
  });

  const results: DeviceResult[] = data?.devices ?? [];

  const go = (id: string) => {
    onOpenChange(false);
    navigate(`/inventory/${id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onOpenChange(false);
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[activeIndex]) { e.preventDefault(); go(results[activeIndex].id); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 sm:p-4 pt-[max(8vh,env(safe-area-inset-top))] bg-black/50" onClick={() => onOpenChange(false)}>
      <div className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="h-5 w-5 text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar equipos por nombre, código o serie..."
            className="flex-1 h-14 bg-transparent text-base outline-none placeholder:text-muted"
          />
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="sm:hidden min-h-touch min-w-touch flex items-center justify-center text-sm text-muted hover:text-foreground"
          >
            Cerrar
          </button>
        </div>
        <div className="max-h-[min(55dvh,420px)] overflow-y-auto">
          {debounced.length < 2 ? (
            <p className="p-6 text-center text-sm text-muted">Escribe al menos 2 caracteres para buscar.</p>
          ) : results.length === 0 && !isFetching ? (
            <p className="p-6 text-center text-sm text-muted">Sin resultados para “{debounced}”.</p>
          ) : (
            results.map((d, i) => (
              <button
                key={d.id}
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => go(d.id)}
                className={cn(
                  'w-full text-left flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 min-h-touch',
                  i === activeIndex ? 'bg-card-hover' : 'hover:bg-card-hover'
                )}
              >
                <Package className="h-4 w-4 text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{d.name}</p>
                  <p className="text-xs text-muted truncate">{d.internalCode} · {d.brand}{d.serialNumber ? ` · ${d.serialNumber}` : ''}</p>
                </div>
                {i === activeIndex && <CornerDownLeft className="hidden sm:block h-4 w-4 text-muted shrink-0" />}
              </button>
            ))
          )}
        </div>
        <div className="hidden sm:flex px-4 py-2 border-t border-border text-xs text-muted items-center gap-4">
          <span>↑↓ navegar</span><span>↵ abrir</span><span>Esc cerrar</span>
        </div>
      </div>
    </div>
  );
}
