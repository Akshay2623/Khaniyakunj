import { Outlet } from 'react-router-dom';
import {
  FiActivity,
  FiBarChart2,
  FiClipboard,
  FiCreditCard,
  FiEye,
  FiGrid,
  FiHome,
  FiInfo,
  FiMapPin,
  FiMessageSquare,
  FiSettings,
  FiUsers,
  FiUser,
  FiShield,
  FiUserPlus,
  FiPackage,
  FiBriefcase,
} from 'react-icons/fi';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';

const moduleToSidebarItem = {
  dashboard: { to: '/app/dashboard', label: 'Dashboard', icon: FiHome },
  societies: { to: '/app/societies', label: 'Societies', icon: FiGrid },
  residents: { to: '/app/residents', label: 'Residents', icon: FiUsers },
  amenities: { to: '/app/amenities', label: 'Amenities', icon: FiMapPin },
  maintenance: { to: '/app/maintenance', label: 'Maintenance', icon: FiActivity },
  serviceRequests: { to: '/app/service-requests', label: 'Service Requests', icon: FiClipboard },
  payments: { to: '/app/payments', label: 'Payments', icon: FiCreditCard },
  reports: { to: '/app/reports', label: 'Reports', icon: FiBarChart2 },
  myProfile: { to: '/app/my-profile', label: 'My Profile', icon: FiUser },
  visitors: { to: '/app/visitor-management', label: 'Visitors', icon: FiShield },
  notices: { to: '/app/notices', label: 'Notices', icon: FiEye },
  userManagement: { to: '/app/user-management', label: 'Users', icon: FiUserPlus },
  unitManagement: { to: '/app/unit-management', label: 'Unit Management', icon: FiGrid },
  lostFound: { to: '/app/lost-found', label: 'Lost & Found', icon: FiPackage },
  domesticStaff: { to: '/app/domestic-staff', label: 'Domestic Staff', icon: FiBriefcase },
  familyMembers: { to: '/app/family-members', label: 'Family Members', icon: FiUsers },
  polls: { to: '/app/polls', label: 'Polls', icon: FiBarChart2 },
};

function DashboardLayout() {
  const { admin, logout, allowedModules } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const role = String(admin?.role || '').toLowerCase();
  const effectiveModules = [...(allowedModules || [])];
  if (!effectiveModules.includes('polls')) {
    effectiveModules.push('polls');
  }
  if (['resident', 'tenant', 'owner'].includes(role) && !effectiveModules.includes('familyMembers')) {
    effectiveModules.push('familyMembers');
  }

  const sidebarItems = effectiveModules
    .map((moduleKey) => {
      if (role === 'guard' && moduleKey === 'domesticStaff') return null;
      if (role === 'guard' && moduleKey === 'visitors') {
        return { to: '/app/visitor-management', label: 'Gate Management', icon: FiShield };
      }
      return moduleToSidebarItem[moduleKey];
    })
    .filter(Boolean);

  return (
    <Layout
      sidebarItems={sidebarItems}
      admin={admin}
      onLogout={logout}
      theme={theme}
      onToggleTheme={toggleTheme}
    >
      <Outlet />
    </Layout>
  );
}

export default DashboardLayout;
