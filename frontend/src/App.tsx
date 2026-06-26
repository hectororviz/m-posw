import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { PosPage } from './pages/PosPage';
import { CategoryPage } from './pages/CategoryPage';
import { AdminLayout } from './pages/AdminLayout';
import { AdminCategoriesPage } from './pages/AdminCategoriesPage';
import { AdminProductsPage } from './pages/AdminProductsPage';
import { AdminSalesPage } from './pages/AdminSalesPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { AdminStatsPage } from './pages/AdminStatsPage';
import { AdminStockPage } from './pages/AdminStockPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
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
import { LigasLayout } from './pages/LigasLayout';
import { LigasStandingsPage } from './pages/LigasStandingsPage';
import { LigasConfigPage } from './pages/LigasConfigPage';
import { PlayersLayout } from './pages/players/PlayersLayout';
import { PlayersDashboardPage } from './pages/players';
import { PlayersPage } from './pages/players/PlayersPage';
import { CoachesPage } from './pages/players/CoachesPage';
import { PlayerCategoriesPage } from './pages/players/PlayerCategoriesPage';
import { TournamentsPage } from './pages/players/TournamentsPage';
import { PatrimonioPage } from './pages/patrimonio/PatrimonioPage';
import { BienesPage } from './pages/patrimonio/BienesPage';
import { ConfigPage } from './pages/patrimonio/ConfigPage';
import { useAuth } from './context/AuthContext';
import type { ModuleKey } from './api/types';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const ModuleRoute: React.FC<{ module: ModuleKey; children: React.ReactNode }> = ({ module, children }) => {
  const { token, user, permissions } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role === 'ADMIN') {
    return <>{children}</>;
  }
  const perm = permissions.find((p) => p.module === module);
  if (!perm || perm.access === 'HIDDEN') {
    return <Navigate to="/home" replace />;
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
        path="/home"
        element={<Navigate to="/admin/home" replace />}
      />
      <Route
        path="/pos"
        element={
          <ProtectedRoute>
            <ModuleRoute module="POS">
              <PosPage />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/admin/home" replace />} />
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
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/home" replace />} />
        <Route path="home" element={<HomePage />} />
        <Route path="categories" element={
          <ModuleRoute module="PRODUCTOS">
            <AdminCategoriesPage />
          </ModuleRoute>
        } />
        <Route path="products" element={
          <ModuleRoute module="PRODUCTOS">
            <AdminProductsPage />
          </ModuleRoute>
        } />
        <Route path="sales" element={
          <ModuleRoute module="VENTAS">
            <AdminSalesPage />
          </ModuleRoute>
        } />
        <Route path="stats" element={
          <ModuleRoute module="REPORTES">
            <AdminStatsPage />
          </ModuleRoute>
        } />
        <Route path="settings" element={
          <ModuleRoute module="CONFIGURACION">
            <AdminSettingsPage />
          </ModuleRoute>
        } />
        <Route path="users" element={
          <ModuleRoute module="CONFIGURACION">
            <AdminUsersPage />
          </ModuleRoute>
        } />
        <Route path="stock" element={
          <ModuleRoute module="PRODUCTOS">
            <AdminStockPage />
          </ModuleRoute>
        } />
        <Route path="acreedores" element={
          <ModuleRoute module="ACREEDORES">
            <AdminAcreedoresPage />
          </ModuleRoute>
        } />
        <Route path="acreedores/:id" element={
          <ModuleRoute module="ACREEDORES">
            <AdminAcreedorDetailPage />
          </ModuleRoute>
        } />
        <Route path="internet" element={
          <ModuleRoute module="INTERNET">
            <AdminInternetPage />
          </ModuleRoute>
        } />
        <Route path="ligas" element={
          <ModuleRoute module="LIGAS">
            <LigasLayout />
          </ModuleRoute>
        }>
          <Route index element={<Navigate to="/admin/ligas/configuracion" replace />} />
          <Route path=":configId" element={<LigasStandingsPage />} />
          <Route path="configuracion" element={<LigasConfigPage />} />
        </Route>
        <Route path="players" element={
          <ModuleRoute module="PLAYERS">
            <PlayersLayout />
          </ModuleRoute>
        }>
          <Route index element={<PlayersDashboardPage />} />
          <Route path="jugadores" element={<PlayersPage />} />
          <Route path="dts" element={<CoachesPage />} />
          <Route path="categorias" element={<PlayerCategoriesPage />} />
          <Route path="torneos" element={<TournamentsPage />} />
        </Route>
        <Route path="socios" element={
          <ModuleRoute module="SOCIOS">
            <AdminSociosLayout />
          </ModuleRoute>
        }>
          <Route index element={<AdminSociosPage />} />
          <Route path="matriz" element={<AdminSociosMatrizPage />} />
          <Route path="configuracion" element={<AdminSociosTiposPage />} />
          <Route path="beneficios" element={<AdminSociosBeneficiosPage />} />
        </Route>
        <Route path="contabilidad" element={<Navigate to="/admin/tesoreria" replace />} />
        <Route path="contabilidad/movimientos" element={<Navigate to="/admin/tesoreria/movimientos" replace />} />
        <Route path="contabilidad/jornadas" element={<Navigate to="/admin/tesoreria/movimientos" replace />} />
        <Route path="contabilidad/categorias" element={<Navigate to="/admin/tesoreria/cuentas" replace />} />
        <Route path="contabilidad/exportar" element={<Navigate to="/admin/tesoreria/reportes" replace />} />
        <Route path="tesoreria" element={
          <ModuleRoute module="TESORERIA">
            <TreasuryLayout />
          </ModuleRoute>
        }>
          <Route index element={<TreasurySummaryPage />} />
          <Route path="movimientos" element={<TreasuryJournalEntriesPage />} />
          <Route path="cuentas" element={<TreasuryLedgerAccountsPage />} />
          <Route path="reportes" element={<TreasuryReportsPage />} />
        </Route>
        <Route path="patrimonio" element={
          <ModuleRoute module="PATRIMONIO">
            <PatrimonioPage />
          </ModuleRoute>
        }>
          <Route index element={<Navigate to="/admin/patrimonio/bienes" replace />} />
          <Route path="bienes" element={<BienesPage />} />
          <Route path="configuracion" element={<ConfigPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
};
