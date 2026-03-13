import { AnimatePresence, motion } from 'framer-motion';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  FiBell,
  FiAlertTriangle,
  FiCheck,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiEyeOff,
  FiHome,
  FiLogOut,
  FiLock,
  FiMoon,
  FiSend,
  FiSun,
  FiX,
} from 'react-icons/fi';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import BrandLogo from './auth/BrandLogo.jsx';
import { API_BASE_URL } from '../lib/apiBase.js';

function Layout({ sidebarItems, admin, onLogout, theme, onToggleTheme, children }) {
  const { apiRequest, token } = useAuth();
  const { showToast } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [noticeForm, setNoticeForm] = useState({ title: '', description: '' });
  const [sendingNotice, setSendingNotice] = useState(false);
  const [showNoticeComposer, setShowNoticeComposer] = useState(false);
  const [composerMode, setComposerMode] = useState('notice');
  const [sendingAlert, setSendingAlert] = useState(false);
  const [alertHistory, setAlertHistory] = useState([]);
  const [alertForm, setAlertForm] = useState({
    title: '',
    message: '',
    priority: 'Normal',
    startDate: '',
    endDate: '',
    targetRole: 'ALL',
  });
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [activeAnnouncements, setActiveAnnouncements] = useState([]);
  const [dismissTicker, setDismissTicker] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyBusy, setEmergencyBusy] = useState(false);
  const [resolvingEmergencyId, setResolvingEmergencyId] = useState('');
  const [emergencyError, setEmergencyError] = useState('');
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);
  const [dismissedEmergencyIds, setDismissedEmergencyIds] = useState([]);
  const [emergencyForm, setEmergencyForm] = useState({
    alertType: 'Medical',
    location: '',
    description: '',
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordFieldErrors, setPasswordFieldErrors] = useState({});
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [noticeSocieties, setNoticeSocieties] = useState([]);
  const [noticeSocietyId, setNoticeSocietyId] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const notificationPanelRef = useRef(null);
  const notificationButtonRef = useRef(null);
  const profilePanelRef = useRef(null);
  const profileButtonRef = useRef(null);
  const apiUrl = API_BASE_URL;

  const routeTitleMap = {
    '/app/dashboard': 'Command Dashboard',
    '/app/societies': 'Society Portfolio',
    '/app/user-management': 'User Access Management',
    '/app/unit-management': 'Unit Inventory',
    '/app/residents': 'Resident Directory',
    '/app/amenities': 'Amenity Operations',
    '/app/maintenance': 'Maintenance Billing',
    '/app/payments': 'Payment Ledger',
    '/app/service-requests': 'Service Requests',
    '/app/visitor-management': 'Visitor & Gate Operations',
    '/app/notices': 'Notices & Alerts',
    '/app/reports': 'Insights & Reports',
    '/app/lost-found': 'Lost & Found',
    '/app/domestic-staff': 'Domestic Staff Operations',
    '/app/family-members': 'Family Member Registry',
    '/app/polls': 'Community Polls',
    '/app/marketplace': 'Society Marketplace',
    '/app/my-profile': 'Profile & Settings',
  };
  const matchedRouteTitle = Object.entries(routeTitleMap).find(([path]) => location.pathname.startsWith(path))?.[1];
  const pageTitle = matchedRouteTitle || sidebarItems.find((item) => location.pathname.startsWith(item.to))?.label || 'Workspace';
  const roleLabel = admin?.role ? `${String(admin.role).replace('_', ' ')} panel` : 'Workspace';
  const quickItems = sidebarItems.slice(0, 5);
  const canPostNotice = admin?.role === 'admin' || admin?.role === 'super_admin';
  const normalizedRole = String(admin?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const roleLooksGuard = normalizedRole.includes('guard') || normalizedRole.includes('security');
  const canResolveEmergency = ['admin', 'super_admin'].includes(normalizedRole) || roleLooksGuard;
  const canCreateEmergency = ['admin', 'super_admin', 'committee', 'tenant', 'owner', 'resident'].includes(normalizedRole) || roleLooksGuard;

  const latestNotifications = useMemo(() => notifications.slice(0, 12), [notifications]);
  const visibleTickerAlerts = useMemo(() => activeAlerts || [], [activeAlerts]);
  const activeEmergencyAlerts = useMemo(
    () => emergencyAlerts.filter((row) => String(row?.status || 'ACTIVE').toUpperCase() !== 'RESOLVED'),
    [emergencyAlerts]
  );
  const latestEmergencyAlert = useMemo(() => {
    if (!activeEmergencyAlerts.length) return null;
    return activeEmergencyAlerts.find((row) => row?._id && !dismissedEmergencyIds.includes(String(row._id))) || null;
  }, [activeEmergencyAlerts, dismissedEmergencyIds]);
  const showEmergencyBanner = Boolean(latestEmergencyAlert);
  const tickerFeed = useMemo(() => {
    const alertRows = visibleTickerAlerts
      .map((row) => {
        const title = String(row?.title || '').trim();
        const message = String(row?.message || '').trim();
        const priority = String(row?.priority || '').trim();
        const label = priority ? `[${priority.toUpperCase()}] ` : '';
        if (title && message) return `${label}${title}: ${message}`;
        return title || message;
      })
      .filter(Boolean);
    const announcementRows = activeAnnouncements
      .map((row) => {
        const title = String(row?.title || '').trim();
        const message = String(row?.message || '').trim();
        if (title && message) return `[NOTICE] ${title}: ${message}`;
        return title || message;
      })
      .filter(Boolean);
    const primaryRows = [...announcementRows, ...alertRows].filter(Boolean);
    return primaryRows.join('   |   ');
  }, [activeAnnouncements, visibleTickerAlerts]);
  const tickerDurationSeconds = useMemo(() => {
    const length = tickerFeed.length;
    if (!length) return 32;
    return Math.max(24, Math.min(90, Math.ceil(length / 6)));
  }, [tickerFeed]);
  // Global ticker banner disabled as requested (remove alert strip from all panels).
  const showTicker = false;
  const userName = admin?.name || 'User';
  const userRole = admin?.role
    ? String(admin.role)
        .split('_')
        .join(' ')
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : 'User';
  const userEmail = admin?.email || '-';
  const profileImageUrl = typeof admin?.profileImageUrl === 'string' ? admin.profileImageUrl.trim() : '';
  const userInitials = useMemo(() => {
    const parts = String(userName)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }, [userName]);
  const avatarHue = useMemo(() => {
    const source = `${userName}:${userEmail}`;
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
      hash = (hash << 5) - hash + source.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 360;
  }, [userName, userEmail]);
  const passwordChecks = useMemo(() => {
    const value = passwordForm.newPassword || '';
    return {
      minLength: value.length >= 8,
      hasUppercase: /[A-Z]/.test(value),
      hasLowercase: /[a-z]/.test(value),
      hasSpecial: /[^A-Za-z0-9]/.test(value),
      matches: value.length > 0 && value === passwordForm.confirmNewPassword,
    };
  }, [passwordForm.newPassword, passwordForm.confirmNewPassword]);

  useEffect(() => {
    // Prevent stale cross-user state leakage after logout/login or role switch.
    setNotificationOpen(false);
    setNotifications([]);
    setUnreadCount(0);
    setActiveAlerts([]);
    setActiveAnnouncements([]);
    setDismissTicker(false);
    setEmergencyOpen(false);
    setEmergencyError('');
    setEmergencyAlerts([]);
    setDismissedEmergencyIds([]);
    setResolvingEmergencyId('');
  }, [admin?._id, admin?.role]);
  function validatePasswordForm(values) {
    const errors = {};
    const currentPassword = String(values.currentPassword || '').trim();
    const newPassword = String(values.newPassword || '').trim();
    const confirmNewPassword = String(values.confirmNewPassword || '').trim();

    if (!currentPassword) {
      errors.currentPassword = 'Old password is required.';
    }
    if (!newPassword) {
      errors.newPassword = 'New password is required.';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters.';
    } else if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      errors.newPassword = 'Password must include uppercase, lowercase, and special character.';
    }
    if (!confirmNewPassword) {
      errors.confirmNewPassword = 'Please confirm new password.';
    } else if (newPassword !== confirmNewPassword) {
      errors.confirmNewPassword = 'New passwords do not match.';
    }

    return errors;
  }

  function updatePasswordField(field, value) {
    setPasswordError('');
    setPasswordSuccess('');
    const next = { ...passwordForm, [field]: value };
    setPasswordForm(next);
    setPasswordFieldErrors(validatePasswordForm(next));
  }

  async function loadNotifications() {
    try {
      const payload = await apiRequest('/api/notifications?limit=30', { raw: true });
      setNotifications(payload.data || []);
      setUnreadCount(payload.unreadCount || 0);
    } catch {
      // Notification widget should not break layout.
    }
  }

  async function loadActiveAlerts() {
    try {
      const payload = await apiRequest('/api/alerts/active', { raw: true });
      const now = Date.now();
      const rows = (payload?.data || []).filter((row) => {
        const start = row?.startDate ? new Date(row.startDate).getTime() : now;
        const end = row?.endDate ? new Date(row.endDate).getTime() : now;
        if (Number.isNaN(start) || Number.isNaN(end)) return false;
        return start <= now && end >= now;
      });
      setActiveAlerts(rows);
      setDismissTicker(false);
    } catch {
      setActiveAlerts([]);
      setDismissTicker(false);
    }
  }

  async function loadAlertHistory() {
    if (!canPostNotice) return;
    try {
      const payload = await apiRequest('/api/alerts/history', { raw: true });
      setAlertHistory(payload?.data || []);
    } catch {
      setAlertHistory([]);
    }
  }

  async function loadActiveAnnouncements() {
    try {
      const payload = await apiRequest('/api/announcement/active', { raw: true });
      const now = Date.now();
      const rows = (payload?.data || []).filter((row) => {
        const start = row?.startDate ? new Date(row.startDate).getTime() : now;
        const end = row?.endDate ? new Date(row.endDate).getTime() : now;
        if (Number.isNaN(start) || Number.isNaN(end)) return false;
        return start <= now && end >= now;
      });
      setActiveAnnouncements(rows);
      setDismissTicker(false);
    } catch {
      setActiveAnnouncements([]);
      setDismissTicker(false);
    }
  }

  async function loadEmergencyAlerts() {
    try {
      const payload = await apiRequest('/api/security/emergency-alerts?includeResolved=false', { raw: true });
      const rows = payload?.data || [];
      setEmergencyAlerts(rows);
      const activeIds = new Set(rows.map((row) => String(row?._id || '')).filter(Boolean));
      setDismissedEmergencyIds((prev) => prev.filter((id) => activeIds.has(String(id))));
    } catch {
      setEmergencyAlerts([]);
    }
  }

  useEffect(() => {
    loadNotifications();
    loadActiveAlerts();
    loadActiveAnnouncements();
    loadEmergencyAlerts();
    loadAlertHistory();
  }, [location.pathname]);

  useEffect(() => {
    if (!emergencyOpen) return;
    loadEmergencyAlerts();
  }, [emergencyOpen]);

  useEffect(() => {
    if (!canPostNotice) return;
    if (admin?.societyId) {
      setNoticeSocietyId(String(admin.societyId));
      return;
    }
    apiRequest('/api/societies', { raw: true })
      .then((payload) => {
        const rows = payload.data || [];
        setNoticeSocieties(rows);
        if (!noticeSocietyId && rows.length) {
          setNoticeSocietyId(String(rows[0]._id));
        }
      })
      .catch(() => {
        setNoticeSocieties([]);
      });
  }, [canPostNotice, admin?.societyId]);

  useEffect(() => {
    if (!token) return undefined;

    const stream = new EventSource(`${apiUrl}/api/notifications/stream?token=${encodeURIComponent(token)}`);

    stream.addEventListener('ready', (event) => {
      try {
        const parsed = JSON.parse(event.data || '{}');
        setUnreadCount(parsed?.payload?.unreadCount || 0);
      } catch {
        // Ignore malformed event payload.
      }
    });

    stream.addEventListener('notification:new', (event) => {
      try {
        const parsed = JSON.parse(event.data || '{}');
        const row = parsed?.payload;
        if (!row?._id) return;
        setNotifications((prev) => [row, ...prev.filter((item) => item._id !== row._id)]);
        setUnreadCount((prev) => prev + 1);
        if (row.type === 'alert') {
          loadActiveAlerts();
        }
        if (row.type === 'announcement') {
          loadActiveAnnouncements();
        }
        if (row.type === 'emergency_alert') {
          loadEmergencyAlerts();
          setDismissedEmergencyIds((prev) => prev.filter((id) => id !== String(row?.payload?.emergencyAlertId || '')));
          showToast('Emergency alert received. Check dashboard banner for location details.', 'error');
        }
        if (row.type === 'emergency_resolved') {
          loadEmergencyAlerts();
          showToast('Emergency alert marked as resolved.', 'success');
        }
      } catch {
        // Ignore malformed event payload.
      }
    });

    stream.addEventListener('notification:unread-count', (event) => {
      try {
        const parsed = JSON.parse(event.data || '{}');
        setUnreadCount(parsed?.payload?.unreadCount || 0);
      } catch {
        // Ignore malformed event payload.
      }
    });

    stream.onerror = () => {};

    return () => {
      stream.close();
    };
  }, [token, apiUrl]);

  useEffect(() => {
    if (!token) return undefined;
    const timer = setInterval(() => {
      loadNotifications();
      loadActiveAlerts();
      loadActiveAnnouncements();
      loadEmergencyAlerts();
    }, 20000);
    return () => clearInterval(timer);
  }, [token, location.pathname]);

  useEffect(() => {
    function handleTickerRefresh() {
      loadActiveAlerts();
      loadActiveAnnouncements();
    }
    window.addEventListener('society:ticker-refresh', handleTickerRefresh);
    return () => window.removeEventListener('society:ticker-refresh', handleTickerRefresh);
  }, []);

  useEffect(() => {
    if (!notificationOpen) return undefined;

    function handleClickOutside(event) {
      const target = event.target;
      if (notificationPanelRef.current?.contains(target)) return;
      if (notificationButtonRef.current?.contains(target)) return;
      setNotificationOpen(false);
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setNotificationOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [notificationOpen]);

  useEffect(() => {
    if (!profileOpen) return undefined;

    function handleProfileOutside(event) {
      const target = event.target;
      if (profilePanelRef.current?.contains(target)) return;
      if (profileButtonRef.current?.contains(target)) return;
      setProfileOpen(false);
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setProfileOpen(false);
      }
    }

    document.addEventListener('mousedown', handleProfileOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleProfileOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [profileOpen]);

  async function markNotificationRead(notificationId) {
    try {
      await apiRequest(`/api/notifications/${notificationId}/read`, { method: 'PUT', raw: true });
      setNotifications((prev) => prev.map((row) => (row._id === notificationId ? { ...row, isRead: true } : row)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // noop
    }
  }

  async function openNotification(item) {
    if (!item) return;
    if (!item.isRead) {
      await markNotificationRead(item._id);
    }
    if (item.link) {
      let target = item.link;
      if (item.payload?.lostItemId && item.link.startsWith('/app/lost-found')) {
        const separator = item.link.includes('?') ? '&' : '?';
        target = `${item.link}${separator}item=${encodeURIComponent(String(item.payload.lostItemId))}`;
      }
      navigate(target);
      setNotificationOpen(false);
    }
  }

  async function markAllRead() {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'PUT', raw: true });
      setNotifications((prev) => prev.map((row) => ({ ...row, isRead: true })));
      setUnreadCount(0);
    } catch {
      // noop
    }
  }

  async function clearAllNotifications() {
    try {
      await apiRequest('/api/notifications/clear-all', { method: 'DELETE', raw: true });
      setNotifications([]);
      setUnreadCount(0);
    } catch {
      // noop
    }
  }

  async function submitEmergencyAlert(event) {
    event.preventDefault();
    if (!canCreateEmergency) {
      showToast('You do not have permission to create emergency alerts.', 'error');
      return;
    }
    const location = String(emergencyForm.location || '').trim();
    const description = String(emergencyForm.description || '').trim();
    if (!location || !description) {
      setEmergencyError('Location and description are required.');
      return;
    }

    try {
      setEmergencyBusy(true);
      setEmergencyError('');
      await apiRequest('/api/security/emergency-alert', {
        method: 'POST',
        body: {
          alertType: emergencyForm.alertType,
          location,
          description,
        },
        raw: true,
      });
      showToast('Emergency alert sent successfully.', 'success');
      setEmergencyForm({ alertType: 'Medical', location: '', description: '' });
      await loadEmergencyAlerts();
    } catch (error) {
      setEmergencyError(error.message || 'Failed to send emergency alert.');
    } finally {
      setEmergencyBusy(false);
    }
  }

  async function resolveEmergency(alertId) {
    if (!alertId) return;
    if (!canResolveEmergency) {
      showToast('You do not have permission to resolve emergency alerts.', 'error');
      return;
    }
    try {
      setResolvingEmergencyId(String(alertId));
      await apiRequest(`/api/security/emergency-alert/${alertId}/resolve`, {
        method: 'PUT',
        raw: true,
      });
      showToast('Emergency marked as resolved.', 'success');
      await loadEmergencyAlerts();
    } catch (error) {
      showToast(error.message || 'Failed to resolve emergency.', 'error');
    } finally {
      await loadEmergencyAlerts();
      setResolvingEmergencyId('');
    }
  }

  function resetPasswordModalState() {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    });
    setPasswordError('');
    setPasswordSuccess('');
    setPasswordFieldErrors({});
    setUpdatingPassword(false);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }

  function openChangePasswordModal() {
    setProfileOpen(false);
    resetPasswordModalState();
    setChangePasswordOpen(true);
  }

  function closeChangePasswordModal() {
    setChangePasswordOpen(false);
    resetPasswordModalState();
  }

  async function handlePasswordUpdate(event) {
    event.preventDefault();
    const currentPassword = passwordForm.currentPassword.trim();
    const newPassword = passwordForm.newPassword.trim();

    const fieldErrors = validatePasswordForm(passwordForm);
    setPasswordFieldErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      setPasswordError('Please fix the highlighted password errors.');
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from old password.');
      return;
    }

    try {
      setUpdatingPassword(true);
      setPasswordError('');
      setPasswordSuccess('');
      await apiRequest('/api/auth/change-password', {
        method: 'PUT',
        body: {
          currentPassword,
          newPassword,
        },
        raw: true,
      });
      setPasswordSuccess('Password updated successfully.');
      showToast('Password updated successfully. Please login again.', 'success');
      setTimeout(() => {
        onLogout();
        navigate('/auth', { replace: true });
      }, 700);
    } catch (error) {
      const message = String(error?.message || 'Failed to update password.');
      if (message.toLowerCase().includes('current password is incorrect')) {
        setPasswordError('Old password is incorrect.');
      } else if (
        message.toLowerCase().includes('include uppercase') ||
        message.toLowerCase().includes('validation failed')
      ) {
        setPasswordError('Password must include uppercase, lowercase, and special character.');
      } else {
        setPasswordError(message);
      }
    } finally {
      setUpdatingPassword(false);
    }
  }

  async function postNoticeFromPanel(event) {
    event.preventDefault();
    if (!noticeForm.title.trim() || !noticeForm.description.trim()) {
      showToast('Notice title and message are required.', 'error');
      return;
    }
    try {
      setSendingNotice(true);
      const body = {
        title: noticeForm.title.trim(),
        description: noticeForm.description.trim(),
      };
      if (admin?.societyId) body.societyId = admin.societyId;
      if (!admin?.societyId && noticeSocietyId) body.societyId = noticeSocietyId;
      await apiRequest('/api/notices', { method: 'POST', body, raw: true });
      setNoticeForm({ title: '', description: '' });
      setShowNoticeComposer(false);
      showToast('Notice posted successfully. All society users will receive notification.', 'success');
      await loadNotifications();
      await loadActiveAnnouncements();
    } catch (err) {
      showToast(err.message || 'Failed to post notice.', 'error');
    } finally {
      setSendingNotice(false);
    }
  }

  async function postAlertFromPanel(event) {
    event.preventDefault();
    if (!alertForm.title.trim() || !alertForm.message.trim() || !alertForm.startDate || !alertForm.endDate) {
      showToast('Title, message, start date & time and end date & time are required for alert.', 'error');
      return;
    }
    const startAt = new Date(alertForm.startDate).getTime();
    const endAt = new Date(alertForm.endDate).getTime();
    if (Number.isNaN(startAt) || Number.isNaN(endAt) || endAt <= startAt) {
      showToast('End time must be later than start time.', 'error');
      return;
    }
    if (endAt < Date.now()) {
      showToast('End time cannot be in the past.', 'error');
      return;
    }
    try {
      setSendingAlert(true);
      const body = {
        title: alertForm.title.trim(),
        message: alertForm.message.trim(),
        priority: alertForm.priority,
        startDate: alertForm.startDate,
        endDate: alertForm.endDate,
        targetRole: alertForm.targetRole,
      };
      if (admin?.societyId) body.societyId = admin.societyId;
      if (!admin?.societyId && noticeSocietyId) body.societyId = noticeSocietyId;
      await apiRequest('/api/alerts', { method: 'POST', body, raw: true });
      setAlertForm({
        title: '',
        message: '',
        priority: 'Normal',
        startDate: '',
        endDate: '',
        targetRole: 'ALL',
      });
      setShowNoticeComposer(false);
      showToast('Alert posted successfully.', 'success');
      await loadNotifications();
      await loadActiveAlerts();
      await loadActiveAnnouncements();
      await loadAlertHistory();
    } catch (err) {
      showToast(err.message || 'Failed to post alert.', 'error');
    } finally {
      setSendingAlert(false);
    }
  }

  const viewerTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time', []);

  function parseNoticeDate(value) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  function formatNoticeTime(value) {
    const parsed = parseNoticeDate(value);
    if (!parsed) return '-';
    return parsed.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function getAlertStatus(row) {
    const now = Date.now();
    const start = parseNoticeDate(row?.startTime || row?.startDate);
    const end = parseNoticeDate(row?.endTime || row?.endDate);
    if (!start || !end) return String(row?.status || 'Unknown');
    if (now < start.getTime()) return 'Scheduled';
    if (now > end.getTime()) return 'Expired';
    return 'Active';
  }

  return (
    <div className="workspace-skin saas-shell h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="flex h-full">
        <motion.aside
          animate={{ width: collapsed ? 88 : 260 }}
          transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          className="saas-sidebar sticky top-0 hidden h-screen overflow-y-auto px-4 py-5 text-slate-700 shadow-panel lg:block"
        >
          <div className="mb-8 flex items-center justify-between">
            <BrandLogo variant={collapsed ? 'icon' : 'full'} tone="dark" compact size="sm" />
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              className="rounded-lg border border-blue-200 bg-white/80 p-2 text-blue-700 transition hover:bg-blue-50"
              aria-label="Toggle sidebar"
            >
              {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
            </button>
          </div>

          <nav className="space-y-2">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-100 via-blue-100 to-indigo-100 text-blue-800 shadow-[0_8px_16px_rgba(37,99,235,0.14)] ring-1 ring-blue-200'
                        : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                    }`
                  }
                >
                  <Icon size={17} />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </nav>

          {!collapsed && (
            <div className="mt-8 rounded-xl border border-blue-200 bg-white/85 p-3">
              <p className="text-xs uppercase tracking-wider text-blue-700/80">Logged in</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{admin?.name || 'Admin'}</p>
              <p className="truncate text-xs text-slate-500">{admin?.email}</p>
            </div>
          )}
        </motion.aside>

        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <header className="saas-topbar sticky top-0 z-20 px-4 py-3 md:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">{roleLabel}</p>
                <h1 className="font-display text-2xl font-semibold text-slate-800 dark:text-white">{pageTitle}</h1>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmergencyOpen(true);
                    setEmergencyError('');
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
                >
                  <FiAlertTriangle size={14} />
                  <span className="hidden sm:inline">Emergency</span>
                </button>
                <button
                  ref={notificationButtonRef}
                  type="button"
                  onClick={() => {
                    setNotificationOpen((prev) => !prev);
                    if (!notificationOpen) loadNotifications();
                  }}
                  className="relative rounded-xl border border-cyan-100 bg-white/70 p-2.5 text-slate-600 transition hover:bg-cyan-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label="Notifications"
                >
                  <FiBell size={16} />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="rounded-xl border border-cyan-100 bg-white/70 p-2.5 text-slate-600 transition hover:bg-cyan-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? <FiSun size={16} /> : <FiMoon size={16} />}
                </button>
                <div className="relative">
                  <button
                    ref={profileButtonRef}
                    type="button"
                    onClick={() => setProfileOpen((prev) => !prev)}
                    className="group inline-flex items-center gap-2 rounded-xl border border-cyan-100 bg-white/70 px-2.5 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-cyan-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    {profileImageUrl ? (
                      <img
                        src={profileImageUrl}
                        alt={userName}
                        className="h-9 w-9 rounded-full border border-white/70 object-cover shadow transition duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <span
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shadow transition duration-200 group-hover:scale-105"
                        style={{
                          background: `linear-gradient(135deg, hsl(${avatarHue} 75% 46%), hsl(${(avatarHue + 38) % 360} 80% 52%))`,
                        }}
                        aria-hidden
                      >
                        {userInitials}
                      </span>
                    )}
                    <span className="hidden max-w-36 truncate sm:inline">{userName}</span>
                    <FiChevronDown size={15} className={`transition ${profileOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {profileOpen && (
                      <motion.div
                        ref={profilePanelRef}
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                          <div className="flex items-center gap-2">
                            {profileImageUrl ? (
                              <img
                                src={profileImageUrl}
                                alt={userName}
                                className="h-9 w-9 rounded-full border border-white/70 object-cover shadow"
                              />
                            ) : (
                              <span
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shadow"
                                style={{
                                  background: `linear-gradient(135deg, hsl(${avatarHue} 75% 46%), hsl(${(avatarHue + 38) % 360} 80% 52%))`,
                                }}
                              >
                                {userInitials}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{userName}</p>
                              <p className="truncate text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{userRole}</p>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={openChangePasswordModal}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <FiLock size={15} />
                          Change Password
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileOpen(false);
                            onLogout();
                            navigate('/auth', { replace: true });
                          }}
                          className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-900/20"
                        >
                          <FiLogOut size={15} />
                          Logout
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
            <AnimatePresence>
              {showEmergencyBanner && (
                <motion.div
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-3 overflow-hidden rounded-2xl border border-rose-200/80 bg-gradient-to-r from-rose-50 via-white to-rose-100/70 text-slate-900 shadow-lg dark:border-rose-800/60 dark:from-rose-950/40 dark:via-slate-900 dark:to-rose-950/30 dark:text-slate-100"
                >
                  <div className="flex flex-wrap items-start gap-4 px-4 py-3.5 sm:px-5 sm:py-4">
                    <div className="min-w-0 flex-1 sm:min-w-[230px]">
                      <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-rose-700 dark:border-rose-700/60 dark:bg-rose-900/40 dark:text-rose-200">
                        <span className="inline-flex h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_0_0_rgba(244,63,94,0.5)] animate-[ticker-pulse_2s_infinite]" />
                        Active Alert
                      </span>
                      <p className="mt-2 text-sm font-bold leading-5 sm:text-[15px]">
                        {latestEmergencyAlert.alertType} emergency at {latestEmergencyAlert.location}
                        {activeEmergencyAlerts.length > 1 ? ` • ${activeEmergencyAlerts.length} active alerts` : ''}
                      </p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        {latestEmergencyAlert.description} • Reported by{' '}
                        {latestEmergencyAlert.reportedByUser?.name || latestEmergencyAlert.reportedByGuard?.name || 'User'} •{' '}
                        {formatNoticeTime(latestEmergencyAlert.createdAt)}
                      </p>
                    </div>
                    <div className="ml-auto flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setEmergencyOpen(true)}
                        className="rounded-lg border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-700 dark:bg-slate-900 dark:text-cyan-200 dark:hover:bg-cyan-900/20"
                      >
                        View Details
                      </button>
                      {canResolveEmergency ? (
                        <button
                          type="button"
                          onClick={() => resolveEmergency(latestEmergencyAlert._id)}
                          disabled={resolvingEmergencyId === String(latestEmergencyAlert._id)}
                          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {resolvingEmergencyId === String(latestEmergencyAlert._id) ? 'Resolving...' : 'Mark Resolved'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setDismissedEmergencyIds((prev) => [...prev, String(latestEmergencyAlert._id)])}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {showTicker && (
                <motion.div
                  initial={{ opacity: 0, y: -16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  className="announcement-ticker-shell mt-3 overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-100 via-orange-50 to-yellow-100 shadow-lg dark:border-amber-800/70 dark:from-amber-900/50 dark:via-amber-900/35 dark:to-orange-900/35"
                >
                  <div className="relative flex items-center gap-4 px-4 py-3">
                    <span className="announcement-ticker-badge inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-200/90 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-amber-900 dark:bg-amber-800/70 dark:text-amber-100">
                      <FiAlertTriangle size={12} />
                      Alert
                    </span>
                    <div className="announcement-ticker-mask flex-1 overflow-hidden">
                      <div
                        className="announcement-ticker-track"
                        style={{ '--ticker-duration': `${tickerDurationSeconds}s` }}
                      >
                        <span className="announcement-ticker-item">{tickerFeed}</span>
                        <span className="announcement-ticker-item" aria-hidden>
                          {tickerFeed}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDismissTicker(true)}
                      className="rounded-xl border border-amber-300 bg-white/70 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/25 dark:text-amber-100 dark:hover:bg-amber-900/45"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {notificationOpen && (
                <motion.div
                  ref={notificationPanelRef}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute right-4 top-[76px] z-40 flex max-h-[82vh] w-[min(96vw,520px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:right-6"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Live Notifications</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{unreadCount} unread</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Mark all read
                      </button>
                      <button
                        type="button"
                        onClick={clearAllNotifications}
                        className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/20"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="min-h-[150px] flex-1 space-y-2 overflow-y-auto pr-1">
                    {latestNotifications.map((item) => (
                      <div
                        key={item._id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openNotification(item)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openNotification(item);
                          }
                        }}
                        className={`w-full cursor-pointer rounded-xl border p-2.5 text-left ${item.isRead ? 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40' : 'border-cyan-200 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-900/20'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                          {!item.isRead && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                markNotificationRead(item._id);
                              }}
                              className="inline-flex items-center gap-1 rounded bg-emerald-600 px-1.5 py-1 text-[11px] font-semibold text-white"
                            >
                              <FiCheck size={11} />
                              Read
                            </button>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{item.message}</p>
                        {item.payload?.image ? (
                          <img
                            src={item.payload.image}
                            alt={item.payload?.itemName || 'Notification preview'}
                            className="mt-2 h-14 w-14 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                          />
                        ) : null}
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{formatNoticeTime(item.createdAt)}</p>
                      </div>
                    ))}
                    {!latestNotifications.length && (
                      <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        No notifications yet.
                      </p>
                    )}
                  </div>

                  {canPostNotice && (
                    <div className="mt-3 max-h-[42vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/50">
                      <button
                        type="button"
                        onClick={() => setShowNoticeComposer((prev) => !prev)}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {showNoticeComposer ? 'Hide Composer' : 'Communication Center'}
                      </button>

                      {showNoticeComposer && (
                        <div className="mt-2 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setComposerMode('notice')}
                              className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${composerMode === 'notice' ? 'bg-cyan-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'}`}
                            >
                              Publish Notice
                            </button>
                            <button
                              type="button"
                              onClick={() => setComposerMode('alert')}
                              className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${composerMode === 'alert' ? 'bg-rose-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'}`}
                            >
                              Post Alert
                            </button>
                          </div>
                          {!admin?.societyId && (
                            <select
                              value={noticeSocietyId}
                              onChange={(event) => setNoticeSocietyId(event.target.value)}
                              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                              required
                            >
                              <option value="">Select society</option>
                              {noticeSocieties.map((society) => (
                                <option key={society._id} value={society._id}>
                                  {society.name}
                                </option>
                              ))}
                            </select>
                          )}
                          {composerMode === 'notice' ? (
                            <form onSubmit={postNoticeFromPanel} className="space-y-2">
                              <input
                                value={noticeForm.title}
                                onChange={(event) => setNoticeForm((prev) => ({ ...prev, title: event.target.value }))}
                                placeholder="Enter notice title"
                                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                                required
                              />
                              <textarea
                                value={noticeForm.description}
                                onChange={(event) => setNoticeForm((prev) => ({ ...prev, description: event.target.value }))}
                                placeholder="Enter notice message"
                                className="w-full min-h-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                                required
                              />
                              <button
                                type="submit"
                                disabled={sendingNotice}
                                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                              >
                                <FiSend size={12} />
                                {sendingNotice ? 'Posting...' : 'Post Notice'}
                              </button>
                            </form>
                          ) : (
                            <form onSubmit={postAlertFromPanel} className="space-y-2">
                              <input
                                value={alertForm.title}
                                onChange={(event) => setAlertForm((prev) => ({ ...prev, title: event.target.value }))}
                                placeholder="Enter alert title"
                                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                                required
                              />
                              <textarea
                                value={alertForm.message}
                                onChange={(event) => setAlertForm((prev) => ({ ...prev, message: event.target.value }))}
                                placeholder="Enter alert message"
                                className="w-full min-h-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                                required
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  value={alertForm.priority}
                                  onChange={(event) => setAlertForm((prev) => ({ ...prev, priority: event.target.value }))}
                                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                                >
                                  <option value="Normal">Normal</option>
                                  <option value="Urgent">Urgent</option>
                                  <option value="Critical">Critical</option>
                                </select>
                                <select
                                  value={alertForm.targetRole}
                                  onChange={(event) => setAlertForm((prev) => ({ ...prev, targetRole: event.target.value }))}
                                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                                >
                                  <option value="ALL">All Users</option>
                                  <option value="RESIDENTS">Residents</option>
                                  <option value="GUARDS">Guards</option>
                                  <option value="TENANTS">Tenants</option>
                                  <option value="COMMITTEE">Committee</option>
                                </select>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="datetime-local"
                                  value={alertForm.startDate}
                                  onChange={(event) => setAlertForm((prev) => ({ ...prev, startDate: event.target.value }))}
                                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                                  title="Start Date & Time"
                                  required
                                />
                                <input
                                  type="datetime-local"
                                  value={alertForm.endDate}
                                  onChange={(event) => setAlertForm((prev) => ({ ...prev, endDate: event.target.value }))}
                                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                                  title="End Date & Time"
                                  required
                                />
                              </div>
                              <button
                                type="submit"
                                disabled={sendingAlert}
                                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-rose-600 to-orange-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                              >
                                <FiAlertTriangle size={12} />
                                {sendingAlert ? 'Posting...' : 'Post Alert'}
                              </button>
                              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900/40">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recent Alerts</p>
                                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                  Status here is schedule-based. Floating ticker is turned off. Times are shown in {viewerTimeZone}.
                                </p>
                                <div className="mt-2 max-h-36 space-y-1 overflow-auto pr-1">
                                  {(alertHistory || []).slice(0, 10).map((row) => {
                                    const statusLabel = getAlertStatus(row);
                                    const statusClass =
                                      statusLabel === 'Active'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : statusLabel === 'Scheduled'
                                          ? 'bg-blue-100 text-blue-700'
                                          : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
                                    const startTime = row.startTime || row.startDate;
                                    const endTime = row.endTime || row.endDate;
                                    return (
                                    <div key={row._id} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="truncate font-semibold text-slate-800 dark:text-slate-100">{row.title}</span>
                                        <span className={`rounded-full px-1.5 py-0.5 font-semibold ${statusClass}`}>
                                          {statusLabel}
                                        </span>
                                      </div>
                                      <p className="truncate text-slate-500 dark:text-slate-400">
                                        {formatNoticeTime(startTime)} - {formatNoticeTime(endTime)}
                                      </p>
                                      {statusLabel === 'Active' ? (
                                        <p className="truncate text-[10px] text-emerald-700 dark:text-emerald-300">Expires at {formatNoticeTime(endTime)}</p>
                                      ) : null}
                                    </div>
                                    );
                                  })}
                                  {!alertHistory.length ? (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">No alert history yet.</p>
                                  ) : null}
                                </div>
                              </div>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </header>

          <AnimatePresence>
            {emergencyOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/50 px-4"
              >
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between bg-gradient-to-r from-rose-600 to-orange-500 px-5 py-4 text-white">
                    <div>
                      <h3 className="text-lg font-semibold">Emergency Control</h3>
                      <p className="text-xs text-rose-50">Raise and track emergency alerts for your society.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEmergencyOpen(false)}
                      className="rounded-lg p-1.5 text-white/90 transition hover:bg-white/15"
                    >
                      <FiX size={16} />
                    </button>
                  </div>

                  <div className="grid gap-4 p-5 md:grid-cols-[1fr,1.1fr]">
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                      {canCreateEmergency ? (
                        <form onSubmit={submitEmergencyAlert} className="space-y-3">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">Create Emergency Alert</p>
                          <select
                            value={emergencyForm.alertType}
                            onChange={(event) => setEmergencyForm((prev) => ({ ...prev, alertType: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                          >
                            <option value="Medical">Medical</option>
                            <option value="Fire">Fire</option>
                            <option value="Security">Security</option>
                          </select>
                          <input
                            value={emergencyForm.location}
                            onChange={(event) => setEmergencyForm((prev) => ({ ...prev, location: event.target.value }))}
                            placeholder="Location (e.g. Tower A Gate)"
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                          />
                          <textarea
                            value={emergencyForm.description}
                            onChange={(event) => setEmergencyForm((prev) => ({ ...prev, description: event.target.value }))}
                            placeholder="Enter emergency details"
                            className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                          />
                          {emergencyError ? (
                            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{emergencyError}</p>
                          ) : null}
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEmergencyOpen(false)}
                              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              Close
                            </button>
                            <button
                              type="submit"
                              disabled={emergencyBusy}
                              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:from-rose-500 hover:to-orange-400 disabled:opacity-60"
                            >
                              <FiAlertTriangle size={14} />
                              {emergencyBusy ? 'Sending...' : 'Send Alert'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                          You can view live emergency alerts here. Only authorized roles can create new alerts.
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Recent Alerts</p>
                        <button
                          type="button"
                          onClick={loadEmergencyAlerts}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Refresh
                        </button>
                      </div>
                      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                        {emergencyAlerts.slice(0, 20).map((alert) => (
                          <div key={alert._id} className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-700">
                            <div className="flex items-center justify-between gap-2">
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700">{alert.alertType}</span>
                              <span className="text-slate-500 dark:text-slate-400">{formatNoticeTime(alert.createdAt)}</span>
                            </div>
                            <div className="mt-1">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                  String(alert.status || 'ACTIVE').toUpperCase() === 'RESOLVED'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                {String(alert.status || 'ACTIVE').toUpperCase()}
                              </span>
                            </div>
                            <p className="mt-1 text-slate-700 dark:text-slate-200">{alert.location}</p>
                            <p className="mt-1 text-slate-600 dark:text-slate-300">{alert.description}</p>
                            <p className="mt-1 text-slate-500 dark:text-slate-400">
                              By: {alert.reportedByUser?.name || alert.reportedByGuard?.name || 'User'}
                            </p>
                            {canResolveEmergency && String(alert.status || 'ACTIVE').toUpperCase() !== 'RESOLVED' ? (
                              <div className="mt-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => resolveEmergency(alert._id)}
                                  disabled={resolvingEmergencyId === String(alert._id)}
                                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                                >
                                  {resolvingEmergencyId === String(alert._id) ? 'Resolving...' : 'Mark Resolved'}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                        {!emergencyAlerts.length ? (
                          <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            No emergency alerts yet.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {changePasswordOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 px-4"
              >
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-5 py-4 text-white">
                    <div>
                      <h3 className="text-lg font-semibold">Change Password</h3>
                      <p className="text-xs text-indigo-50">Use a strong password to secure your account.</p>
                    </div>
                    <button
                      type="button"
                      onClick={closeChangePasswordModal}
                      className="rounded-lg p-1.5 text-white/90 transition hover:bg-white/15"
                    >
                      <FiX size={16} />
                    </button>
                  </div>

                  <form onSubmit={handlePasswordUpdate} className="space-y-3 p-5">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                      Old Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={passwordForm.currentPassword}
                        onChange={(event) => updatePasswordField('currentPassword', event.target.value)}
                        placeholder="Enter old password"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100"
                        aria-label={showCurrentPassword ? 'Hide old password' : 'Show old password'}
                      >
                        {showCurrentPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                      </button>
                    </div>
                    {passwordFieldErrors.currentPassword && (
                      <p className="text-xs font-medium text-rose-700">{passwordFieldErrors.currentPassword}</p>
                    )}

                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordForm.newPassword}
                        onChange={(event) => updatePasswordField('newPassword', event.target.value)}
                        placeholder="Enter new password"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100"
                        aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                      >
                        {showNewPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                      </button>
                    </div>
                    {passwordFieldErrors.newPassword && (
                      <p className="text-xs font-medium text-rose-700">{passwordFieldErrors.newPassword}</p>
                    )}

                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={passwordForm.confirmNewPassword}
                        onChange={(event) => updatePasswordField('confirmNewPassword', event.target.value)}
                        placeholder="Confirm new password"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100"
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showConfirmPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                      </button>
                    </div>
                    {passwordFieldErrors.confirmNewPassword && (
                      <p className="text-xs font-medium text-rose-700">{passwordFieldErrors.confirmNewPassword}</p>
                    )}

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/70">
                      <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">Password requirements</p>
                      <div className="grid grid-cols-2 gap-1">
                        <p className={passwordChecks.minLength ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}>8+ characters</p>
                        <p className={passwordChecks.hasUppercase ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}>Uppercase</p>
                        <p className={passwordChecks.hasLowercase ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}>Lowercase</p>
                        <p className={passwordChecks.hasSpecial ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}>Special char</p>
                      </div>
                      <p className={`mt-1 ${passwordChecks.matches ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>
                        Confirm password matches
                      </p>
                    </div>

                    {passwordError && (
                      <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                        {passwordError}
                      </p>
                    )}
                    {passwordSuccess && (
                      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                        {passwordSuccess}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={closeChangePasswordModal}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={updatingPassword}
                        className="rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white transition hover:from-indigo-500 hover:to-cyan-400 disabled:opacity-60"
                      >
                        {updatingPassword ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <main className="workspace-skin saas-main flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
          <nav className="fixed bottom-3 left-1/2 z-30 flex w-[min(92%,540px)] -translate-x-1/2 items-center justify-around rounded-2xl border border-cyan-100 bg-white/90 p-2 shadow-panel backdrop-blur lg:hidden dark:border-slate-700 dark:bg-slate-900/95">
            <NavLink to="/app" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              <FiHome size={18} />
            </NavLink>
            {quickItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-xl p-2 ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-100 via-blue-100 to-indigo-100 text-blue-700 shadow-[0_6px_12px_rgba(37,99,235,0.14)] dark:bg-cyan-900/40 dark:text-cyan-200'
                        : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <Icon size={18} />
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}

export default Layout;

