import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import AuthPage from './pages/AuthPage.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SocietiesPage from './pages/SocietiesPage.jsx';
import ResidentsPage from './pages/ResidentsPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import ModulePage from './pages/ModulePage.jsx';
import MaintenancePage from './pages/MaintenancePage.jsx';
import ServiceRequestsPage from './pages/ServiceRequestsPage.jsx';
import PaymentsPage from './pages/PaymentsPage.jsx';
import MyProfilePage from './pages/MyProfilePage.jsx';
import NoticesPage from './pages/NoticesPage.jsx';
import VisitorManagementPage from './pages/VisitorManagementPage.jsx';
import UserManagementPage from './pages/UserManagementPage.jsx';
import AmenitiesPage from './pages/AmenitiesPage.jsx';
import LostFoundPage from './pages/LostFoundPage.jsx';
import DomesticStaffPage from './pages/DomesticStaffPage.jsx';
import FamilyMembersPage from './pages/FamilyMembersPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import PollsPage from './pages/PollsPage.jsx';
import UnitManagementPage from './pages/UnitManagementPage.jsx';

const MODULE_TO_PATH = {
  dashboard: '/app/dashboard',
  societies: '/app/societies',
  residents: '/app/residents',
  amenities: '/app/amenities',
  maintenance: '/app/maintenance',
  serviceRequests: '/app/service-requests',
  payments: '/app/payments',
  reports: '/app/reports',
  myProfile: '/app/my-profile',
  notices: '/app/notices',
  visitors: '/app/visitor-management',
  userManagement: '/app/user-management',
  unitManagement: '/app/unit-management',
  lostFound: '/app/lost-found',
  domesticStaff: '/app/domestic-staff',
  familyMembers: '/app/family-members',
  polls: '/app/polls',
};

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-600 shadow-panel dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        Loading workspace...
      </div>
    </div>
  );
}

function AppLanding() {
  const { token, authChecked, allowedModules, admin } = useAuth();
  if (!authChecked) return <LoadingScreen />;
  if (!token) return <Navigate to="/auth" replace />;

  const role = String(admin?.role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const roleLooksGuard = role.includes('guard') || role.includes('security');
  if (['admin', 'super_admin', 'committee', 'tenant', 'resident', 'owner'].includes(role)) {
    return <Navigate to="/app/dashboard" replace />;
  }
  if (roleLooksGuard) {
    return <Navigate to="/app/visitor-management" replace />;
  }

  const firstAllowedPath = (allowedModules || [])
    .map((moduleKey) => MODULE_TO_PATH[moduleKey])
    .find(Boolean);

  return <Navigate to={firstAllowedPath || '/app/dashboard'} replace />;
}

function ProtectedRoute() {
  const { token, authChecked } = useAuth();
  if (!authChecked) return <LoadingScreen />;
  return token ? <Outlet /> : <Navigate to="/auth" replace />;
}

function ModuleRoute({ moduleKey, element }) {
  const { allowedModules, authChecked, admin } = useAuth();
  if (!authChecked) return <LoadingScreen />;
  const role = String(admin?.role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (moduleKey === 'dashboard' && ['admin', 'super_admin', 'committee', 'tenant', 'resident', 'owner'].includes(role)) {
    return element;
  }
  if ((allowedModules || []).includes(moduleKey)) return element;
  return <Navigate to="/app" replace />;
}

function PublicRoute() {
  const { token, authChecked } = useAuth();
  if (!authChecked) return <LoadingScreen />;
  return token ? <Navigate to="/app" replace /> : <Outlet />;
}

function App() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/auth" element={<AuthPage />} />
      </Route>
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<DashboardLayout />}>
          <Route index element={<AppLanding />} />
          <Route path="dashboard" element={<ModuleRoute moduleKey="dashboard" element={<DashboardPage />} />} />
          <Route path="societies" element={<ModuleRoute moduleKey="societies" element={<SocietiesPage />} />} />
          <Route path="residents" element={<ModuleRoute moduleKey="residents" element={<ResidentsPage />} />} />
          <Route path="amenities" element={<ModuleRoute moduleKey="amenities" element={<AmenitiesPage />} />} />
          <Route path="maintenance" element={<ModuleRoute moduleKey="maintenance" element={<MaintenancePage />} />} />
          <Route path="service-requests" element={<ModuleRoute moduleKey="serviceRequests" element={<ServiceRequestsPage />} />} />
          <Route path="payments" element={<ModuleRoute moduleKey="payments" element={<PaymentsPage />} />} />
          <Route path="reports" element={<ModuleRoute moduleKey="reports" element={<ReportsPage />} />} />
          <Route path="my-profile" element={<ModuleRoute moduleKey="myProfile" element={<MyProfilePage />} />} />
          <Route path="notices" element={<ModuleRoute moduleKey="notices" element={<NoticesPage />} />} />
          <Route path="visitor-management" element={<ModuleRoute moduleKey="visitors" element={<VisitorManagementPage />} />} />
          <Route path="user-management" element={<ModuleRoute moduleKey="userManagement" element={<UserManagementPage />} />} />
          <Route path="unit-management" element={<ModuleRoute moduleKey="unitManagement" element={<UnitManagementPage />} />} />
          <Route path="lost-found" element={<ModuleRoute moduleKey="lostFound" element={<LostFoundPage />} />} />
          <Route path="domestic-staff" element={<ModuleRoute moduleKey="domesticStaff" element={<DomesticStaffPage />} />} />
          <Route path="family-members" element={<ModuleRoute moduleKey="familyMembers" element={<FamilyMembersPage />} />} />
          <Route path="polls" element={<ModuleRoute moduleKey="polls" element={<PollsPage />} />} />
          <Route
            path="settings"
            element={<ModuleRoute moduleKey="dashboard" element={<ModulePage title="Settings" description="Configure workspace preferences and policies." />} />}
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

export default App;
