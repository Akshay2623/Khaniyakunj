import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';

const AuthPage = lazy(() => import('./pages/AuthPage.jsx'));
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const SocietiesPage = lazy(() => import('./pages/SocietiesPage.jsx'));
const ResidentsPage = lazy(() => import('./pages/ResidentsPage.jsx'));
const ReportsPage = lazy(() => import('./pages/ReportsPage.jsx'));
const ModulePage = lazy(() => import('./pages/ModulePage.jsx'));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage.jsx'));
const ServiceRequestsPage = lazy(() => import('./pages/ServiceRequestsPage.jsx'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage.jsx'));
const MyProfilePage = lazy(() => import('./pages/MyProfilePage.jsx'));
const NoticesPage = lazy(() => import('./pages/NoticesPage.jsx'));
const VisitorManagementPage = lazy(() => import('./pages/VisitorManagementPage.jsx'));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage.jsx'));
const AmenitiesPage = lazy(() => import('./pages/AmenitiesPage.jsx'));
const LostFoundPage = lazy(() => import('./pages/LostFoundPage.jsx'));
const DomesticStaffPage = lazy(() => import('./pages/DomesticStaffPage.jsx'));
const FamilyMembersPage = lazy(() => import('./pages/FamilyMembersPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.jsx'));
const PollsPage = lazy(() => import('./pages/PollsPage.jsx'));
const UnitManagementPage = lazy(() => import('./pages/UnitManagementPage.jsx'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage.jsx'));

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
  marketplace: '/app/marketplace',
};

const MODULE_PRIORITY = [
  'dashboard',
  'societies',
  'residents',
  'amenities',
  'maintenance',
  'serviceRequests',
  'payments',
  'reports',
  'myProfile',
  'notices',
  'visitors',
  'userManagement',
  'unitManagement',
  'lostFound',
  'domesticStaff',
  'familyMembers',
  'polls',
  'marketplace',
];

function resolveLandingPath({ role, allowedModules }) {
  const normalizedRole = String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const isGuard = normalizedRole.includes('guard') || normalizedRole.includes('security');
  if (isGuard) return '/app/visitor-management';

  const ordered = MODULE_PRIORITY.filter((key) => (allowedModules || []).includes(key));
  const firstAllowedPath = ordered.map((moduleKey) => MODULE_TO_PATH[moduleKey]).find(Boolean);
  return firstAllowedPath || '/app/dashboard';
}

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
  if (!admin) return <Navigate to="/auth" replace />;

  const firstTabPath = resolveLandingPath({ role: admin?.role, allowedModules });
  return <Navigate to={firstTabPath} replace />;
}

function ProtectedRoute() {
  const { token, admin, authChecked } = useAuth();
  if (!authChecked) return <LoadingScreen />;
  return token && admin ? <Outlet /> : <Navigate to="/auth" replace />;
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
  const { token, admin, authChecked } = useAuth();
  if (!authChecked) return <LoadingScreen />;
  return token && admin ? <Navigate to="/app" replace /> : <Outlet />;
}

function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
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
            <Route path="marketplace" element={<ModuleRoute moduleKey="marketplace" element={<MarketplacePage />} />} />
            <Route
              path="settings"
              element={<ModuleRoute moduleKey="dashboard" element={<ModulePage title="Settings" description="Configure workspace preferences and policies." />} />}
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
