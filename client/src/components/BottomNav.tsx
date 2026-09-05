import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ScanLine,
  CalendarDays,
  ArrowLeftRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

const mainNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Inicio', perm: undefined as string | undefined },
  { to: '/inventory', icon: Package, label: 'Inventario', perm: 'inventory.view' },
  { to: '/scan', icon: ScanLine, label: 'Escanear', highlight: true, perm: undefined },
  { to: '/events', icon: CalendarDays, label: 'Eventos', perm: 'events.view' },
  { to: '/movements', icon: ArrowLeftRight, label: 'Movim.', perm: 'movements.view' },
];

export default function BottomNav() {
  const { hasPermission } = usePermissions();
  const items = mainNav.filter((item) => !item.perm || hasPermission(item.perm));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-end justify-around gap-0.5 border-t border-border bg-card/95 backdrop-blur md:hidden px-1 pt-1"
      style={{
        paddingBottom: 'max(var(--safe-bottom), 0.4rem)',
        minHeight: 'calc(var(--bottom-nav-h) + var(--safe-bottom))',
      }}
      aria-label="Navegación principal"
    >
      {items.map((item) =>
        item.highlight ? (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex flex-col items-center justify-center min-w-[3.5rem] -mt-4 no-touch-target"
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-full shadow-lg ring-4 ring-background transition-colors',
                    isActive ? 'bg-primary text-primary-foreground' : 'bg-primary/90 text-primary-foreground'
                  )}
                >
                  <item.icon className="h-6 w-6" />
                </span>
                <span className={cn('text-[10px] font-medium mt-0.5', isActive ? 'text-primary' : 'text-muted')}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ) : (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center min-w-[3.25rem] min-h-[2.75rem] py-1.5 text-[10px] font-medium transition-colors no-touch-target',
                isActive ? 'text-primary' : 'text-muted'
              )
            }
          >
            <item.icon className="h-5 w-5 mb-0.5" />
            <span className="leading-tight">{item.label}</span>
          </NavLink>
        )
      )}
    </nav>
  );
}
