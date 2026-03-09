import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Wrench,
  HandCoins,
  FolderTree,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const mainNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inventory', icon: Package, label: 'Inventario' },
  { to: '/categories', icon: FolderTree, label: 'Categorías' },
  { to: '/loans', icon: HandCoins, label: 'Préstamos' },
  { to: '/maintenance', icon: Wrench, label: 'Mantenimiento' },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur md:hidden safe-area-pb"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
    >
      {mainNav.map((item) => (
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
      ))}
    </nav>
  );
}
