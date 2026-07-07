import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  link: string;
}

interface AlertsResponse {
  count: number;
  bySeverity: { critical: number; warning: number; info: number };
  alerts: Alert[];
}

const SEVERITY_ICON = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_COLOR = {
  critical: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data } = useQuery<AlertsResponse>({
    queryKey: ['alerts'],
    queryFn: async () => {
      const { data } = await api.get('/api/alerts');
      return data;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const count = data?.count ?? 0;
  const hasCritical = (data?.bySeverity.critical ?? 0) > 0;
  const alerts = data?.alerts ?? [];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-md hover:bg-card text-muted hover:text-foreground min-h-touch min-w-touch flex items-center justify-center md:min-h-0 md:min-w-0"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center',
              hasCritical ? 'bg-red-500' : 'bg-amber-500'
            )}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[340px] max-w-[90vw] bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-sm">Notificaciones {count > 0 && `(${count})`}</h3>
            <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">No hay alertas pendientes ✅</p>
            ) : (
              alerts.slice(0, 50).map((a) => {
                const Icon = SEVERITY_ICON[a.severity];
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { setOpen(false); navigate(a.link); }}
                    className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-card-hover border-b border-border last:border-0"
                  >
                    <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', SEVERITY_COLOR[a.severity])} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{a.title}</p>
                      <p className="text-xs text-muted truncate">{a.message}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
