import { Suspense } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import Login from '@/pages/Login';
import Layout from '@/components/Layout';

const Dashboard = lazyWithRetry(() => import('@/pages/Dashboard'));
const Inventory = lazyWithRetry(() => import('@/pages/Inventory'));
const DeviceDetail = lazyWithRetry(() => import('@/pages/DeviceDetail'));
const Scanner = lazyWithRetry(() => import('@/pages/Scanner'));
const Categories = lazyWithRetry(() => import('@/pages/Categories'));
const Maintenance = lazyWithRetry(() => import('@/pages/Maintenance'));
const Loans = lazyWithRetry(() => import('@/pages/Loans'));
const Movements = lazyWithRetry(() => import('@/pages/Movements'));
const Locations = lazyWithRetry(() => import('@/pages/Locations'));
const Reports = lazyWithRetry(() => import('@/pages/Reports'));
const Expenses = lazyWithRetry(() => import('@/pages/Expenses'));
const Budgets = lazyWithRetry(() => import('@/pages/Budgets'));
const Users = lazyWithRetry(() => import('@/pages/Users'));
const Settings = lazyWithRetry(() => import('@/pages/Settings'));
const Audit = lazyWithRetry(() => import('@/pages/Audit'));
const Trash = lazyWithRetry(() => import('@/pages/Trash'));
const Events = lazyWithRetry(() => import('@/pages/Events'));
const EventDetail = lazyWithRetry(() => import('@/pages/EventDetail'));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted">Cargando...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function PermissionRoute({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user?.permissions?.includes(permission)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function RoleRoute({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// Los QR generados apuntan a /device/:id; redirigimos a la ficha del inventario.
function DeviceRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/inventory/${id}`} replace />;
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-pulse text-muted">Cargando...</div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route
          path="inventory"
          element={
            <PermissionRoute permission="inventory.view">
              <Inventory />
            </PermissionRoute>
          }
        />
        <Route
          path="inventory/:id"
          element={
            <PermissionRoute permission="inventory.view">
              <DeviceDetail />
            </PermissionRoute>
          }
        />
        <Route
          path="trash"
          element={
            <PermissionRoute permission="inventory.delete">
              <Trash />
            </PermissionRoute>
          }
        />
        <Route path="scan" element={<Scanner />} />
        <Route path="device/:id" element={<DeviceRedirect />} />
        <Route
          path="categories"
          element={
            <PermissionRoute permission="categories.view">
              <Categories />
            </PermissionRoute>
          }
        />
        <Route
          path="maintenance"
          element={
            <PermissionRoute permission="maintenance.view">
              <Maintenance />
            </PermissionRoute>
          }
        />
        <Route
          path="loans"
          element={
            <PermissionRoute permission="loans.view">
              <Loans />
            </PermissionRoute>
          }
        />
        <Route
          path="movements"
          element={
            <PermissionRoute permission="movements.view">
              <Movements />
            </PermissionRoute>
          }
        />
        <Route
          path="events"
          element={
            <PermissionRoute permission="events.view">
              <Events />
            </PermissionRoute>
          }
        />
        <Route
          path="events/:id"
          element={
            <PermissionRoute permission="events.view">
              <EventDetail />
            </PermissionRoute>
          }
        />
        <Route path="locations" element={<Locations />} />
        <Route
          path="reports"
          element={
            <PermissionRoute permission="reports.view">
              <Reports />
            </PermissionRoute>
          }
        />
        <Route
          path="expenses"
          element={
            <PermissionRoute permission="finance.view">
              <Expenses />
            </PermissionRoute>
          }
        />
        <Route
          path="budgets"
          element={
            <PermissionRoute permission="finance.view">
              <Budgets />
            </PermissionRoute>
          }
        />
        <Route
          path="users"
          element={
            <PermissionRoute permission="users.view">
              <Users />
            </PermissionRoute>
          }
        />
        <Route
          path="settings"
          element={
            <AdminRoute>
              <Settings />
            </AdminRoute>
          }
        />
        <Route
          path="audit"
          element={
            <RoleRoute roles={['ADMIN', 'MANAGER']}>
              <Audit />
            </RoleRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
