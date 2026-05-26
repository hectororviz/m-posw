import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { CategoryPage } from './pages/CategoryPage';
import { AdminLayout } from './pages/AdminLayout';
import { AdminCategoriesPage } from './pages/AdminCategoriesPage';
import { AdminProductsPage } from './pages/AdminProductsPage';
import { AdminSalesPage } from './pages/AdminSalesPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { AdminStatsPage } from './pages/AdminStatsPage';
import { AdminStockPage } from './pages/AdminStockPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AccountingDashboard } from './pages/AccountingDashboard';
import { AccountingMovementsPage } from './pages/AccountingMovementsPage';
import { AccountingJornadasPage } from './pages/AccountingJornadasPage';
import { AccountingCategoriesPage } from './pages/AccountingCategoriesPage';
import { AccountingExportPage } from './pages/AccountingExportPage';
import { CheckoutPaymentPage } from './pages/CheckoutPaymentPage';
import { CheckoutQrPage } from './pages/CheckoutQrPage';
import { OAuthReturnPage } from './pages/OAuthReturnPage';
import { PrintTicketPage } from './pages/PrintTicketPage';
import { SalesPage } from './pages/SalesPage';
import { useAuth } from './context/AuthContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/oauth-return" element={<OAuthReturnPage />} />
      <Route path="/print/ticket" element={<PrintTicketPage />} />
      <Route path="/printticket" element={<PrintTicketPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/category/:id"
        element={
          <ProtectedRoute>
            <CategoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkout/payment"
        element={
          <ProtectedRoute>
            <CheckoutPaymentPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkout/qr/:saleId"
        element={
          <ProtectedRoute>
            <CheckoutQrPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales"
        element={
          <ProtectedRoute>
            <SalesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/sales" replace />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="sales" element={<AdminSalesPage />} />
        <Route path="stats" element={<AdminStatsPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="stock" element={<AdminStockPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="contabilidad" element={<AccountingDashboard />} />
        <Route path="contabilidad/movimientos" element={<AccountingMovementsPage />} />
        <Route path="contabilidad/jornadas" element={<AccountingJornadasPage />} />
        <Route path="contabilidad/categorias" element={<AccountingCategoriesPage />} />
        <Route path="contabilidad/exportar" element={<AccountingExportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
