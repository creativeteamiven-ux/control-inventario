import { useState, useEffect } from 'react';
import { Search, Bell, User, Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick?: () => void;
  searchOpen?: boolean;
  onSearchToggle?: (open: boolean) => void;
}

export default function Header({ onMenuClick, searchOpen = false, onSearchToggle }: HeaderProps) {
  const { user, logout } = useAuth();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSearchToggle?.(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSearchToggle]);

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

      {/* Búsqueda: en móvil puede ser ícono que expande */}
      <div className={cn('flex-1 flex items-center gap-2 min-w-0', searchOpen && 'md:max-w-md')}>
        {/* Móvil: ícono lupa que expande a full-width */}
        {!searchOpen && (
          <button
            type="button"
            onClick={() => onSearchToggle?.(true)}
            className="md:hidden p-2 rounded-md hover:bg-card text-muted hover:text-foreground min-h-touch min-w-touch flex items-center justify-center"
            aria-label="Buscar"
          >
            <Search className="h-5 w-5" />
          </button>
        )}
        <div
          className={cn(
            'relative flex-1 max-w-md transition-all',
            searchOpen ? 'w-full' : 'hidden md:block'
          )}
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted pointer-events-none" />
          <Input
            placeholder="Buscar equipos, categorías... (Ctrl+K)"
            className="pl-9 bg-card min-h-[44px] md:min-h-0 text-base"
            onFocus={() => onSearchToggle?.(true)}
            onBlur={() => onSearchToggle?.(false)}
          />
          {searchOpen && (
            <button
              type="button"
              onClick={() => onSearchToggle?.(false)}
              className="md:hidden absolute right-2 top-1/2 -translate-y-1/2 text-muted text-sm"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        <button
          type="button"
          className="relative p-2 rounded-md hover:bg-card text-muted hover:text-foreground min-h-touch min-w-touch flex items-center justify-center md:min-h-0 md:min-w-0"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
        </button>
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-foreground" />
          </div>
          <div className="hidden sm:block min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted truncate">{user?.role}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="hidden sm:inline-flex">
            Salir
          </Button>
        </div>
      </div>
    </header>
  );
}
