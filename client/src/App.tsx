import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import Login from '@/pages/Login';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Inventory from '@/pages/Inventory';
import DeviceDetail from '@/pages/DeviceDetail';
import Categories from '@/pages/Categories';
import Maintenance from '@/pages/Maintenance';
import Loans from '@/pages/Loans';
import Movements from '@/pages/Movements';
import Locations from '@/pages/Locations';
import Reports from '@/pages/Reports';
import Users from '@/pages/Users';
import Settings from '@/pages/Settings';

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

function AppRoutes() {
  return (
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
        <Route path="categories" element={<Categories />} />
        <Route path="maintenance" element={<Maintenance />} />
        <Route path="loans" element={<Loans />} />
        <Route path="movements" element={<Movements />} />
        <Route path="locations" element={<Locations />} />
        <Route path="reports" element={<Reports />} />
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
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
