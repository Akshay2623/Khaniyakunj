import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import {
  FiActivity,
  FiAlertTriangle,
  FiBarChart2,
  FiBell,
  FiClock,
  FiDollarSign,
  FiHome,
  FiLayers,
  FiMapPin,
  FiShield,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext.jsx';

function MetricCard({ label, value, icon: Icon, tone = 'blue' }) {
  const toneMap = {
    blue: 'from-blue-500/15 to-cyan-500/15 text-blue-700 dark:text-blue-200',
    green: 'from-emerald-500/15 to-teal-500/15 text-emerald-700 dark:text-emerald-200',
    amber: 'from-amber-500/15 to-orange-500/15 text-amber-700 dark:text-amber-200',
    rose: 'from-rose-500/15 to-red-500/15 text-rose-700 dark:text-rose-200',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900/90"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`rounded-xl bg-gradient-to-r p-2 ${toneMap[tone] || toneMap.blue}`}>
          <Icon size={14} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
    </motion.div>
  );
}

function MiniBars({ rows = [], color = 'bg-cyan-500' }) {
  const max = useMemo(() => Math.max(1, ...rows.map((item) => Number(item.value || 0))), [rows]);
  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const width = `${Math.max(6, Math.round((Number(row.value || 0) / max) * 100))}%`;
        return (
          <div key={row.label} className="grid grid-cols-[110px,1fr,56px] items-center gap-2 text-xs">
            <span className="truncate text-slate-500 dark:text-slate-400">{row.label}</span>
            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800">
              <div className={`h-full rounded-full ${color}`} style={{ width }} />
            </div>
            <span className="text-right font-semibold text-slate-700 dark:text-slate-200">{row.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function TrendBars({ rows = [] }) {
  const max = useMemo(() => Math.max(1, ...rows.map((item) => Number(item.total || 0))), [rows]);
  return (
    <div className="grid gap-2">
      {rows.map((row) => {
        const total = Number(row.total || 0);
        const completed = Number(row.completed || 0);
        const totalWidth = `${Math.max(6, Math.round((total / max) * 100))}%`;
        const completedRatio = total > 0 ? Math.max(0, Math.min(100, Math.round((completed / total) * 100))) : 0;
        return (
          <div key={row.month} className="grid grid-cols-[74px,1fr,66px] items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">{row.label}</span>
            <div className="relative h-2.5 rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-blue-300/70" style={{ width: totalWidth }} />
              <div className="absolute left-0 top-0 h-full rounded-full bg-cyan-500" style={{ width: `${(parseFloat(totalWidth) * completedRatio) / 100}%` }} />
            </div>
            <span className="text-right font-semibold text-slate-700 dark:text-slate-200">{completed}/{total}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(String(monthKey))) return String(monthKey || '-');
  const [y, m] = String(monthKey).split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  if (Number.isNaN(date.getTime())) return String(monthKey);
  return date.toLocaleString(undefined, { month: 'short' });
}

function DashboardPage() {
  const { apiRequest, admin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [societiesCount, setSocietiesCount] = useState(0);
  const [residentsCount, setResidentsCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [dueAmount, setDueAmount] = useState(0);
  const [visitorsToday, setVisitorsToday] = useState(0);
  const [activeEmergency, setActiveEmergency] = useState(null);
  const [recentNotices, setRecentNotices] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [serviceStatusRows, setServiceStatusRows] = useState([]);
  const [activityRows, setActivityRows] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    totals: { totalResidents: 0, totalFlats: 0, pendingComplaints: 0, overdueBills: 0 },
    monthlyRevenue: { month: '', paidAmount: 0, lateFeeCollected: 0, totalRevenue: 0, billCount: 0 },
    complaintDistributionByCategory: [],
    serviceRequestTrend: [],
  });

  const role = String(admin?.role || '').toLowerCase().replace(/[\s-]+/g, '_');
  const isResident = ['resident', 'tenant', 'owner'].includes(role);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError('');

        if (isResident) {
          const [residentDashboard, noticesPayload, notificationsPayload] = await Promise.all([
            apiRequest('/api/resident/dashboard', { raw: true }).catch(() => ({ data: null })),
            apiRequest('/api/notices?limit=5', { raw: true }).catch(() => ({ data: [] })),
            apiRequest('/api/notifications?limit=10', { raw: true }).catch(() => ({ unreadCount: 0 })),
          ]);

          const summary = residentDashboard?.data || {};
          setSocietiesCount(1);
          setResidentsCount(Number(summary.familyMembersCount || 0));
          setPendingRequests(Number(summary.pendingServiceRequests || 0));
          setDueAmount(Number(summary.totalMaintenanceDue || 0));
          setVisitorsToday(Number(summary.visitorCountThisMonth || 0));
          setRecentNotices(noticesPayload?.data || []);
          setUnreadNotifications(Number(notificationsPayload?.unreadCount || 0));
          setServiceStatusRows([
            { label: 'Pending', value: Number(summary.pendingServiceRequests || 0) },
            { label: 'Amenities', value: Number(summary.upcomingAmenities || 0) },
            { label: 'Notices', value: Number((noticesPayload?.data || []).length) },
          ]);
          setActivityRows(
            (noticesPayload?.data || []).slice(0, 5).map((n) => ({
              id: n._id,
              title: n.title || 'Notice',
              time: n.createdAt ? new Date(n.createdAt).toLocaleString() : '-',
            }))
          );
          return;
        }

        const societyId = admin?.societyId ? `?societyId=${admin.societyId}` : '';
        const [societies, residents, requests, maintenance, visitors, emergencies, notices, notifications, statsPayload] = await Promise.all([
          apiRequest('/api/societies').catch(() => []),
          apiRequest(`/api/residents${societyId}`, { raw: true }).catch(() => ({ data: [] })),
          apiRequest(`/api/service-requests${societyId}`, { raw: true }).catch(() => ({ data: [] })),
          apiRequest(`/api/maintenance${societyId ? `${societyId}&limit=200` : '?limit=200'}`, { raw: true }).catch(() => ({ data: [] })),
          apiRequest(`/api/visitors/analytics${societyId}`, { raw: true }).catch(() => ({ data: { pendingApprovals: 0 } })),
          apiRequest(`/api/security/emergency-alerts${societyId ? `${societyId}&includeResolved=true` : '?includeResolved=true'}`, { raw: true }).catch(() => ({ data: [] })),
          apiRequest(`/api/notices${societyId ? `${societyId}&limit=6` : '?limit=6'}`, { raw: true }).catch(() => ({ data: [] })),
          apiRequest('/api/notifications?limit=10', { raw: true }).catch(() => ({ unreadCount: 0 })),
          apiRequest(`/api/dashboard/stats${societyId}`, { raw: true }).catch(() => null),
        ]);

        const residentRows = Array.isArray(residents?.data) ? residents.data : Array.isArray(residents) ? residents : [];
        const requestRows = Array.isArray(requests?.data) ? requests.data : Array.isArray(requests) ? requests : [];
        const maintenanceRows = Array.isArray(maintenance?.data) ? maintenance.data : [];
        const emergencyRows = Array.isArray(emergencies?.data) ? emergencies.data : [];
        const noticesRows = Array.isArray(notices?.data) ? notices.data : [];

        const pending = requestRows.filter((r) => ['Pending', 'Assigned', 'InProgress'].includes(String(r.status || ''))).length;
        const due = maintenanceRows
          .filter((bill) => String(bill.paymentStatus || '').toLowerCase() !== 'paid')
          .reduce((sum, bill) => sum + Number(bill.totalAmount || 0), 0);
        const active = emergencyRows.find((row) => String(row.status || 'ACTIVE').toUpperCase() === 'ACTIVE') || null;

        const statusMap = new Map();
        requestRows.forEach((r) => {
          const key = String(r.status || 'Pending');
          statusMap.set(key, (statusMap.get(key) || 0) + 1);
        });

        setSocietiesCount(Array.isArray(societies) ? societies.length : 0);
        setResidentsCount(residentRows.length);
        setPendingRequests(pending);
        setDueAmount(due);
        setVisitorsToday(Number(visitors?.data?.pendingApprovals || 0));
        setActiveEmergency(active);
        setRecentNotices(noticesRows.slice(0, 5));
        setUnreadNotifications(Number(notifications?.unreadCount || 0));
        setServiceStatusRows(Array.from(statusMap.entries()).slice(0, 6).map(([label, value]) => ({ label, value })));
        setActivityRows(
          requestRows.slice(0, 6).map((r) => ({
            id: r._id,
            title: r.title || 'Service request',
            time: r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '-',
          }))
        );
        setDashboardStats({
          totals: statsPayload?.totals || { totalResidents: 0, totalFlats: 0, pendingComplaints: 0, overdueBills: 0 },
          monthlyRevenue: statsPayload?.monthlyRevenue || { month: '', paidAmount: 0, lateFeeCollected: 0, totalRevenue: 0, billCount: 0 },
          complaintDistributionByCategory: statsPayload?.complaintDistributionByCategory || [],
          serviceRequestTrend: statsPayload?.serviceRequestTrend || [],
        });
      } catch (err) {
        setError(err.message || 'Failed to load dashboard.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [apiRequest, admin?.societyId, isResident]);

  const complaintRows = useMemo(() => {
    const rows = (dashboardStats.complaintDistributionByCategory || []).map((row) => ({
      label: row.category || 'General',
      value: Number(row.count || 0),
    }));
    return rows.length ? rows : [{ label: 'No data', value: 0 }];
  }, [dashboardStats.complaintDistributionByCategory]);

  const trendRows = useMemo(() => {
    const rows = (dashboardStats.serviceRequestTrend || []).map((row) => ({
      ...row,
      label: formatMonthLabel(row.month),
    }));
    return rows.length ? rows : [{ month: 'na', label: 'NA', total: 0, completed: 0 }];
  }, [dashboardStats.serviceRequestTrend]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-cyan-200/70 bg-gradient-to-br from-cyan-100 via-white to-indigo-100 p-6"
      >
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">Dashboard</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Modern Operations Overview</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Real-time snapshot of residents, service flow, alerts, finances, and notices in a cleaner executive layout.
          </p>
        </div>
      </motion.section>

      {activeEmergency ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-rose-300 bg-rose-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-700">
            <FiAlertTriangle /> Active Emergency
          </p>
          <p className="mt-1 text-sm text-rose-700">
            {activeEmergency.alertType}: {activeEmergency.description} ({activeEmergency.location})
          </p>
        </motion.div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Societies" value={societiesCount} icon={FiLayers} tone="blue" />
        <MetricCard label="Residents" value={residentsCount} icon={FiUsers} tone="green" />
        <MetricCard label="Pending Requests" value={pendingRequests} icon={FiActivity} tone="amber" />
        <MetricCard label="Maintenance Due" value={`INR ${dueAmount.toFixed(2)}`} icon={FiDollarSign} tone="rose" />
        <MetricCard label="Unread Alerts" value={unreadNotifications} icon={FiBell} tone="blue" />
      </div>

      {!isResident ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Flats" value={dashboardStats.totals.totalFlats || 0} icon={FiHome} tone="blue" />
          <MetricCard label="Overdue Bills" value={dashboardStats.totals.overdueBills || 0} icon={FiAlertTriangle} tone="rose" />
          <MetricCard label="Monthly Revenue" value={`INR ${Number(dashboardStats.monthlyRevenue.totalRevenue || 0).toFixed(2)}`} icon={FiTrendingUp} tone="green" />
          <MetricCard label="Paid Bills" value={dashboardStats.monthlyRevenue.billCount || 0} icon={FiDollarSign} tone="amber" />
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel xl:col-span-2 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Service Workflow Pulse</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Status distribution with compact modern bars</p>
          <div className="mt-4">
            <MiniBars rows={serviceStatusRows.length ? serviceStatusRows : [{ label: 'No data', value: 0 }]} />
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Today Highlights</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
              <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300"><FiShield size={14} /> Visitor Approvals</span>
              <span className="font-semibold text-slate-900 dark:text-white">{visitorsToday}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
              <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300"><FiMapPin size={14} /> Active Notices</span>
              <span className="font-semibold text-slate-900 dark:text-white">{recentNotices.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
              <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300"><FiHome size={14} /> Role</span>
              <span className="font-semibold capitalize text-slate-900 dark:text-white">{role || 'user'}</span>
            </div>
          </div>
        </motion.section>
      </div>

      {!isResident ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel xl:col-span-2 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">6-Month Service Trend</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Completed vs total requests</p>
            <div className="mt-4">
              <TrendBars rows={trendRows} />
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Complaint Mix</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">By service category</p>
            <div className="mt-4">
              <MiniBars rows={complaintRows} color="bg-blue-500" />
            </div>
            <p className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <FiBarChart2 size={12} /> Month: {dashboardStats.monthlyRevenue.month || '-'}
            </p>
          </motion.section>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
          <div className="mt-3 space-y-2">
            {activityRows.slice(0, 6).map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                <p className="font-medium text-slate-800 dark:text-slate-100">{row.title}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.time}</p>
              </div>
            ))}
            {!activityRows.length ? <p className="text-sm text-slate-500">No activity yet.</p> : null}
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Notices</h3>
          <div className="mt-3 space-y-2">
            {recentNotices.map((notice) => (
              <div key={notice._id} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{notice.title || 'Notice'}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{notice.description || '-'}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <FiClock size={11} />
                  {notice.createdAt ? new Date(notice.createdAt).toLocaleString() : '-'}
                </p>
              </div>
            ))}
            {!recentNotices.length ? <p className="text-sm text-slate-500">No notices available.</p> : null}
          </div>
        </motion.section>
      </div>

      {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}
    </div>
  );
}

export default DashboardPage;
