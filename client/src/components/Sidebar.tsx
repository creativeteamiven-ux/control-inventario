import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  MapPin,
  Wrench,
  HandCoins,
  ArrowLeftRight,
  FileBarChart,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inventory', icon: Package, label: 'Inventario' },
  { to: '/categories', icon: FolderTree, label: 'Categorías' },
  { to: '/locations', icon: MapPin, label: 'Lugares' },
  { to: '/maintenance', icon: Wrench, label: 'Mantenimientos' },
  { to: '/loans', icon: HandCoins, label: 'Préstamos' },
  { to: '/movements', icon: ArrowLeftRight, label: 'Movimientos' },
  { to: '/reports', icon: FileBarChart, label: 'Reportes' },
  { to: '/users', icon: Users, label: 'Usuarios' },
  { to: '/settings', icon: Settings, label: 'Configuración' },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function NavContent({
  collapsed: _collapsed,
  showLabels,
  onItemClick,
  showLogout = false,
}: {
  collapsed: boolean;
  showLabels: boolean;
  onItemClick?: () => void;
  showLogout?: boolean;
}) {
  const { logout } = useAuth();
  return (
    <>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onItemClick}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-touch md:min-h-0',
                isActive ? 'bg-primary/20 text-primary' : 'text-muted hover:bg-card-hover hover:text-foreground',
                !showLabels && 'justify-center px-2'
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {showLabels && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      {showLogout && (
        <div className="p-2 border-t border-border shrink-0">
          <button
            type="button"
            onClick={() => {
              onItemClick?.();
              logout();
            }}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full min-h-touch text-muted hover:bg-card-hover hover:text-destructive transition-colors'
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span>Salir</span>
          </button>
        </div>
      )}
    </>
  );
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const closeMobile = () => onMobileClose?.();

  const headerContent = (options: { showClose?: boolean; showCollapse?: boolean; labels: boolean }) => (
    <div className="flex h-16 items-center justify-between px-4 border-b border-border shrink-0">
      {options.labels ? (
        <div className="flex items-center gap-2 min-w-0">
<img src="/img/logo-dfp-records.png" alt="The Warehouse" className="h-8 w-auto max-h-8 object-contain shrink-0" />
            <span className="font-display font-bold text-lg text-foreground truncate">The Warehouse</span>
        </div>
      ) : (
        <img src="/img/logo-dfp-records.png" alt="The Warehouse" className="h-8 w-auto max-h-8 object-contain shrink-0" />
      )}
      <div className="flex items-center gap-1">
        {options.showClose && (
          <button
            type="button"
            onClick={closeMobile}
            className="p-2 rounded-md hover:bg-card-hover text-muted hover:text-foreground min-h-touch min-w-touch flex items-center justify-center"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        {options.showCollapse && (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-2 rounded-md hover:bg-card-hover text-muted hover:text-foreground"
            aria-label={collapsed ? 'Expandir' : 'Colapsar'}
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Móvil: overlay + drawer */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Cerrar menú"
        onClick={closeMobile}
        onKeyDown={(e) => e.key === 'Enter' && closeMobile()}
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity md:hidden',
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      />
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-[260px] max-w-[85vw] flex flex-col bg-card border-r border-border transition-transform duration-300 ease-out md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {headerContent({ showClose: true, showCollapse: false, labels: true })}
        <NavContent collapsed={false} showLabels={true} onItemClick={closeMobile} showLogout />
      </aside>

      {/* Tablet + Desktop: sidebar fijo (oculto en móvil) */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-card border-r border-border transition-all duration-300 shrink-0',
          'md:w-[72px]',
          'lg:w-[260px]',
          collapsed && 'lg:w-[72px]'
        )}
      >
        {headerContent({ showClose: false, showCollapse: true, labels: !collapsed })}
        <NavContent
          collapsed={collapsed}
          showLabels={!collapsed}
          onItemClick={undefined}
        />
      </aside>
    </>
  );
}
