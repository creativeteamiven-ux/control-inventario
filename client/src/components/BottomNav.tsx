import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Wrench,
  HandCoins,
  MoreHorizontal,
  FolderTree,
  ArrowLeftRight,
  FileBarChart,
  Users,
  Settings,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const mainNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inventory', icon: Package, label: 'Inventario' },
  { to: '/categories', icon: FolderTree, label: 'Categorías' },
  { to: '/loans', icon: HandCoins, label: 'Préstamos' },
  { to: '/maintenance', icon: Wrench, label: 'Mantenimiento' },
  { to: '#more', icon: MoreHorizontal, label: 'Más' },
];

const moreNavGroups: { title: string; items: { to: string; icon: typeof FolderTree; label: string }[] }[] = [
  {
    title: 'Inventario y operación',
    items: [
      { to: '/movements', icon: ArrowLeftRight, label: 'Movimientos' },
      { to: '/reports', icon: FileBarChart, label: 'Reportes' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { to: '/users', icon: Users, label: 'Usuarios' },
      { to: '/settings', icon: Settings, label: 'Configuración' },
    ],
  },
];

export default function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const isInventory = location.pathname === '/inventory' || location.pathname.startsWith('/inventory/');
  const isMoreActive = moreNavGroups.some((g) => g.items.some((item) => location.pathname === item.to));

  const closeMore = () => setMoreOpen(false);

  return (
    <>
      {/* Bottom sheet "Más" — solo en módulo Inventario */}
      {isInventory && (
        <>
          <div
            role="button"
            tabIndex={0}
            aria-label="Cerrar"
            className={cn(
              'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity md:hidden',
              moreOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
            onClick={closeMore}
            onKeyDown={(e) => e.key === 'Enter' && closeMore()}
          />
          <div
            className={cn(
              'fixed bottom-20 left-0 right-0 z-50 max-h-[85vh] rounded-t-2xl bg-card border-t border-border shadow-2xl transition-transform duration-300 ease-out md:hidden overflow-hidden flex flex-col',
              moreOpen ? 'translate-y-0' : 'translate-y-full'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 pt-2 pb-1 flex justify-center">
              <div className="w-10 h-1 rounded-full bg-muted" aria-hidden />
            </div>
            <div className="shrink-0 px-4 pb-3 flex items-center justify-between relative z-10 bg-card">
              <h2 className="text-lg font-semibold text-foreground">Más secciones</h2>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  closeMore();
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  closeMore();
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                className="p-3 -mr-2 rounded-xl hover:bg-card-hover active:bg-card-hover text-muted hover:text-foreground min-h-touch min-w-touch flex items-center justify-center touch-manipulation select-none"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
        <nav className="overflow-y-auto flex-1 min-h-0 px-4 pb-8 safe-area-pb">
          {moreNavGroups.map((group) => (
            <div key={group.title} className="mb-6">
              <p className="text-xs font-medium text-muted uppercase tracking-wider px-1 mb-2">
                {group.title}
              </p>
              <div className="space-y-1 rounded-xl overflow-hidden bg-card-hover/30 border border-border/50">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={closeMore}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-4 py-3.5 min-h-touch text-foreground rounded-lg transition-colors',
                        isActive ? 'bg-primary/20 text-primary' : 'hover:bg-card-hover active:bg-card-hover'
                      )
                    }
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
          </div>
        </>
      )}

      {/* Barra inferior fija */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur md:hidden safe-area-pb"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
      >
        {mainNav.map((item) => {
          if (item.to === '#more') {
            if (!isInventory) return null;
            return (
              <button
                key="more"
                type="button"
                onClick={() => setMoreOpen(true)}
                className={cn(
                  'flex flex-col items-center justify-center min-w-[56px] min-h-touch py-2 text-xs font-medium transition-colors',
                  isMoreActive ? 'text-primary border-t-2 border-primary' : 'text-muted'
                )}
              >
                <item.icon className="h-6 w-6 mb-0.5" />
                <span>{item.label}</span>
              </button>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center min-w-[56px] min-h-touch py-2 text-xs font-medium transition-colors border-t-2 border-transparent',
                  isActive ? 'text-primary border-primary' : 'text-muted'
                )
              }
            >
              <item.icon className="h-6 w-6 mb-0.5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
