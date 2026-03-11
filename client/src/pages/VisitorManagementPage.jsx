import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FiAlertTriangle, FiBell, FiCalendar, FiCheck, FiClock, FiPackage, FiPhone, FiRefreshCw, FiSearch, FiShield, FiTruck, FiUserX, FiUsers } from 'react-icons/fi';
import { useSearchParams } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';

const POLL_INTERVAL_MS = 15000;
const GUARD_VISITOR_INITIAL_FORM = {
  visitorName: '',
  phone: '',
  purpose: '',
  visitingUnit: '',
  residentId: '',
  vehicleNumber: '',
  photoUrl: '',
  requestedEntryTime: '',
};
const DELIVERY_INITIAL_FORM = {
  deliveryType: 'Swiggy',
  deliveryPersonName: '',
  phone: '',
  flatNumber: '',
};
const DELIVERY_STEPS = {
  INITIAL: 'initial',
  OTP_SENT: 'otpSent',
  VERIFIED: 'verified',
};
const DOMESTIC_INITIAL_FORM = {
  phone: '',
  staffType: '',
  flatNumber: '',
};
const DOMESTIC_STEPS = {
  INITIAL: 'initial',
  OTP_SENT: 'otpSent',
  VERIFIED: 'verified',
};

const STATUS_STYLES = {
  Pending: 'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-rose-100 text-rose-700',
  Entered: 'bg-cyan-100 text-cyan-700',
  Exited: 'bg-slate-200 text-slate-700',
  Expected: 'bg-indigo-100 text-indigo-700',
};

function StatusBadge({ status }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>;
}

function MetricTile({ label, value, tone = 'slate' }) {
  const toneClasses = tone === 'amber'
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : tone === 'emerald'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : tone === 'rose'
    ? 'border-rose-200 bg-rose-50 text-rose-800'
    : tone === 'cyan'
    ? 'border-cyan-200 bg-cyan-50 text-cyan-800'
    : 'border-slate-200 bg-white text-slate-800';
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border p-4 shadow-panel ${toneClasses}`}>
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </motion.div>
  );
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function VisitorManagementPage() {
  const { admin, apiRequest } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = admin?.role;
  const isGuard = role === 'guard';
  const isTenant = role === 'tenant' || role === 'owner';
  const isAdminView = role === 'admin' || role === 'committee' || role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [units, setUnits] = useState([]);
  const [residents, setResidents] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [analytics, setAnalytics] = useState({ dailyCounts: [], statusBreakdown: [], pendingApprovals: 0 });

  const [filters, setFilters] = useState({
    status: '',
    name: '',
    flat: '',
    dateFrom: '',
    dateTo: '',
  });

  const [guardForm, setGuardForm] = useState(GUARD_VISITOR_INITIAL_FORM);
  const [visitorEmergencyOverride, setVisitorEmergencyOverride] = useState(false);

  const [rejectReason, setRejectReason] = useState('');
  const previousPendingRef = useRef(0);
  const previousRejectedRef = useRef(0);
  const [guardTab, setGuardTab] = useState(() => {
    const tab = searchParams.get('tab');
    return ['visitors', 'domestic', 'deliveries'].includes(tab) ? tab : 'visitors';
  });
  const [deliveryForm, setDeliveryForm] = useState(DELIVERY_INITIAL_FORM);
  const [deliveryResident, setDeliveryResident] = useState(null);
  const [deliveryEntryId, setDeliveryEntryId] = useState('');
  const [deliveryOtp, setDeliveryOtp] = useState('');
  const [deliveryOtpMeta, setDeliveryOtpMeta] = useState(null);
  const [deliveryVerified, setDeliveryVerified] = useState(false);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [deliveryHistory, setDeliveryHistory] = useState([]);
  const [deliveryLookupError, setDeliveryLookupError] = useState('');
  const [deliveryStep, setDeliveryStep] = useState(DELIVERY_STEPS.INITIAL);
  const [deliveryError, setDeliveryError] = useState('');
  const [deliveryEmergencyOverride, setDeliveryEmergencyOverride] = useState(false);
  const [domesticForm, setDomesticForm] = useState(DOMESTIC_INITIAL_FORM);
  const [domesticOtp, setDomesticOtp] = useState('');
  const [domesticVerifiedStaff, setDomesticVerifiedStaff] = useState(null);
  const [domesticOtpMeta, setDomesticOtpMeta] = useState(null);
  const [domesticBusy, setDomesticBusy] = useState(false);
  const [domesticEntries, setDomesticEntries] = useState([]);
  const [domesticStep, setDomesticStep] = useState(DOMESTIC_STEPS.INITIAL);
  const [domesticError, setDomesticError] = useState('');

  function resetGateForm(scope = 'all') {
    if (scope === 'all' || scope === 'visitors') {
      setGuardForm(GUARD_VISITOR_INITIAL_FORM);
      setVisitorEmergencyOverride(false);
    }
    if (scope === 'all' || scope === 'domestic') {
      setDomesticForm(DOMESTIC_INITIAL_FORM);
      setDomesticOtp('');
      setDomesticVerifiedStaff(null);
      setDomesticOtpMeta(null);
      setDomesticStep(DOMESTIC_STEPS.INITIAL);
      setDomesticError('');
    }
    if (scope === 'all' || scope === 'deliveries') {
      setDeliveryForm(DELIVERY_INITIAL_FORM);
      setDeliveryResident(null);
      setDeliveryEntryId('');
      setDeliveryOtp('');
      setDeliveryOtpMeta(null);
      setDeliveryVerified(false);
      setDeliveryLookupError('');
      setDeliveryStep(DELIVERY_STEPS.INITIAL);
      setDeliveryError('');
      setDeliveryEmergencyOverride(false);
    }
  }

  async function fetchGuardLookups() {
    const [unitsResult, residentsResult] = await Promise.allSettled([
      apiRequest('/api/security/guard-units', { raw: true }),
      apiRequest('/api/security/guard-residents', { raw: true }),
    ]);
    if (unitsResult.status === 'fulfilled') setUnits(unitsResult.value.data || []);
    if (residentsResult.status === 'fulfilled') setResidents(residentsResult.value.data || []);
  }

  async function loadData({ silent = false } = {}) {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setError('');

    try {
      if (isGuard) {
        const [todayResult, domesticResult] = await Promise.all([
          apiRequest('/api/visitors/today', { raw: true }),
          apiRequest('/api/domestic-staff/entry/active', { raw: true }),
          fetchGuardLookups(),
        ]);
        const list = Array.isArray(todayResult) ? todayResult : todayResult.data || [];
        setVisitors(list);
        setDomesticEntries(domesticResult?.data || []);

        const rejectedCount = list.filter((item) => item.status === 'Rejected').length;
        if (silent && rejectedCount > previousRejectedRef.current) {
          showToast('A visitor request was rejected by tenant.', 'error');
        }
        previousRejectedRef.current = rejectedCount;
      }

      if (isTenant) {
        const payload = await apiRequest('/api/visitors/my-requests', { raw: true });
        const list = payload.data || [];
        setVisitors(list);
        const pendingCount = list.filter((item) => item.status === 'Pending').length;
        if (silent && pendingCount > previousPendingRef.current) {
          showToast('New visitor approval request received.', 'info');
        }
        previousPendingRef.current = pendingCount;
      }

      if (isAdminView) {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.name) params.append('name', filters.name);
        if (filters.flat) params.append('flat', filters.flat);
        if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
        if (filters.dateTo) params.append('dateTo', filters.dateTo);
        params.append('limit', '100');

        const [logsResult, analyticsResult] = await Promise.allSettled([
          apiRequest(`/api/visitors/logs?${params.toString()}`, { raw: true }),
          apiRequest('/api/visitors/analytics', { raw: true }),
        ]);

        if (logsResult.status === 'fulfilled') {
          setVisitors(logsResult.value.data || []);
        } else {
          setVisitors([]);
          showToast(logsResult.reason?.message || 'Failed to load visitor logs.', 'error');
        }

        if (analyticsResult.status === 'fulfilled') {
          setAnalytics(analyticsResult.value.data || { dailyCounts: [], statusBreakdown: [], pendingApprovals: 0 });
        } else {
          setAnalytics({ dailyCounts: [], statusBreakdown: [], pendingApprovals: 0 });
          showToast(analyticsResult.reason?.message || 'Failed to load visitor analytics.', 'error');
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load visitor data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [role]);

  useEffect(() => {
    if (!isAdminView) return;
    loadData({ silent: true });
  }, [filters.status, filters.name, filters.flat, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    if (!(isTenant || isGuard)) return undefined;
    const timer = setInterval(() => {
      loadData({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isTenant, isGuard]);

  useEffect(() => {
    if (!isGuard) return;
    const tab = searchParams.get('tab');
    if (['visitors', 'domestic', 'deliveries'].includes(tab) && tab !== guardTab) {
      resetGateForm('all');
      setGuardTab(tab);
    }
  }, [isGuard, searchParams, guardTab]);

  function handleGuardTabChange(tab) {
    if (tab !== guardTab) {
      resetGateForm('all');
    }
    setGuardTab(tab);
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    setSearchParams(params, { replace: true });
  }

  const filteredVisitors = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return visitors;
    return visitors.filter((item) => {
      const haystack = [
        item.visitorName,
        item.phone,
        item.purpose,
        item.visitingUnit?.unitNumber,
        item.residentId?.name,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [visitors, search]);

  const tenantPending = useMemo(() => filteredVisitors.filter((item) => item.status === 'Pending'), [filteredVisitors]);
  const tenantApproved = useMemo(() => filteredVisitors.filter((item) => item.status === 'Approved'), [filteredVisitors]);
  const tenantHistory = useMemo(() => filteredVisitors.filter((item) => ['Rejected', 'Entered', 'Exited'].includes(item.status)), [filteredVisitors]);
  const occupiedUnits = useMemo(
    () =>
      (units || []).filter((unit) => {
        const status = String(unit?.status || '').toUpperCase();
        const occupancy = String(unit?.occupancyStatus || '').toLowerCase();
        return status === 'OCCUPIED' || occupancy === 'occupied';
      }),
    [units]
  );
  const selectedVisitorUnit = useMemo(
    () => occupiedUnits.find((unit) => String(unit?._id) === String(guardForm.visitingUnit)),
    [occupiedUnits, guardForm.visitingUnit]
  );
  const selectedResidentId = useMemo(
    () => selectedVisitorUnit?.assignedResidentId || selectedVisitorUnit?.tenantId || selectedVisitorUnit?.ownerId || '',
    [selectedVisitorUnit]
  );
  const selectedVisitorResident = useMemo(() => {
    if (!selectedResidentId) return null;
    return (residents || []).find((row) => String(row?._id || row?.id) === String(selectedResidentId)) || null;
  }, [residents, selectedResidentId]);
  const statusSummary = useMemo(() => {
    const result = { total: filteredVisitors.length, pending: 0, approved: 0, entered: 0, rejected: 0 };
    filteredVisitors.forEach((item) => {
      if (item.status === 'Pending') result.pending += 1;
      if (item.status === 'Approved') result.approved += 1;
      if (item.status === 'Entered') result.entered += 1;
      if (item.status === 'Rejected') result.rejected += 1;
    });
    return result;
  }, [filteredVisitors]);

  useEffect(() => {
    if (!isGuard) return;
    setGuardForm((prev) => {
      const nextResidentId = selectedResidentId ? String(selectedResidentId) : '';
      if (String(prev.residentId || '') === nextResidentId) return prev;
      return { ...prev, residentId: nextResidentId };
    });
  }, [selectedResidentId, isGuard]);

  async function createGuardVisitorRequest(event) {
    event.preventDefault();
    try {
      await apiRequest('/api/visitors/request', {
        method: 'POST',
        body: {
          ...guardForm,
          isEmergency: visitorEmergencyOverride,
        },
      });
      showToast(visitorEmergencyOverride ? 'Emergency visitor request sent with DND override.' : 'Visitor request sent to tenant.', 'success');
      resetGateForm('visitors');
      await loadData({ silent: true });
    } catch (err) {
      showToast(err.message || 'Failed to create visitor request.', 'error');
    }
  }

  async function markEntry(visitorId) {
    try {
      await apiRequest(`/api/visitors/${visitorId}/entry`, { method: 'PUT' });
      showToast('Visitor marked as entered.', 'success');
      await loadData({ silent: true });
    } catch (err) {
      showToast(err.message || 'Failed to mark entry.', 'error');
    }
  }

  async function markExit(visitorId) {
    try {
      await apiRequest(`/api/visitors/${visitorId}/exit`, { method: 'PUT' });
      showToast('Visitor marked as exited.', 'success');
      await loadData({ silent: true });
    } catch (err) {
      showToast(err.message || 'Failed to mark exit.', 'error');
    }
  }

  async function approveVisitor(visitorId) {
    try {
      await apiRequest(`/api/visitors/${visitorId}/approve`, { method: 'PUT' });
      showToast('Visitor approved.', 'success');
      await loadData({ silent: true });
    } catch (err) {
      showToast(err.message || 'Failed to approve visitor.', 'error');
    }
  }

  async function rejectVisitor(visitorId) {
    try {
      await apiRequest(`/api/visitors/${visitorId}/reject`, { method: 'PUT', body: { reason: rejectReason } });
      setRejectReason('');
      showToast('Visitor rejected.', 'success');
      await loadData({ silent: true });
    } catch (err) {
      showToast(err.message || 'Failed to reject visitor.', 'error');
    }
  }

  async function markVisitorEmergency(visitorId) {
    try {
      await apiRequest(`/api/visitors/${visitorId}/emergency`, { method: 'PUT' });
      showToast('Visitor marked as emergency.', 'success');
      await loadData({ silent: true });
    } catch (err) {
      showToast(err.message || 'Failed to mark emergency visitor.', 'error');
    }
  }

  function callGuard() {
    showToast('Guard desk notified. Please contact gate on intercom.', 'info');
  }

  async function lookupDeliveryResident(flatNumber) {
    const flat = String(flatNumber || '').trim().toUpperCase();
    if (!flat) {
      setDeliveryResident(null);
      setDeliveryLookupError('');
      setDeliveryEntryId('');
      setDeliveryOtp('');
      setDeliveryOtpMeta(null);
      setDeliveryVerified(false);
      setDeliveryStep(DELIVERY_STEPS.INITIAL);
      setDeliveryError('');
      return;
    }
    try {
      const payload = await apiRequest(`/api/security/deliveries/resident-lookup?flatNumber=${encodeURIComponent(flat)}`, { raw: true });
      setDeliveryResident(payload.data || null);
      setDeliveryLookupError('');
    } catch (err) {
      setDeliveryResident(null);
      setDeliveryLookupError(err.message || 'Resident not found for this flat number.');
      setDeliveryEntryId('');
      setDeliveryOtp('');
      setDeliveryOtpMeta(null);
      setDeliveryVerified(false);
      setDeliveryStep(DELIVERY_STEPS.INITIAL);
      setDeliveryError('');
    }
  }

  useEffect(() => {
    if (!isGuard) return undefined;
    const timer = setTimeout(() => {
      lookupDeliveryResident(deliveryForm.flatNumber);
    }, 350);
    return () => clearTimeout(timer);
  }, [deliveryForm.flatNumber, isGuard]);

  async function loadDeliveryHistory() {
    try {
      const params = new URLSearchParams();
      if (deliveryForm.flatNumber.trim()) params.set('flatNumber', deliveryForm.flatNumber.trim());
      const payload = await apiRequest(`/api/security/deliveries/history${params.toString() ? `?${params.toString()}` : ''}`, { raw: true });
      setDeliveryHistory(payload.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to load delivery history.', 'error');
    }
  }

  useEffect(() => {
    if (!isGuard) return;
    loadDeliveryHistory();
  }, [isGuard]);

  async function sendDeliveryOtp() {
    if (deliveryStep !== DELIVERY_STEPS.INITIAL) return;
    if (!deliveryResident?.residentId) {
      setDeliveryError('Resident not found for this flat.');
      return;
    }
    if (!deliveryForm.deliveryPersonName.trim() || !deliveryForm.phone.trim() || !deliveryForm.flatNumber.trim()) {
      setDeliveryError('Please fill all delivery fields before sending OTP.');
      return;
    }
    try {
      setDeliveryError('');
      setDeliveryBusy(true);
      const payload = await apiRequest('/api/security/deliveries/send-otp', {
        method: 'POST',
        body: {
          deliveryType: deliveryForm.deliveryType,
          deliveryPersonName: deliveryForm.deliveryPersonName.trim(),
          phone: deliveryForm.phone.trim(),
          flatNumber: deliveryForm.flatNumber.trim().toUpperCase(),
          isEmergency: deliveryEmergencyOverride,
        },
        raw: true,
      });
      setDeliveryEntryId(payload?.data?.deliveryEntryId || '');
      setDeliveryVerified(false);
      setDeliveryOtp('');
      setDeliveryOtpMeta(payload?.data || null);
      setDeliveryStep(DELIVERY_STEPS.OTP_SENT);
      if (payload?.data?.devOtp) {
        showToast(`OTP sent. Dev OTP: ${payload.data.devOtp}`, 'info');
      } else {
        showToast('OTP sent to resident phone.', 'success');
      }
    } catch (err) {
      setDeliveryError(err.message || 'Failed to send OTP.');
    } finally {
      setDeliveryBusy(false);
    }
  }

  async function verifyDeliveryOtp() {
    if (deliveryStep !== DELIVERY_STEPS.OTP_SENT) return;
    if (!deliveryEntryId) {
      setDeliveryError('Send OTP first.');
      return;
    }
    if (!deliveryOtp.trim()) {
      setDeliveryError('Enter OTP to verify.');
      return;
    }
    try {
      setDeliveryError('');
      setDeliveryBusy(true);
      await apiRequest('/api/security/deliveries/verify-otp', {
        method: 'POST',
        body: { deliveryEntryId, otp: deliveryOtp.trim() },
        raw: true,
      });
      setDeliveryVerified(true);
      setDeliveryStep(DELIVERY_STEPS.VERIFIED);
      showToast('OTP verified. Entry can now be allowed.', 'success');
    } catch (err) {
      setDeliveryVerified(false);
      setDeliveryStep(DELIVERY_STEPS.OTP_SENT);
      setDeliveryError(err.message || 'Invalid or expired OTP.');
    } finally {
      setDeliveryBusy(false);
    }
  }

  async function allowDeliveryEntry() {
    if (deliveryStep !== DELIVERY_STEPS.VERIFIED || !deliveryVerified || !deliveryEntryId) {
      setDeliveryError('Verify OTP before allowing entry.');
      return;
    }
    try {
      setDeliveryError('');
      setDeliveryBusy(true);
      await apiRequest('/api/security/deliveries/allow-entry', {
        method: 'POST',
        body: { deliveryEntryId },
        raw: true,
      });
      showToast('Delivery entry allowed.', 'success');
      resetGateForm('deliveries');
      await loadDeliveryHistory();
    } catch (err) {
      setDeliveryError(err.message || 'Failed to allow entry.');
    } finally {
      setDeliveryBusy(false);
    }
  }

  async function exitDelivery(id) {
    try {
      await apiRequest(`/api/security/deliveries/${id}/exit`, { method: 'PUT', raw: true });
      showToast('Delivery exit marked.', 'success');
      await loadDeliveryHistory();
    } catch (err) {
      showToast(err.message || 'Failed to mark delivery exit.', 'error');
    }
  }

  async function sendDomesticOtp() {
    if (domesticStep !== DOMESTIC_STEPS.INITIAL) return;
    const phone = String(domesticForm.phone || '').trim();
    const staffType = String(domesticForm.staffType || '').trim();
    const flatNumber = String(domesticForm.flatNumber || '').trim();
    if (!phone || !staffType || !flatNumber) {
      setDomesticError('Phone Number, Staff Type and Flat Number are required.');
      return;
    }
    try {
      setDomesticError('');
      setDomesticBusy(true);
      const payload = await apiRequest('/api/domestic-staff/otp/request', {
        method: 'POST',
        body: { phone },
        raw: true,
      });
      setDomesticOtpMeta(payload?.data || null);
      setDomesticVerifiedStaff(null);
      setDomesticStep(DOMESTIC_STEPS.OTP_SENT);
      if (payload?.data?.devOtp) {
        showToast(`OTP sent. Dev OTP: ${payload.data.devOtp}`, 'info');
      } else {
        showToast('OTP sent.', 'success');
      }
    } catch (err) {
      setDomesticError(err.message || 'Failed to send OTP.');
    } finally {
      setDomesticBusy(false);
    }
  }

  async function verifyDomesticOtp() {
    if (domesticStep !== DOMESTIC_STEPS.OTP_SENT) return;
    if (!domesticForm.phone.trim() || !domesticOtp.trim()) {
      setDomesticError('Phone and OTP are required.');
      return;
    }
    try {
      setDomesticError('');
      setDomesticBusy(true);
      const payload = await apiRequest('/api/domestic-staff/otp/verify', {
        method: 'POST',
        body: {
          phone: domesticForm.phone.trim(),
          otp: domesticOtp.trim(),
        },
        raw: true,
      });
      const row = payload?.data || null;
      setDomesticVerifiedStaff(row);
      setDomesticStep(DOMESTIC_STEPS.VERIFIED);
      showToast('OTP verified.', 'success');
    } catch (err) {
      setDomesticVerifiedStaff(null);
      setDomesticError(err.message || 'OTP verification failed.');
    } finally {
      setDomesticBusy(false);
    }
  }

  async function allowDomesticEntry() {
    if (domesticStep !== DOMESTIC_STEPS.VERIFIED || !domesticVerifiedStaff?.staffId) {
      setDomesticError('Verify OTP before allowing entry.');
      return;
    }
    try {
      setDomesticError('');
      setDomesticBusy(true);
      await apiRequest('/api/domestic-staff/entry', {
        method: 'POST',
        body: { staffId: domesticVerifiedStaff.staffId },
        raw: true,
      });
      showToast('Domestic staff entry allowed.', 'success');
      resetGateForm('domestic');
      await loadData({ silent: true });
    } catch (err) {
      setDomesticError(err.message || 'Failed to allow domestic staff entry.');
    } finally {
      setDomesticBusy(false);
    }
  }

  async function markDomesticExit(logId) {
    try {
      await apiRequest(`/api/domestic-staff/entry/${logId}/exit`, { method: 'PUT', raw: true });
      showToast('Domestic staff exit marked.', 'success');
      await loadData({ silent: true });
    } catch (err) {
      showToast(err.message || 'Failed to mark domestic staff exit.', 'error');
    }
  }

  return (
    <div className="space-y-5">
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-white to-sky-50 p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-700">Gate Command Center</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">Smart Gate Management</h2>
          </div>
          <button
            onClick={async () => {
              await loadData({ silent: true });
              if (isGuard && guardTab === 'deliveries') {
                await loadDeliveryHistory();
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <FiSearch className="text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by visitor, phone, purpose, flat or tenant"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
      </motion.section>

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      <section className="grid gap-3 md:grid-cols-5">
        <MetricTile label="Total Visitors" value={statusSummary.total} />
        <MetricTile label="Pending" value={statusSummary.pending} tone="amber" />
        <MetricTile label="Approved" value={statusSummary.approved} tone="emerald" />
        <MetricTile label="Inside" value={statusSummary.entered} tone="cyan" />
        <MetricTile label="Rejected" value={statusSummary.rejected} tone="rose" />
      </section>

      {isGuard && (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleGuardTabChange('visitors')}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${guardTab === 'visitors' ? 'bg-cyan-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
            >
              Visitors
            </button>
            <button
              type="button"
              onClick={() => handleGuardTabChange('domestic')}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${guardTab === 'domestic' ? 'bg-cyan-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
            >
              Domestic Staff
            </button>
            <button
              type="button"
              onClick={() => handleGuardTabChange('deliveries')}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${guardTab === 'deliveries' ? 'bg-cyan-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
            >
              Deliveries
            </button>
          </div>

          {guardTab === 'visitors' && (
            <section className="grid gap-4 xl:grid-cols-[1.05fr,1.45fr]">
              <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onSubmit={createGuardVisitorRequest} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
                <h3 className="text-lg font-semibold text-slate-900">New Visitor Entry</h3>
                <p className="mt-1 text-sm text-slate-500">This request is sent to the selected tenant for approval.</p>
                <div className="mt-3 space-y-3">
                  <input value={guardForm.visitorName} onChange={(e) => setGuardForm((prev) => ({ ...prev, visitorName: e.target.value }))} placeholder="Visitor Name" required className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                  <input value={guardForm.phone} onChange={(e) => setGuardForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone Number" required className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                  <input value={guardForm.purpose} onChange={(e) => setGuardForm((prev) => ({ ...prev, purpose: e.target.value }))} placeholder="Purpose" required className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                  <select value={guardForm.visitingUnit} onChange={(e) => setGuardForm((prev) => ({ ...prev, visitingUnit: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    <option value="">Flat Number</option>
                    {occupiedUnits.map((unit) => (
                      <option key={unit._id} value={unit._id}>
                        {unit.unitNumber || `${unit.wing || ''}${unit.wing ? '-' : ''}${unit.flatNumber || ''}`.replace(/^-/, '')}
                      </option>
                    ))}
                  </select>
                  {guardForm.visitingUnit ? (
                    <div className={`rounded-xl border px-3 py-2 text-xs ${selectedVisitorResident ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                      {selectedVisitorResident
                        ? `Resident: ${selectedVisitorResident.name} (${selectedVisitorResident.email || 'No email'})`
                        : 'Resident details not found for selected flat.'}
                    </div>
                  ) : null}
                  <div className={`rounded-xl border px-3 py-2 ${visitorEmergencyOverride ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
                    <button
                      type="button"
                      onClick={() => setVisitorEmergencyOverride((prev) => !prev)}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${visitorEmergencyOverride ? 'bg-rose-600 text-white ring-rose-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-100'}`}
                    >
                      <FiAlertTriangle />
                      {visitorEmergencyOverride ? 'Emergency Override ON' : 'Emergency Override OFF'}
                    </button>
                    <p className="mt-1 text-[11px] text-slate-500">Use only for ambulance, police, medical, or fire emergencies.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="w-full rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700">Submit Request</button>
                    <button
                      type="button"
                      onClick={() => resetGateForm('visitors')}
                      className="w-full rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200"
                    >
                      Clear Form
                    </button>
                  </div>
                </div>
              </motion.form>

              <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
                <h3 className="text-lg font-semibold text-slate-900">Live Guard Feed</h3>
                <p className="mt-1 text-sm text-slate-500">Track approval and entry states instantly.</p>
                <div className="mt-4 space-y-3">
                  {loading ? (
                    <p className="text-sm text-slate-500">Loading visitors...</p>
                  ) : (
                    filteredVisitors.map((visitor) => (
                      <div key={visitor._id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-slate-900">{visitor.visitorName}</p>
                          <div className="flex items-center gap-2">
                            {visitor.isEmergency ? <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700">Emergency</span> : null}
                            <StatusBadge status={visitor.status} />
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{visitor.phone} | {visitor.purpose}</p>
                        <p className="mt-1 text-xs text-slate-500">Flat: {visitor.visitingUnit?.unitNumber || '-'} | Tenant: {visitor.residentId?.name || '-'}</p>
                        <p className="mt-1 text-xs text-slate-500">Requested: {formatDateTime(visitor.requestedEntryTime)}</p>
                        {visitor.rejectionReason && <p className="mt-1 text-xs text-rose-600">Reason: {visitor.rejectionReason}</p>}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {['Approved', 'Expected', 'Pending'].includes(visitor.status) && (
                            <button onClick={() => markEntry(visitor._id)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Mark Entry</button>
                          )}
                          {visitor.status === 'Entered' && (
                            <button onClick={() => markExit(visitor._id)} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">Mark Exit</button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {!loading && !filteredVisitors.length && <p className="text-sm text-slate-500">No visitor records found.</p>}
                </div>
              </motion.section>
            </section>
          )}

          {guardTab === 'domestic' && (
            <section className="grid gap-4 xl:grid-cols-[1.05fr,1.45fr]">
              <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
                <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900"><FiUsers /> Domestic Staff Entry</h3>
                <p className="mt-1 text-sm text-slate-500">Verify staff OTP and allow gate entry.</p>
                <div className="mt-3 space-y-3">
                  <input
                    value={domesticForm.phone}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDomesticForm((prev) => ({ ...prev, phone: value }));
                      if (domesticStep !== DOMESTIC_STEPS.INITIAL) {
                        setDomesticStep(DOMESTIC_STEPS.INITIAL);
                        setDomesticOtp('');
                        setDomesticVerifiedStaff(null);
                        setDomesticOtpMeta(null);
                      }
                      setDomesticError('');
                    }}
                    placeholder="Phone Number"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <input
                    value={domesticForm.staffType}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDomesticForm((prev) => ({ ...prev, staffType: value }));
                      if (domesticStep !== DOMESTIC_STEPS.INITIAL) {
                        setDomesticStep(DOMESTIC_STEPS.INITIAL);
                        setDomesticOtp('');
                        setDomesticVerifiedStaff(null);
                        setDomesticOtpMeta(null);
                      }
                      setDomesticError('');
                    }}
                    placeholder="Staff Type (Maid / Cook / Driver)"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <select
                    value={domesticForm.flatNumber}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDomesticForm((prev) => ({ ...prev, flatNumber: value }));
                      if (domesticStep !== DOMESTIC_STEPS.INITIAL) {
                        setDomesticStep(DOMESTIC_STEPS.INITIAL);
                        setDomesticOtp('');
                        setDomesticVerifiedStaff(null);
                        setDomesticOtpMeta(null);
                      }
                      setDomesticError('');
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="">Flat Number</option>
                    {occupiedUnits.map((unit) => (
                      <option key={`domestic-${unit._id}`} value={unit.unitNumber || unit.flatNumber || ''}>
                        {unit.unitNumber || `${unit.wing || ''}${unit.wing ? '-' : ''}${unit.flatNumber || ''}`.replace(/^-/, '')}
                      </option>
                    ))}
                  </select>
                  {(domesticStep === DOMESTIC_STEPS.OTP_SENT || domesticStep === DOMESTIC_STEPS.VERIFIED) && (
                    <input
                      value={domesticOtp}
                      onChange={(e) => {
                        setDomesticOtp(e.target.value);
                        setDomesticError('');
                      }}
                      placeholder="Enter OTP"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  )}
                  <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                    <button
                      type="button"
                      onClick={sendDomesticOtp}
                      disabled={domesticBusy || domesticStep !== DOMESTIC_STEPS.INITIAL}
                      className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Send OTP
                    </button>
                    <button
                      type="button"
                      onClick={verifyDomesticOtp}
                      disabled={domesticBusy || domesticStep !== DOMESTIC_STEPS.OTP_SENT}
                      className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Verify OTP
                    </button>
                    <button
                      type="button"
                      onClick={allowDomesticEntry}
                      disabled={domesticBusy || domesticStep !== DOMESTIC_STEPS.VERIFIED}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Allow Entry
                    </button>
                    <button
                      type="button"
                      onClick={() => resetGateForm('domestic')}
                      disabled={domesticBusy}
                      className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200 disabled:opacity-60"
                    >
                      Clear Form
                    </button>
                  </div>
                  {domesticError ? (
                    <p className="rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-700">{domesticError}</p>
                  ) : null}
                  {domesticOtpMeta?.devOtp ? (
                    <p className="rounded-lg bg-indigo-50 px-2 py-1 text-xs text-indigo-700">Dev OTP: {domesticOtpMeta.devOtp}</p>
                  ) : null}
                </div>
              </motion.section>

              <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
                <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900"><FiClock /> Live Logs</h3>
                <p className="mt-1 text-sm text-slate-500">Domestic staff entries currently inside the society.</p>
                <div className="mt-4 space-y-3">
                  {domesticEntries.map((row) => (
                    <div key={row._id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">{row.staffId?.name || '-'}</p>
                        <StatusBadge status="Entered" />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Staff Type: {row.staffId?.workType || '-'}</p>
                      <p className="text-xs text-slate-500">Flat: {row.houseNumber || '-'}</p>
                      <p className="text-xs text-slate-500">Entry: {formatDateTime(row.entryTime)}</p>
                      <p className="text-xs text-slate-500">Exit: {formatDateTime(row.exitTime)}</p>
                      <button
                        type="button"
                        onClick={() => markDomesticExit(row._id)}
                        className="mt-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                      >
                        Mark Exit
                      </button>
                    </div>
                  ))}
                  {!domesticEntries.length && <p className="text-sm text-slate-500">No domestic staff logs found.</p>}
                </div>
              </motion.section>
            </section>
          )}

          {guardTab === 'deliveries' && (
            <section className="grid gap-4 xl:grid-cols-[1.05fr,1.45fr]">
              <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
                <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900"><FiTruck /> Delivery OTP Entry</h3>
                <p className="mt-1 text-sm text-slate-500">Guard must verify resident OTP before allowing delivery person entry.</p>
                <div className="mt-3 space-y-3">
                  <select
                    value={deliveryForm.deliveryType}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDeliveryForm((prev) => ({ ...prev, deliveryType: value }));
                      if (deliveryStep !== DELIVERY_STEPS.INITIAL) {
                        setDeliveryEntryId('');
                        setDeliveryOtp('');
                        setDeliveryOtpMeta(null);
                        setDeliveryVerified(false);
                        setDeliveryStep(DELIVERY_STEPS.INITIAL);
                      }
                      setDeliveryError('');
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="Swiggy">Swiggy</option>
                    <option value="Zomato">Zomato</option>
                    <option value="Amazon">Amazon</option>
                    <option value="Flipkart">Flipkart</option>
                    <option value="Other">Other</option>
                  </select>
                  <input
                    value={deliveryForm.deliveryPersonName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDeliveryForm((prev) => ({ ...prev, deliveryPersonName: value }));
                      if (deliveryStep !== DELIVERY_STEPS.INITIAL) {
                        setDeliveryEntryId('');
                        setDeliveryOtp('');
                        setDeliveryOtpMeta(null);
                        setDeliveryVerified(false);
                        setDeliveryStep(DELIVERY_STEPS.INITIAL);
                      }
                      setDeliveryError('');
                    }}
                    placeholder="Delivery Person Name"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <input
                    value={deliveryForm.phone}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDeliveryForm((prev) => ({ ...prev, phone: value }));
                      if (deliveryStep !== DELIVERY_STEPS.INITIAL) {
                        setDeliveryEntryId('');
                        setDeliveryOtp('');
                        setDeliveryOtpMeta(null);
                        setDeliveryVerified(false);
                        setDeliveryStep(DELIVERY_STEPS.INITIAL);
                      }
                      setDeliveryError('');
                    }}
                    placeholder="Delivery Person Phone Number"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <select
                    value={deliveryForm.flatNumber}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDeliveryForm((prev) => ({ ...prev, flatNumber: value }));
                      if (deliveryStep !== DELIVERY_STEPS.INITIAL) {
                        setDeliveryEntryId('');
                        setDeliveryOtp('');
                        setDeliveryOtpMeta(null);
                        setDeliveryVerified(false);
                        setDeliveryStep(DELIVERY_STEPS.INITIAL);
                      }
                      setDeliveryError('');
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="">Flat / House Number</option>
                    {occupiedUnits.map((unit) => (
                      <option key={`delivery-${unit._id}`} value={unit.unitNumber || unit.flatNumber || ''}>
                        {unit.unitNumber || `${unit.wing || ''}${unit.wing ? '-' : ''}${unit.flatNumber || ''}`.replace(/^-/, '')}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setDeliveryEmergencyOverride((prev) => !prev)}
                    className={`w-full rounded-xl px-3 py-2 text-xs font-semibold ring-1 ${deliveryEmergencyOverride ? 'bg-rose-600 text-white ring-rose-600' : 'bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100'}`}
                  >
                    {deliveryEmergencyOverride ? 'Emergency Override: ON' : 'Emergency Override: OFF'}
                  </button>
                  {deliveryResident ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                      <p>Resident: {deliveryResident.residentName}</p>
                      <p>Phone: {deliveryResident.residentPhone || '-'}</p>
                      <p>Resident ID: {deliveryResident.residentId}</p>
                    </div>
                  ) : (
                    <div className={`rounded-xl p-3 text-xs ${deliveryLookupError ? 'border border-rose-200 bg-rose-50 text-rose-700' : 'border border-amber-200 bg-amber-50 text-amber-800'}`}>
                      {deliveryLookupError || 'Select flat number to fetch resident details.'}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                    <button type="button" onClick={sendDeliveryOtp} disabled={deliveryBusy || !deliveryResident || deliveryStep !== DELIVERY_STEPS.INITIAL} className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Send OTP</button>
                    <button type="button" onClick={verifyDeliveryOtp} disabled={deliveryBusy || deliveryStep !== DELIVERY_STEPS.OTP_SENT} className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Verify OTP</button>
                    <button type="button" onClick={allowDeliveryEntry} disabled={deliveryBusy || deliveryStep !== DELIVERY_STEPS.VERIFIED} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Allow Entry</button>
                    <button
                      type="button"
                      onClick={() => resetGateForm('deliveries')}
                      disabled={deliveryBusy}
                      className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200 disabled:opacity-60"
                    >
                      Clear Form
                    </button>
                  </div>
                  {(deliveryStep === DELIVERY_STEPS.OTP_SENT || deliveryStep === DELIVERY_STEPS.VERIFIED) && (
                    <input
                      value={deliveryOtp}
                      onChange={(e) => {
                        setDeliveryOtp(e.target.value);
                        setDeliveryError('');
                      }}
                      placeholder="Enter OTP"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  )}
                  {deliveryError ? (
                    <p className="rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-700">{deliveryError}</p>
                  ) : null}
                  {deliveryOtpMeta?.devOtp ? (
                    <p className="rounded-lg bg-indigo-50 px-2 py-1 text-xs text-indigo-700">Dev OTP: {deliveryOtpMeta.devOtp}</p>
                  ) : null}
                </div>
              </motion.section>

              <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
                <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900"><FiPackage /> Delivery History</h3>
                <p className="mt-1 text-sm text-slate-500">Track pending, entered and exited deliveries per flat.</p>
                <div className="mt-4 space-y-3">
                  {deliveryHistory.map((item) => (
                    <div key={item._id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">{item.deliveryType} - {item.deliveryPersonName}</p>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Phone: {item.phone}</p>
                      <p className="text-xs text-slate-500">Flat: {item.flatNumber} | Resident: {item.residentId?.name || '-'}</p>
                      <p className="text-xs text-slate-500">Entry: {formatDateTime(item.entryTime)} | Exit: {formatDateTime(item.exitTime)}</p>
                      {item.status === 'Entered' && (
                        <button type="button" onClick={() => exitDelivery(item._id)} className="mt-2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">
                          Mark Exit
                        </button>
                      )}
                    </div>
                  ))}
                  {!deliveryHistory.length && <p className="text-sm text-slate-500">No delivery history found.</p>}
                </div>
              </motion.section>
            </section>
          )}
        </section>
      )}

      {isTenant && (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs uppercase tracking-wide text-amber-700">Pending Requests</p>
              <p className="mt-2 text-2xl font-semibold text-amber-800">{tenantPending.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-700">Approved Visitors</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-800">{tenantApproved.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-600">Visitor History</p>
              <p className="mt-2 text-2xl font-semibold text-slate-800">{tenantHistory.length}</p>
            </div>
          </div>

          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
            <div className="flex items-center gap-2">
              <FiBell className="text-amber-500" />
              <h3 className="text-lg font-semibold text-slate-900">Pending Visitor Requests</h3>
            </div>
            <div className="mt-3 space-y-3">
              {tenantPending.map((visitor) => (
                <div key={visitor._id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{visitor.visitorName}</p>
                    <StatusBadge status={visitor.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{visitor.phone} | {visitor.purpose}</p>
                  <p className="mt-1 text-xs text-slate-500">Flat: {visitor.visitingUnit?.unitNumber || '-'} | Guard: {visitor.createdByGuard?.name || '-'}</p>
                  <p className="mt-1 text-xs text-slate-500">Requested: {formatDateTime(visitor.requestedEntryTime)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Rejection reason (optional)" className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                    <button onClick={() => approveVisitor(visitor._id)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"><FiCheck /> Approve</button>
                    <button onClick={() => markVisitorEmergency(visitor._id)} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"><FiAlertTriangle /> Emergency</button>
                    <button onClick={() => rejectVisitor(visitor._id)} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"><FiUserX /> Reject</button>
                    <button onClick={callGuard} className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700"><FiPhone /> Call Guard</button>
                  </div>
                </div>
              ))}
              {!tenantPending.length && <p className="text-sm text-slate-500">No pending requests.</p>}
            </div>
          </motion.section>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <h3 className="text-lg font-semibold text-slate-900">Approved Visitors</h3>
              <div className="mt-3 space-y-2">
                {tenantApproved.map((visitor) => (
                  <div key={visitor._id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="font-semibold text-slate-900">{visitor.visitorName}</p>
                    <p className="text-xs text-slate-500">{visitor.purpose} | QR: {visitor.qrApprovalCode || '-'}</p>
                  </div>
                ))}
                {!tenantApproved.length && <p className="text-sm text-slate-500">No approved visitors.</p>}
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <h3 className="text-lg font-semibold text-slate-900">Visitor History Timeline</h3>
              <div className="mt-3 space-y-2">
                {tenantHistory.map((visitor) => (
                  <div key={visitor._id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{visitor.visitorName}</p>
                      <StatusBadge status={visitor.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Entry: {formatDateTime(visitor.entryTime)} | Exit: {formatDateTime(visitor.exitTime)}</p>
                  </div>
                ))}
                {!tenantHistory.length && <p className="text-sm text-slate-500">No visitor history.</p>}
              </div>
            </section>
          </div>
        </section>
      )}

      {isAdminView && (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Logs</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{filteredVisitors.length}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-panel">
              <p className="text-xs uppercase tracking-wide text-amber-700">Pending Approvals</p>
              <p className="mt-2 text-2xl font-semibold text-amber-800">{analytics.pendingApprovals || 0}</p>
            </div>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-panel">
              <p className="text-xs uppercase tracking-wide text-cyan-700">Week Count</p>
              <p className="mt-2 text-2xl font-semibold text-cyan-800">{(analytics.dailyCounts || []).reduce((sum, item) => sum + (item.count || 0), 0)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-panel">
              <p className="text-xs uppercase tracking-wide text-emerald-700">Approved Today</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-800">{(analytics.statusBreakdown || []).find((item) => item._id === 'Approved')?.count || 0}</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr,1fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <h3 className="text-lg font-semibold text-slate-900">Daily Visitor Count</h3>
              <p className="mt-1 text-sm text-slate-500">Weekly trend for visitor requests.</p>
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.dailyCounts || []}>
                    <defs>
                      <linearGradient id="visitorLine" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="_id" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke="#0891b2" fill="url(#visitorLine)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <h3 className="text-lg font-semibold text-slate-900">Filter Logs</h3>
              <div className="mt-3 space-y-3">
                <input value={filters.name} onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))} placeholder="Visitor name" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <input value={filters.flat} onChange={(e) => setFilters((prev) => ({ ...prev, flat: e.target.value }))} placeholder="Flat number" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <option value="">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Entered">Entered</option>
                  <option value="Exited">Exited</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <input type="date" value={filters.dateTo} onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
            <div className="flex items-center gap-2">
              <FiCalendar className="text-cyan-600" />
              <h3 className="text-lg font-semibold text-slate-900">Visitor Timeline Logs</h3>
            </div>
            <div className="mt-4 space-y-3">
              {loading ? (
                <p className="text-sm text-slate-500">Loading logs...</p>
              ) : (
                filteredVisitors.map((visitor) => (
                  <div key={visitor._id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{visitor.visitorName}</p>
                        <p className="text-xs text-slate-500">{visitor.phone} | Flat: {visitor.visitingUnit?.unitNumber || '-'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {visitor.isEmergency ? <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700">Emergency</span> : null}
                        <StatusBadge status={visitor.status} />
                      </div>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-slate-500 md:grid-cols-2">
                      <p className="inline-flex items-center gap-1"><FiUsers /> Tenant: {visitor.residentId?.name || '-'}</p>
                      <p className="inline-flex items-center gap-1"><FiShield /> Guard: {visitor.createdByGuard?.name || '-'}</p>
                      <p className="inline-flex items-center gap-1"><FiClock /> Requested: {formatDateTime(visitor.requestedEntryTime || visitor.createdAt)}</p>
                      <p className="inline-flex items-center gap-1"><FiBell /> Approved By: {visitor.approvedBy?.name || '-'}</p>
                    </div>
                    {!visitor.isEmergency ? (
                      <button onClick={() => markVisitorEmergency(visitor._id)} className="mt-2 inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">
                        <FiAlertTriangle />
                        Mark Emergency
                      </button>
                    ) : null}
                  </div>
                ))
              )}
              {!loading && !filteredVisitors.length && <p className="text-sm text-slate-500">No visitor logs found.</p>}
            </div>
          </section>
        </section>
      )}
    </div>
  );
}

export default VisitorManagementPage;
