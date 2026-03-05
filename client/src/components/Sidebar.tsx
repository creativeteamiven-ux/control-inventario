import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Wrench,
  HandCoins,
  ArrowLeftRight,
  FileBarChart,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inventory', icon: Package, label: 'Inventario' },
  { to: '/categories', icon: FolderTree, label: 'Categorías' },
  { to: '/maintenance', icon: Wrench, label: 'Mantenimientos' },
  { to: '/loans', icon: HandCoins, label: 'Préstamos' },
  { to: '/movements', icon: ArrowLeftRight, label: 'Movimientos' },
  { to: '/reports', icon: FileBarChart, label: 'Reportes' },
  { to: '/users', icon: Users, label: 'Usuarios' },
  { to: '/settings', icon: Settings, label: 'Configuración' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'flex flex-col bg-card border-r border-border transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        {collapsed ? (
          <img
            src="/img/logo-dfp-records.png"
            alt="DFP RECORDS"
            className="h-8 w-auto max-h-8 object-contain shrink-0"
          />
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/img/logo-dfp-records.png"
              alt="DFP RECORDS"
              className="h-8 w-auto max-h-8 object-contain shrink-0"
            />
            <span className="font-display font-bold text-lg text-foreground truncate">DFP RECORDS</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-md hover:bg-card-hover text-muted hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-primary/20 text-primary' : 'text-muted hover:bg-card-hover hover:text-foreground',
                collapsed && 'justify-center px-2'
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
