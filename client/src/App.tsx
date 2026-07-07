import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import Login from '@/pages/Login';
import Layout from '@/components/Layout';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Inventory = lazy(() => import('@/pages/Inventory'));
const DeviceDetail = lazy(() => import('@/pages/DeviceDetail'));
const Scanner = lazy(() => import('@/pages/Scanner'));
const Categories = lazy(() => import('@/pages/Categories'));
const Maintenance = lazy(() => import('@/pages/Maintenance'));
const Loans = lazy(() => import('@/pages/Loans'));
const Movements = lazy(() => import('@/pages/Movements'));
const Locations = lazy(() => import('@/pages/Locations'));
const Reports = lazy(() => import('@/pages/Reports'));
const Expenses = lazy(() => import('@/pages/Expenses'));
const Budgets = lazy(() => import('@/pages/Budgets'));
const Users = lazy(() => import('@/pages/Users'));
const Settings = lazy(() => import('@/pages/Settings'));

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
        <Route path="inventory" element={<Inventory />} />
        <Route path="inventory/:id" element={<DeviceDetail />} />
        <Route path="scan" element={<Scanner />} />
        <Route path="device/:id" element={<DeviceRedirect />} />
        <Route path="categories" element={<Categories />} />
        <Route path="maintenance" element={<Maintenance />} />
        <Route path="loans" element={<Loans />} />
        <Route path="movements" element={<Movements />} />
        <Route path="locations" element={<Locations />} />
        <Route path="reports" element={<Reports />} />
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
            <AdminRoute>
              <Users />
            </AdminRoute>
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
