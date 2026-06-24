import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ScanLine,
  Wrench,
  HandCoins,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const mainNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inventory', icon: Package, label: 'Inventario' },
  { to: '/scan', icon: ScanLine, label: 'Escanear', highlight: true },
  { to: '/loans', icon: HandCoins, label: 'Préstamos' },
  { to: '/maintenance', icon: Wrench, label: 'Mantenimiento' },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur md:hidden safe-area-pb"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
    >
      {mainNav.map((item) =>
        item.highlight ? (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex flex-col items-center justify-center min-w-[56px] -mt-5"
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
                <span className={cn('text-[11px] font-medium mt-0.5', isActive ? 'text-primary' : 'text-muted')}>
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
                'flex flex-col items-center justify-center min-w-[56px] min-h-touch py-2 text-xs font-medium transition-colors border-t-2 border-transparent',
                isActive ? 'text-primary border-primary' : 'text-muted'
              )
            }
          >
            <item.icon className="h-6 w-6 mb-0.5" />
            <span>{item.label}</span>
          </NavLink>
        )
      )}
    </nav>
  );
}
