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
import { AdminAcreedoresPage } from './pages/AdminAcreedoresPage';
import { AdminAcreedorDetailPage } from './pages/AdminAcreedorDetailPage';
import { AdminInternetPage } from './pages/AdminInternetPage';
import { AdminSociosLayout } from './pages/AdminSociosLayout';
import { AdminSociosTiposPage } from './pages/AdminSociosTiposPage';
import { AdminSociosPage } from './pages/AdminSociosPage';
import { AdminSociosMatrizPage } from './pages/AdminSociosMatrizPage';
import { AdminSociosBeneficiosPage } from './pages/AdminSociosBeneficiosPage';
import { TreasurySummaryPage } from './pages/TreasurySummaryPage';
import { TreasuryJournalEntriesPage } from './pages/TreasuryJournalEntriesPage';
import { TreasuryLedgerAccountsPage } from './pages/TreasuryLedgerAccountsPage';
import { TreasuryReportsPage } from './pages/TreasuryReportsPage';
import { TreasuryLayout } from './pages/TreasuryLayout';
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
        <Route path="acreedores" element={<AdminAcreedoresPage />} />
        <Route path="acreedores/:id" element={<AdminAcreedorDetailPage />} />
        <Route path="internet" element={<AdminInternetPage />} />
        <Route path="socios" element={<AdminSociosLayout />}>
          <Route index element={<AdminSociosPage />} />
          <Route path="matriz" element={<AdminSociosMatrizPage />} />
          <Route path="configuracion" element={<AdminSociosTiposPage />} />
          <Route path="beneficios" element={<AdminSociosBeneficiosPage />} />
        </Route>
        <Route path="users" element={<Navigate to="/admin/settings" replace />} />
        <Route path="contabilidad" element={<Navigate to="/admin/tesoreria" replace />} />
        <Route path="contabilidad/movimientos" element={<Navigate to="/admin/tesoreria/movimientos" replace />} />
        <Route path="contabilidad/jornadas" element={<Navigate to="/admin/tesoreria/movimientos" replace />} />
        <Route path="contabilidad/categorias" element={<Navigate to="/admin/tesoreria/cuentas" replace />} />
        <Route path="contabilidad/exportar" element={<Navigate to="/admin/tesoreria/reportes" replace />} />
        <Route path="tesoreria" element={<TreasuryLayout />}>
          <Route index element={<TreasurySummaryPage />} />
          <Route path="movimientos" element={<TreasuryJournalEntriesPage />} />
          <Route path="cuentas" element={<TreasuryLedgerAccountsPage />} />
          <Route path="reportes" element={<TreasuryReportsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
