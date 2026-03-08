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
} from 'lucide-react';
import { cn } from '@/lib/utils';

const mainNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inventory', icon: Package, label: 'Inventario' },
  { to: '/loans', icon: HandCoins, label: 'Préstamos' },
  { to: '/maintenance', icon: Wrench, label: 'Mantenimiento' },
  { to: '#more', icon: MoreHorizontal, label: 'Más' },
];

const moreNav = [
  { to: '/categories', icon: FolderTree, label: 'Categorías' },
  { to: '/movements', icon: ArrowLeftRight, label: 'Movimientos' },
  { to: '/reports', icon: FileBarChart, label: 'Reportes' },
  { to: '/users', icon: Users, label: 'Usuarios' },
  { to: '/settings', icon: Settings, label: 'Configuración' },
];

export default function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const isMoreActive = moreNav.some((item) => location.pathname === item.to);

  return (
    <>
      {/* Bottom sheet "Más" */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Cerrar"
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden',
          moreOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setMoreOpen(false)}
        onKeyDown={(e) => e.key === 'Enter' && setMoreOpen(false)}
      />
      <div
        className={cn(
          'fixed bottom-20 left-0 right-0 z-50 max-h-[70vh] rounded-t-2xl bg-card border-t border-border shadow-xl transition-transform duration-300 ease-out md:hidden overflow-hidden',
          moreOpen ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="p-2 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-muted" aria-hidden />
        </div>
        <p className="px-4 pb-2 text-sm font-medium text-muted">Más secciones</p>
        <nav className="overflow-y-auto pb-6 safe-area-pb">
          {moreNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 min-h-touch text-foreground',
                  isActive ? 'bg-primary/20 text-primary' : 'text-muted hover:bg-card-hover'
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Barra inferior fija */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur md:hidden safe-area-pb"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
      >
        {mainNav.map((item) => {
          if (item.to === '#more') {
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
