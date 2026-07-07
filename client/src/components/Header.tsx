import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Menu, ScanLine } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from './ui/button';
import NotificationsBell from './NotificationsBell';

interface HeaderProps {
  onMenuClick?: () => void;
  onOpenSearch?: () => void;
}

export default function Header({ onMenuClick, onOpenSearch }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onOpenSearch?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenSearch]);

  return (
    <header className="sticky top-0 z-30 flex h-14 md:h-16 items-center gap-2 md:gap-4 border-b border-border bg-background/95 px-3 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Hamburger solo móvil */}
      <button
        type="button"
        onClick={onMenuClick}
        className="md:hidden p-2 -ml-1 rounded-md hover:bg-card text-muted hover:text-foreground min-h-touch min-w-touch flex items-center justify-center"
        aria-label="Abrir menú"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Búsqueda: abre el palette global (Ctrl+K) */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        {/* Móvil: ícono lupa */}
        <button
          type="button"
          onClick={() => onOpenSearch?.()}
          className="md:hidden p-2 rounded-md hover:bg-card text-muted hover:text-foreground min-h-touch min-w-touch flex items-center justify-center"
          aria-label="Buscar"
        >
          <Search className="h-5 w-5" />
        </button>
        {/* Escritorio: barra que abre el palette */}
        <button
          type="button"
          onClick={() => onOpenSearch?.()}
          className="hidden md:flex items-center gap-2 w-full max-w-md h-10 px-3 rounded-md border border-border bg-card text-muted hover:text-foreground hover:border-primary/40 transition-colors text-left"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="text-sm flex-1">Buscar equipos por nombre, código o serie...</span>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-background">Ctrl K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/scan')}
          className="p-2 rounded-md hover:bg-card text-muted hover:text-primary min-h-touch min-w-touch flex items-center justify-center md:min-h-0 md:min-w-0"
          aria-label="Escanear equipo"
          title="Escanear equipo"
        >
          <ScanLine className="h-5 w-5" />
        </button>
        <NotificationsBell />
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-foreground" />
          </div>
          <div className="hidden sm:block min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted truncate">{user?.role}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="min-h-touch md:min-h-0">
            Salir
          </Button>
        </div>
      </div>
    </header>
  );
}
