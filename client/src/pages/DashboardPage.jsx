import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  FiActivity,
  FiAlertTriangle,
  FiBellOff,
  FiBell,
  FiClipboard,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiExternalLink,
  FiHome,
  FiLayers,
  FiMapPin,
  FiMessageCircle,
  FiPackage,
  FiShieldOff,
  FiSend,
  FiShield,
  FiTruck,
  FiTrendingUp,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { useNavigate } from 'react-router-dom';

const PIE_COLORS = ['#0ea5e9', '#14b8a6', '#6366f1', '#f59e0b', '#ef4444', '#334155'];

function CountUpValue({ value, prefix = '', suffix = '', decimals = 0 }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const target = Number(value || 0);
    const duration = 700;
    const startAt = performance.now();

    let frame;
    function animate(now) {
      const progress = Math.min((now - startAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(target * eased);
      if (progress < 1) frame = requestAnimationFrame(animate);
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return `${prefix}${displayValue.toFixed(decimals)}${suffix}`;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-40 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800 xl:col-span-2" />
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone = 'neutral', prefix = '', suffix = '', decimals = 0 }) {
  const toneClass =
    tone === 'danger'
      ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
      : tone === 'success'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
      : tone === 'accent'
      ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-200'
      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`rounded-xl p-2 ${toneClass}`}>
          <Icon size={15} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
        <CountUpValue value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </p>
    </motion.div>
  );
}

function ChartShell({ title, subtitle, children, className = '' }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </motion.section>
  );
}

function aggregateBookingStatuses(bookings = []) {
  const base = { Pending: 0, Approved: 0, Rejected: 0, Completed: 0 };
  bookings.forEach((item) => {
    const key = item?.bookingStatus;
    if (Object.prototype.hasOwnProperty.call(base, key)) base[key] += 1;
  });
  return Object.entries(base).map(([name, value]) => ({ name, value }));
}

function aggregateBookingsByDate(rows = []) {
  const map = new Map();
  rows.forEach((item) => {
    const rawDate = item?.date || item?.bookingDate;
    if (!rawDate) return;
    const day = new Date(rawDate).toISOString().slice(0, 10);
    map.set(day, (map.get(day) || 0) + 1);
  });
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));
}

function ResidentDashboard() {
  const { apiRequest } = useAuth();
  const { showToast } = useToast();
  const [dashboard, setDashboard] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [amenityBookings, setAmenityBookings] = useState([]);
  const [amenityCalendar, setAmenityCalendar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndTimer, setDndTimer] = useState('manual');
  const [dndExpiryTime, setDndExpiryTime] = useState(null);
  const [dndSaving, setDndSaving] = useState(false);
  const [familySummary, setFamilySummary] = useState({ totalMembers: 0, children: 0, teens: 0, adults: 0, seniorCitizens: 0 });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');

        const calendarFrom = new Date();
        const calendarTo = new Date();
        calendarTo.setDate(calendarTo.getDate() + 30);

        const [dashboardPayload, analyticsPayload, myBookingsPayload, calendarPayload, familySummaryPayload] = await Promise.all([
          apiRequest('/api/resident/dashboard', { raw: true }),
          apiRequest('/api/resident/financial-analytics', { raw: true }),
          apiRequest('/api/amenities/my-bookings').catch(() => []),
          apiRequest(`/api/amenities/calendar?from=${calendarFrom.toISOString().slice(0, 10)}&to=${calendarTo.toISOString().slice(0, 10)}`).catch(() => []),
          apiRequest('/api/family-members/summary', { raw: true }).catch(() => ({ data: null })),
        ]);

        setDashboard(dashboardPayload.data || null);
        const dndPayload = dashboardPayload?.data?.dnd || {};
        setDndEnabled(Boolean(dndPayload.enabled));
        setDndExpiryTime(dndPayload.expiryTime || null);
        if (dndPayload.expiryTime) {
          const remainingMs = new Date(dndPayload.expiryTime).getTime() - Date.now();
          if (remainingMs > 90 * 60 * 1000) setDndTimer('2h');
          else if (remainingMs > 45 * 60 * 1000) setDndTimer('1h');
          else if (remainingMs > 0) setDndTimer('30m');
          else setDndTimer('manual');
        } else {
          setDndTimer('manual');
        }
        setAnalytics(analyticsPayload.data || null);
        setAmenityBookings(Array.isArray(myBookingsPayload) ? myBookingsPayload : []);
        setAmenityCalendar(Array.isArray(calendarPayload) ? calendarPayload : []);
        setFamilySummary(
          familySummaryPayload?.data || { totalMembers: 0, children: 0, teens: 0, adults: 0, seniorCitizens: 0 }
        );
      } catch (err) {
        setError(err.message || 'Failed to load resident dashboard.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const paymentTrendData = useMemo(() => {
    const labels = analytics?.monthlyPayments?.labels || [];
    const paidValues = analytics?.monthlyPayments?.datasets?.[0]?.data || [];
    const dueValues = analytics?.outstandingBalanceTrend?.datasets?.[0]?.data || [];
    return labels.map((label, idx) => ({ label, paid: paidValues[idx] || 0, outstanding: dueValues[idx] || 0 }));
  }, [analytics]);

  const paymentBreakdownData = useMemo(() => {
    const labels = analytics?.paymentMethodBreakdown?.labels || [];
    const values = analytics?.paymentMethodBreakdown?.datasets?.[0]?.data || [];
    return labels.map((label, idx) => ({ name: label, value: values[idx] || 0, fill: PIE_COLORS[idx % PIE_COLORS.length] }));
  }, [analytics]);

  const amenityStatusData = useMemo(() => aggregateBookingStatuses(amenityBookings), [amenityBookings]);
  const amenityCalendarTrend = useMemo(() => aggregateBookingsByDate(amenityCalendar), [amenityCalendar]);

  const approvedAmenities = useMemo(
    () => amenityBookings.filter((item) => item.bookingStatus === 'Approved').length,
    [amenityBookings]
  );

  const upcomingAmenities = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return amenityBookings.filter((item) => String(item.bookingDate || '').slice(0, 10) >= today).slice(0, 5);
  }, [amenityBookings]);

  if (loading) return <DashboardSkeleton />;

  async function saveDndState(nextEnabled) {
    try {
      setDndSaving(true);
      const payload = await apiRequest('/api/resident/dnd', {
        method: 'PUT',
        body: { enabled: nextEnabled, timer: dndTimer },
        raw: true,
      });
      const next = payload?.data || {};
      const resolvedEnabled = next.enabled !== undefined ? Boolean(next.enabled) : Boolean(nextEnabled);
      setDndEnabled(resolvedEnabled);
      setDndExpiryTime(next.expiryTime || null);
      const message = payload?.message
        || (resolvedEnabled
          ? 'Do Not Disturb mode enabled. Guards will not send visitor or delivery requests during this time.'
          : 'Do Not Disturb mode disabled.');
      showToast(message, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update Do Not Disturb mode.', 'error');
    } finally {
      setDndSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-indigo-200/70 bg-gradient-to-br from-indigo-100 via-white to-cyan-100 p-6 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800"
      >
        <div className="absolute -right-10 -top-14 h-48 w-48 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-700 dark:text-indigo-300">Resident Pulse Dashboard</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Live Home Operations View</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              Unified trend board for payments, amenities, notices and visitor activity with refreshed analytics visuals.
            </p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <p className="text-xs uppercase tracking-wider text-slate-500">Current Status</p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{dashboard?.statusIndicator || 'Stable'}</p>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Privacy & Availability</p>
            <h3 className="mt-2 inline-flex items-center gap-2 text-xl font-semibold text-slate-900 dark:text-white">
              <FiBellOff className="text-rose-500" />
              Do Not Disturb Mode
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              When enabled, guards cannot call or request approvals for visitors and deliveries unless marked as emergency.
            </p>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${dndEnabled ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'}`}>
            <FiShield size={13} />
            {dndEnabled ? 'Do Not Disturb' : 'Available'}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr,220px,220px]">
          <button
            type="button"
            onClick={() => {
              if (dndSaving) return;
              saveDndState(!dndEnabled);
            }}
            className={`relative inline-flex h-12 items-center rounded-2xl px-3 transition ${dndEnabled ? 'bg-rose-500/15 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200' : 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'}`}
          >
            <span className="text-sm font-semibold">{dndEnabled ? 'Turn DND Off' : 'Turn DND On'}</span>
            <span className={`ml-auto inline-flex h-7 w-12 items-center rounded-full px-1 ${dndEnabled ? 'bg-rose-500' : 'bg-emerald-500'}`}>
              <motion.span
                layout
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                className="h-5 w-5 rounded-full bg-white shadow"
                style={{ marginLeft: dndEnabled ? 'auto' : 0 }}
              />
            </span>
          </button>

          <select
            value={dndTimer}
            onChange={(event) => setDndTimer(event.target.value)}
            disabled={dndSaving}
            className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="30m">30 minutes</option>
            <option value="1h">1 hour</option>
            <option value="2h">2 hours</option>
            <option value="manual">Until manually turned off</option>
          </select>

          <button
            type="button"
            disabled={dndSaving}
            onClick={() => saveDndState(dndEnabled)}
            className="h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 px-4 text-sm font-semibold text-white hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-60"
          >
            {dndSaving ? 'Saving...' : 'Update DND'}
          </button>
        </div>

        {dndEnabled && dndExpiryTime ? (
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
            DND active until {new Date(dndExpiryTime).toLocaleString()}.
          </p>
        ) : null}
      </motion.section>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Maintenance Due"
          value={dashboard?.totalMaintenanceDue || 0}
          icon={FiDollarSign}
          prefix="INR "
          decimals={2}
          tone={(dashboard?.totalMaintenanceDue || 0) > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label="Pending Requests"
          value={dashboard?.pendingServiceRequests || 0}
          icon={FiActivity}
          tone={(dashboard?.pendingServiceRequests || 0) > 0 ? 'danger' : 'success'}
        />
        <StatCard label="Visitors Month" value={dashboard?.visitorCountThisMonth || 0} icon={FiUsers} tone="accent" />
        <StatCard
          label="Payment Completion"
          value={dashboard?.paymentCompletionRate || 0}
          icon={FiTrendingUp}
          suffix="%"
          decimals={2}
          tone={(dashboard?.paymentCompletionRate || 0) >= 75 ? 'success' : 'neutral'}
        />
        <StatCard label="Amenity Bookings" value={amenityBookings.length} icon={FiMapPin} tone="accent" />
        <StatCard label="Approved Amenities" value={approvedAmenities} icon={FiCheckCircle} tone="success" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Family Members" value={familySummary.totalMembers || 0} icon={FiUsers} tone="accent" />
        <StatCard label="Children" value={familySummary.children || 0} icon={FiHome} tone="neutral" />
        <StatCard label="Adults" value={familySummary.adults || 0} icon={FiShield} tone="success" />
        <StatCard label="Senior Citizens" value={familySummary.seniorCitizens || 0} icon={FiClock} tone="neutral" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartShell title="Payments vs Outstanding" subtitle="Monthly comparison line graph" className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={paymentTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dce6f4" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="paid" stroke="#2563eb" strokeWidth={3} dot={false} name="Paid" />
                <Line type="monotone" dataKey="outstanding" stroke="#ef4444" strokeWidth={3} dot={false} name="Outstanding" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartShell>

        <ChartShell title="Payment Method Mix" subtitle="Channel-wise contribution">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentBreakdownData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dce6f4" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 8, 8]}>
                  {paymentBreakdownData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartShell>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartShell title="Amenity Booking Status" subtitle="Donut split of booking outcomes">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={amenityStatusData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3}>
                  {amenityStatusData.map((item, idx) => (
                    <Cell key={item.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartShell>

        <ChartShell title="Amenity Calendar Trend" subtitle="Daily booking volume area view">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={amenityCalendarTrend}>
                <defs>
                  <linearGradient id="amenityTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#dce6f4" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#14b8a6" fill="url(#amenityTrendFill)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartShell>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <ChartShell title="Quick Timeline" subtitle="Core resident highlights" className="xl:col-span-2">
          <ul className="space-y-3">
            <li className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white"><FiCalendar className="text-cyan-600" />Next Due Date</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{dashboard?.nextDueDate ? new Date(dashboard.nextDueDate).toLocaleDateString() : 'No upcoming due date'}</p>
            </li>
            <li className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white"><FiClock className="text-emerald-600" />Last Payment</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{dashboard?.lastPaymentDate ? new Date(dashboard.lastPaymentDate).toLocaleDateString() : 'No payment record'}</p>
            </li>
            <li className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white"><FiAlertTriangle className="text-amber-600" />Upcoming Notices</p>
              <div className="mt-1 space-y-1">
                {(dashboard?.upcomingEvents || []).slice(0, 3).map((event) => (
                  <p key={event.id} className="text-sm text-slate-600 dark:text-slate-300">{event.title}</p>
                ))}
                {!dashboard?.upcomingEvents?.length && <p className="text-sm text-slate-500 dark:text-slate-400">No notices available.</p>}
              </div>
            </li>
          </ul>
        </ChartShell>

        <ChartShell title="Upcoming Amenity Bookings" subtitle="Your next scheduled amenity usage" className="xl:col-span-3">
          <div className="grid gap-2 md:grid-cols-2">
            {upcomingAmenities.map((booking) => (
              <div key={booking._id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <p className="font-semibold text-slate-900 dark:text-white">{booking.amenityId?.name || 'Amenity'}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{new Date(booking.bookingDate).toLocaleDateString()} | {booking.startTime} - {booking.endTime}</p>
                <span className="mt-2 inline-flex rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-200">{booking.bookingStatus}</span>
              </div>
            ))}
            {!upcomingAmenities.length && <p className="text-sm text-slate-500 dark:text-slate-400">No upcoming amenity bookings.</p>}
          </div>
        </ChartShell>
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">{error}</p>}
    </div>
  );
}

function AdminDashboard() {
  const { apiRequest, admin } = useAuth();
  const navigate = useNavigate();
  const [societies, setSocieties] = useState([]);
  const [residentRows, setResidentRows] = useState([]);
  const [totalResidents, setTotalResidents] = useState(0);
  const [occupancyStats, setOccupancyStats] = useState({ Owner: 0, Tenant: 0 });
  const [amenityAnalytics, setAmenityAnalytics] = useState(null);
  const [amenityCalendarRows, setAmenityCalendarRows] = useState([]);
  const [fallbackAmenityBookings, setFallbackAmenityBookings] = useState([]);
  const [visitorAnalytics, setVisitorAnalytics] = useState({ dailyCounts: [], statusBreakdown: [], pendingApprovals: 0 });
  const [visitorLogs, setVisitorLogs] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [maintenanceBills, setMaintenanceBills] = useState([]);
  const [deliveryRows, setDeliveryRows] = useState([]);
  const [domesticLogs, setDomesticLogs] = useState([]);
  const [emergencyRows, setEmergencyRows] = useState([]);
  const [notices, setNotices] = useState([]);
  const [notificationsSummary, setNotificationsSummary] = useState({ unreadCount: 0, data: [] });
  const [resolvingEmergencyId, setResolvingEmergencyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiSending, setAiSending] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi! I am your Society AI Assistant. Ask me about revenue, residents, visitors, dues, deliveries, or service requests.',
    },
  ]);
  const [familySummary, setFamilySummary] = useState({ totalMembers: 0, children: 0, teens: 0, adults: 0, seniorCitizens: 0 });

  const role = String(admin?.role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const isAdminRole = role === 'admin' || role === 'super_admin';
  const isCommitteeRole = role === 'committee';
  const isGuardRole = role === 'guard' || role.includes('guard') || role.includes('security');
  const canResolveEmergency = isAdminRole || isGuardRole;

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');

        const calendarFrom = new Date();
        const calendarTo = new Date();
        calendarTo.setDate(calendarTo.getDate() + 30);

        const societyPromise = apiRequest('/api/societies').catch(() => []);
        const amenityCalendarPromise = apiRequest(`/api/amenities/calendar?from=${calendarFrom.toISOString().slice(0, 10)}&to=${calendarTo.toISOString().slice(0, 10)}`).catch(() => []);

        const analyticsPromise = isAdminRole ? apiRequest('/api/amenities/analytics').catch(() => null) : Promise.resolve(null);
        const fallbackBookingsPromise = isCommitteeRole
          ? apiRequest('/api/amenities/bookings').catch(() => [])
          : isGuardRole
          ? apiRequest('/api/amenities/today-bookings').catch(() => [])
          : Promise.resolve([]);

        const [societyData, calendarData, analyticsData, roleBookings, familySummaryPayload] = await Promise.all([
          societyPromise,
          amenityCalendarPromise,
          analyticsPromise,
          fallbackBookingsPromise,
          (isAdminRole || isCommitteeRole) ? apiRequest('/api/family-members/summary', { raw: true }).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
        ]);

        const normalizedSocieties = Array.isArray(societyData) ? societyData : [];
        const scopedSocietyId = admin?.societyId || normalizedSocieties[0]?._id || '';
        const scopeQuery = scopedSocietyId ? `?societyId=${scopedSocietyId}` : '';

        const [
          visitorAnalyticsPayload,
          visitorLogsPayload,
          serviceRequestsPayload,
          maintenancePayload,
          deliveryPayload,
          domesticPayload,
          emergencyPayload,
          noticesPayload,
          notificationPayload,
        ] = await Promise.all([
          apiRequest(`/api/visitors/analytics${scopeQuery}`, { raw: true }).catch(() => ({ data: { dailyCounts: [], statusBreakdown: [], pendingApprovals: 0 } })),
          apiRequest(`/api/visitors/logs${scopeQuery ? `${scopeQuery}&limit=40` : '?limit=40'}`, { raw: true }).catch(() => ({ data: [] })),
          apiRequest(`/api/service-requests${scopeQuery}`, { raw: true }).catch(() => []),
          apiRequest(`/api/maintenance${scopeQuery ? `${scopeQuery}&limit=200` : '?limit=200'}`, { raw: true }).catch(() => ({ data: [] })),
          apiRequest(`/api/security/all-packages${scopeQuery ? `${scopeQuery}&limit=120` : '?limit=120'}`, { raw: true }).catch(() => ({ data: [] })),
          apiRequest(`/api/domestic-staff/logs${scopeQuery ? `${scopeQuery}&limit=120` : '?limit=120'}`, { raw: true }).catch(() => ({ data: [] })),
          apiRequest(`/api/security/emergency-alerts${scopeQuery ? `${scopeQuery}&includeResolved=true` : '?includeResolved=true'}`, { raw: true }).catch(() => ({ data: [] })),
          apiRequest(`/api/notices${scopeQuery ? `${scopeQuery}&limit=8` : '?limit=8'}`, { raw: true }).catch(() => ({ data: [] })),
          apiRequest('/api/notifications?limit=20', { raw: true }).catch(() => ({ unreadCount: 0, data: [] })),
        ]);

        setSocieties(normalizedSocieties);
        setAmenityCalendarRows(Array.isArray(calendarData) ? calendarData : []);
        setAmenityAnalytics(analyticsData || null);
        setFallbackAmenityBookings(Array.isArray(roleBookings) ? roleBookings : []);
        setVisitorAnalytics(visitorAnalyticsPayload?.data || { dailyCounts: [], statusBreakdown: [], pendingApprovals: 0 });
        setVisitorLogs(visitorLogsPayload?.data || []);
        setServiceRequests(Array.isArray(serviceRequestsPayload) ? serviceRequestsPayload : serviceRequestsPayload?.data || []);
        setMaintenanceBills(maintenancePayload?.data || []);
        setDeliveryRows(deliveryPayload?.data || []);
        setDomesticLogs(domesticPayload?.data || []);
        setEmergencyRows(emergencyPayload?.data || []);
        setNotices(noticesPayload?.data || []);
        setNotificationsSummary({
          unreadCount: Number(notificationPayload?.unreadCount || 0),
          data: notificationPayload?.data || [],
        });
        setFamilySummary(
          familySummaryPayload?.data || { totalMembers: 0, children: 0, teens: 0, adults: 0, seniorCitizens: 0 }
        );

        const residents = scopedSocietyId
          ? await apiRequest(`/api/residents?societyId=${scopedSocietyId}`)
              .then((payload) => (Array.isArray(payload) ? payload : payload.data || []))
              .catch(() => [])
          : [];
        setResidentRows(residents);
        setTotalResidents(residents.length);
        setOccupancyStats(
          residents.reduce(
            (acc, resident) => {
              if (String(resident.occupancyType || '').toLowerCase() === 'tenant') acc.Tenant += 1;
              else acc.Owner += 1;
              return acc;
            },
            { Owner: 0, Tenant: 0 }
          )
        );
      } catch (err) {
        setError(err.message || 'Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    }

    load();
    const timer = setInterval(load, 25000);
    return () => clearInterval(timer);
  }, [role, admin?.societyId]);

  const totalFlats = useMemo(() => societies.reduce((sum, item) => sum + (item.totalFlats || 0), 0), [societies]);

  const flatsBySociety = useMemo(
    () =>
      societies.map((society) => ({
        name: society.name.length > 14 ? `${society.name.slice(0, 14)}...` : society.name,
        flats: society.totalFlats,
      })),
    [societies]
  );

  const occupancyChart = useMemo(
    () => [
      { name: 'Owners', value: occupancyStats.Owner, fill: '#14b8a6' },
      { name: 'Tenants', value: occupancyStats.Tenant, fill: '#0ea5e9' },
    ],
    [occupancyStats]
  );

  const amenityTrend = useMemo(() => aggregateBookingsByDate(amenityCalendarRows), [amenityCalendarRows]);

  const amenityStatusData = useMemo(() => {
    if (isAdminRole && amenityAnalytics?.upcomingBookings) {
      return aggregateBookingStatuses(amenityAnalytics.upcomingBookings);
    }
    return aggregateBookingStatuses(fallbackAmenityBookings);
  }, [isAdminRole, amenityAnalytics, fallbackAmenityBookings]);

  const dashboardCards = useMemo(() => {
    const base = [
      { label: 'Total Societies', value: societies.length, icon: FiLayers, tone: 'accent' },
      { label: 'Total Flats', value: totalFlats, icon: FiHome, tone: 'neutral' },
      { label: 'Total Residents', value: totalResidents, icon: FiUsers, tone: 'neutral' },
    ];

    if (isAdminRole) {
      base.push(
        { label: 'Amenity Bookings Month', value: amenityAnalytics?.totalBookingsThisMonth || 0, icon: FiMapPin, tone: 'accent' },
        { label: 'Upcoming Amenities', value: amenityAnalytics?.upcomingBookings?.length || 0, icon: FiCalendar, tone: 'success' },
        { label: 'Amenity Revenue', value: amenityAnalytics?.revenueFromBookings || 0, icon: FiDollarSign, tone: 'success', prefix: 'INR ', decimals: 2 }
      );
    } else {
      base.push(
        { label: isGuardRole ? 'Today Amenities' : 'Amenity Queue', value: fallbackAmenityBookings.length, icon: FiMapPin, tone: 'accent' },
        {
          label: 'Approved Count',
          value: fallbackAmenityBookings.filter((item) => item.bookingStatus === 'Approved').length,
          icon: FiCheckCircle,
          tone: 'success',
        },
        {
          label: 'Pending Count',
          value: fallbackAmenityBookings.filter((item) => item.bookingStatus === 'Pending').length,
          icon: FiClock,
          tone: 'neutral',
        }
      );
    }

    return base;
  }, [societies.length, totalFlats, totalResidents, amenityAnalytics, fallbackAmenityBookings, isAdminRole, isGuardRole]);

  const nowRange = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, []);

  const toSafeDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  const isToday = (value) => {
    const dt = toSafeDate(value);
    if (!dt) return false;
    return dt >= nowRange.start && dt <= nowRange.end;
  };

  const visitorsToday = useMemo(
    () => visitorLogs.filter((row) => isToday(row.createdAt || row.entryTime)).length,
    [visitorLogs, nowRange]
  );

  const deliveriesToday = useMemo(
    () => deliveryRows.filter((row) => isToday(row.createdAt || row.receivedTime)).length,
    [deliveryRows, nowRange]
  );

  const complaintSnapshot = useMemo(() => {
    const base = { Pending: 0, Assigned: 0, InProgress: 0, Completed: 0, Resolved: 0 };
    serviceRequests.forEach((row) => {
      const key = String(row.status || 'Pending');
      if (Object.prototype.hasOwnProperty.call(base, key)) base[key] += 1;
      if (key === 'Resolved') base.Completed += 1;
    });
    return base;
  }, [serviceRequests]);

  const maintenanceOverview = useMemo(
    () =>
      maintenanceBills.reduce(
        (acc, bill) => {
          const amount = Number(bill.amount || 0) + Number(bill.lateFee || 0);
          acc.expected += amount;
          if (String(bill.status) === 'Paid') acc.collected += amount;
          else acc.pending += amount;
          return acc;
        },
        { expected: 0, collected: 0, pending: 0 }
      ),
    [maintenanceBills]
  );

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const maintenanceCollectedThisMonth = useMemo(
    () =>
      maintenanceBills
        .filter((bill) => String(bill.month || '') === currentMonthKey && String(bill.status || '') === 'Paid')
        .reduce((sum, bill) => sum + Number(bill.amount || 0) + Number(bill.lateFee || 0), 0),
    [maintenanceBills, currentMonthKey]
  );

  const securitySnapshot = useMemo(() => {
    const visitorsInside = visitorLogs.filter((row) => String(row.status || '').toLowerCase() === 'entered').length;
    const visitorsExitedToday = visitorLogs.filter((row) => String(row.status || '').toLowerCase() === 'exited' && isToday(row.exitTime || row.updatedAt)).length;
    const domesticInside = domesticLogs.filter((row) => !row.exitTime).length;
    return { visitorsInside, visitorsExitedToday, domesticInside, deliveryEntriesToday: deliveriesToday };
  }, [visitorLogs, domesticLogs, deliveriesToday, nowRange]);

  const commandCards = useMemo(
    () => [
      { label: 'Total Residents', value: residentRows.length, icon: FiUsers, tone: 'neutral' },
      { label: 'Total Flats', value: totalFlats, icon: FiHome, tone: 'accent' },
      { label: 'Visitors Today', value: visitorsToday, icon: FiShield, tone: 'accent' },
      { label: 'Deliveries Today', value: deliveriesToday, icon: FiTruck, tone: 'accent' },
      { label: 'Pending Complaints', value: complaintSnapshot.Pending + complaintSnapshot.Assigned + complaintSnapshot.InProgress, icon: FiAlertTriangle, tone: (complaintSnapshot.Pending + complaintSnapshot.Assigned + complaintSnapshot.InProgress) > 0 ? 'danger' : 'success' },
      { label: 'Maintenance This Month', value: maintenanceCollectedThisMonth, icon: FiDollarSign, tone: 'success', prefix: 'INR ', decimals: 2 },
    ],
    [residentRows.length, totalFlats, visitorsToday, deliveriesToday, complaintSnapshot, maintenanceCollectedThisMonth]
  );

  const visitorsTrend = useMemo(() => {
    const map = new Map((visitorAnalytics?.dailyCounts || []).map((row) => [String(row._id || ''), Number(row.count || 0)]));
    const trend = [];
    for (let i = 6; i >= 0; i -= 1) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const key = dt.toISOString().slice(0, 10);
      trend.push({
        day: dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        visitors: map.get(key) || 0,
      });
    }
    return trend;
  }, [visitorAnalytics]);

  const maintenanceTrend = useMemo(() => {
    const map = new Map();
    maintenanceBills.forEach((bill) => {
      const month = String(bill.month || '').trim();
      if (!month) return;
      const current = map.get(month) || { month, collected: 0, pending: 0 };
      const amount = Number(bill.amount || 0) + Number(bill.lateFee || 0);
      if (String(bill.status) === 'Paid') current.collected += amount;
      else current.pending += amount;
      map.set(month, current);
    });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [maintenanceBills]);

  const complaintCategoryChart = useMemo(() => {
    const map = new Map();
    serviceRequests.forEach((row) => {
      const key = String(row.category || 'Other');
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value], idx) => ({ name, value, fill: PIE_COLORS[idx % PIE_COLORS.length] }));
  }, [serviceRequests]);

  const serviceStatusChart = useMemo(
    () => [
      { name: 'Pending', count: complaintSnapshot.Pending, fill: '#f59e0b' },
      { name: 'Assigned', count: complaintSnapshot.Assigned, fill: '#0ea5e9' },
      { name: 'In Progress', count: complaintSnapshot.InProgress, fill: '#6366f1' },
      { name: 'Resolved', count: complaintSnapshot.Completed, fill: '#22c55e' },
    ],
    [complaintSnapshot]
  );

  const activeEmergency = useMemo(
    () => emergencyRows.find((row) => String(row.status || 'ACTIVE').toUpperCase() === 'ACTIVE') || null,
    [emergencyRows]
  );

  const recentNotices = useMemo(() => notices.slice(0, 5), [notices]);

  const liveActivityFeed = useMemo(() => {
    const rows = [];
    visitorLogs.slice(0, 5).forEach((row) => {
      const status = String(row.status || 'Pending').toLowerCase();
      const flat = row.visitingUnit?.unitNumber || '-';
      rows.push({
        id: `v-${row._id}`,
        icon: FiUsers,
        message: `Visitor ${row.visitorName || 'Guest'} ${status} for Flat ${flat}.`,
        timestamp: row.createdAt || row.entryTime,
      });
    });
    deliveryRows.slice(0, 5).forEach((row) => {
      const flat = row.unitId?.unitNumber || '-';
      rows.push({
        id: `d-${row._id}`,
        icon: FiPackage,
        message: `${row.courierCompany || 'Delivery'} package ${String(row.status || '').toLowerCase()} for Flat ${flat}.`,
        timestamp: row.createdAt || row.receivedTime,
      });
    });
    serviceRequests.slice(0, 5).forEach((row) => {
      rows.push({
        id: `s-${row._id}`,
        icon: FiClipboard,
        message: `Service request "${row.title}" is ${String(row.status || 'Pending').replace('InProgress', 'in progress')}.`,
        timestamp: row.updatedAt || row.createdAt,
      });
    });
    notices.slice(0, 4).forEach((row) => {
      rows.push({
        id: `n-${row._id}`,
        icon: FiBell,
        message: `Notice posted: ${row.title}.`,
        timestamp: row.createdAt,
      });
    });

    return rows
      .filter((row) => row.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 12);
  }, [visitorLogs, deliveryRows, serviceRequests, notices]);

  if (loading) return <DashboardSkeleton />;

  async function sendAiQuestion(question) {
    const text = String(question || '').trim();
    if (!text || aiSending) return;
    setAiMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text }]);
    setAiInput('');
    try {
      setAiSending(true);
      const payload = await apiRequest('/api/ai-assistant/query', {
        method: 'POST',
        body: { question: text },
        raw: true,
      });
      const reply = payload?.data?.answer || 'I could not find enough data for that question.';
      setAiMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', text: reply }]);
    } catch (err) {
      setAiMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: 'assistant', text: err.message || 'Failed to fetch AI response.' }]);
    } finally {
      setAiSending(false);
    }
  }

  async function resolveEmergency(alertId) {
    if (!alertId || resolvingEmergencyId) return;
    try {
      setResolvingEmergencyId(String(alertId));
      const scopeSocietyId = admin?.societyId || societies[0]?._id || '';
      const query = scopeSocietyId ? `?societyId=${scopeSocietyId}` : '';
      await apiRequest(`/api/security/emergency-alert/${alertId}/resolve${query}`, {
        method: 'PUT',
        raw: true,
      });
      setEmergencyRows((prev) =>
        prev.map((row) =>
          String(row._id) === String(alertId)
            ? { ...row, status: 'RESOLVED', resolvedAt: new Date().toISOString() }
            : row
        )
      );
    } finally {
      setResolvingEmergencyId('');
    }
  }

  const aiSuggestions = [
    'Total revenue this month',
    'Show pending maintenance payments',
    'How many visitors entered today?',
    'How many residents live in this society?',
  ];

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-cyan-100 p-6 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800"
      >
        <div className="absolute -right-14 -top-14 h-52 w-52 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700 dark:text-amber-300">Executive Dashboard</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Portfolio Control Tower</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Track society capacity, occupancy, and amenity pipeline using redesigned analytics and trend visuals.</p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <p className="text-xs uppercase tracking-wider text-slate-500">Role Scope</p>
            <p className="mt-1 text-lg font-semibold capitalize text-slate-900 dark:text-white">{role || 'user'}</p>
          </div>
        </div>
      </motion.section>

      {(isAdminRole || isCommitteeRole) && (
        <>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {commandCards.map((card) => (
              <StatCard
                key={card.label}
                label={card.label}
                value={card.value}
                icon={card.icon}
                tone={card.tone}
                prefix={card.prefix || ''}
                decimals={card.decimals || 0}
              />
            ))}
          </div>

          {activeEmergency ? (
            <ChartShell title="Emergency Alert Panel" subtitle="Immediate response required">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-900/25">
                <p className="text-base font-semibold text-rose-700 dark:text-rose-200">
                  {activeEmergency.alertType} Emergency: {activeEmergency.description}
                </p>
                <p className="mt-1 text-sm text-rose-700/90 dark:text-rose-200/90">
                  Location: {activeEmergency.location} | Reported {new Date(activeEmergency.createdAt).toLocaleString()}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/app/dashboard')}
                    className="rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-700 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-rose-950/40"
                  >
                    View Details
                  </button>
                  {canResolveEmergency ? (
                    <button
                      type="button"
                      disabled={resolvingEmergencyId === String(activeEmergency._id)}
                      onClick={() => resolveEmergency(activeEmergency._id)}
                      className="rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {resolvingEmergencyId === String(activeEmergency._id) ? 'Resolving...' : 'Mark as Resolved'}
                    </button>
                  ) : null}
                </div>
              </div>
            </ChartShell>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartShell title="Visitors per Day" subtitle="Last 7 days movement trend">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={visitorsTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dce6f4" />
                    <XAxis dataKey="day" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="visitors" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartShell>

            <ChartShell title="Maintenance Collection" subtitle="Collected vs pending (last 6 months)">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={maintenanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dce6f4" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="collected" fill="#22c55e" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="pending" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartShell>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartShell title="Complaint Categories" subtitle="Distribution by category">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={complaintCategoryChart} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={2}>
                      {complaintCategoryChart.map((item) => (
                        <Cell key={item.name} fill={item.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartShell>

            <ChartShell title="Service Request Status" subtitle="Operational status stack">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serviceStatusChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dce6f4" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {serviceStatusChart.map((item) => (
                        <Cell key={item.name} fill={item.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartShell>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <ChartShell title="Live Society Activity" subtitle="Recent operational events" className="xl:col-span-2">
              <div className="space-y-2">
                {liveActivityFeed.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                      <span className="mt-0.5 rounded-lg bg-cyan-100 p-2 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-200">
                        <Icon size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.message}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{new Date(item.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
                {!liveActivityFeed.length ? <p className="empty-state">No recent activities.</p> : null}
              </div>
            </ChartShell>

            <ChartShell title="Security Activity" subtitle="Current gate and staff state">
              <div className="space-y-2">
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Visitors Inside</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{securitySnapshot.visitorsInside}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Visitors Exited Today</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{securitySnapshot.visitorsExitedToday}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Domestic Staff Inside</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{securitySnapshot.domesticInside}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Delivery Entries Today</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{securitySnapshot.deliveryEntriesToday}</p>
                </div>
              </div>
            </ChartShell>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <ChartShell title="Maintenance Overview" subtitle="Expected, collected, pending">
              <div className="space-y-2">
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Total Expected</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">INR {maintenanceOverview.expected.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Collected</p>
                  <p className="mt-1 text-xl font-semibold text-emerald-600">INR {maintenanceOverview.collected.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Pending</p>
                  <p className="mt-1 text-xl font-semibold text-amber-600">INR {maintenanceOverview.pending.toFixed(2)}</p>
                </div>
              </div>
            </ChartShell>

            <ChartShell title="Complaint Snapshot" subtitle="Open, in-progress, resolved">
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-slate-200 p-3 text-center dark:border-slate-700">
                    <p className="text-xs text-slate-500">Open</p>
                    <p className="mt-1 text-xl font-semibold text-amber-600">{complaintSnapshot.Pending}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 text-center dark:border-slate-700">
                    <p className="text-xs text-slate-500">In Progress</p>
                    <p className="mt-1 text-xl font-semibold text-cyan-600">{complaintSnapshot.Assigned + complaintSnapshot.InProgress}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 text-center dark:border-slate-700">
                    <p className="text-xs text-slate-500">Resolved</p>
                    <p className="mt-1 text-xl font-semibold text-emerald-600">{complaintSnapshot.Completed}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/app/service-requests')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Open Service Requests
                  <FiExternalLink size={14} />
                </button>
              </div>
            </ChartShell>

            <ChartShell title="Notification Summary" subtitle="Unread and latest updates">
              <div className="space-y-2">
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Unread Notifications</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{notificationsSummary.unreadCount || 0}</p>
                </div>
                {notificationsSummary.data.slice(0, 3).map((item) => (
                  <div key={item._id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title || 'Notification'}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{item.message || '-'}</p>
                  </div>
                ))}
              </div>
            </ChartShell>
          </div>

          <ChartShell title="Recent Notices" subtitle="Latest admin announcements">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {recentNotices.map((notice) => (
                <div key={notice._id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{notice.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{notice.description}</p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{new Date(notice.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {!recentNotices.length ? <p className="empty-state md:col-span-2 xl:col-span-3">No notices available.</p> : null}
            </div>
          </ChartShell>
        </>
      )}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {dashboardCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            tone={card.tone}
            prefix={card.prefix || ''}
            suffix={card.suffix || ''}
            decimals={card.decimals || 0}
          />
        ))}
      </div>

      {(isAdminRole || isCommitteeRole) ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Family Members" value={familySummary.totalMembers || 0} icon={FiUsers} tone="accent" />
          <StatCard label="Children" value={familySummary.children || 0} icon={FiHome} tone="neutral" />
          <StatCard label="Adults" value={familySummary.adults || 0} icon={FiShield} tone="success" />
          <StatCard label="Senior Citizens" value={familySummary.seniorCitizens || 0} icon={FiClock} tone="neutral" />
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartShell title="Society Flat Capacity" subtitle="Area comparison across societies" className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={flatsBySociety}>
                <defs>
                  <linearGradient id="flatCapacityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#dce6f4" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="flats" stroke="#0ea5e9" fill="url(#flatCapacityFill)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartShell>

        <ChartShell title="Occupancy Mix" subtitle="Role occupancy split bars">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={occupancyChart} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dce6f4" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" />
                <Tooltip />
                <Bar dataKey="value" radius={[10, 10, 10, 10]}>
                  {occupancyChart.map((item) => (
                    <Cell key={item.name} fill={item.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartShell>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartShell title="Amenity Booking Trend" subtitle="Combined bar + line activity">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={amenityTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dce6f4" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#22d3ee" radius={[8, 8, 0, 0]} />
                <Line type="monotone" dataKey="count" stroke="#0f766e" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartShell>

        <ChartShell title="Amenity Status Distribution" subtitle="Pipeline donut view">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={amenityStatusData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={94} paddingAngle={3}>
                  {amenityStatusData.map((item, idx) => (
                    <Cell key={item.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartShell>
      </div>

      {isAdminRole && amenityAnalytics?.upcomingBookings?.length ? (
        <ChartShell title="Upcoming Amenity Queue" subtitle="Next 10 bookings requiring visibility">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {amenityAnalytics.upcomingBookings.map((booking) => (
              <div key={booking.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <p className="font-semibold text-slate-900 dark:text-white">{booking.amenityName}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{new Date(booking.date).toLocaleDateString()} | {booking.startTime} - {booking.endTime}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Booked by {booking.bookedBy}</p>
                <span className="mt-2 inline-flex rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-200">{booking.bookingStatus}</span>
              </div>
            ))}
          </div>
        </ChartShell>
      ) : null}

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">{error}</p>}

      {isAdminRole && (
        <>
          <button
            type="button"
            onClick={() => setAiOpen((prev) => !prev)}
            className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-xl hover:from-cyan-500 hover:to-indigo-500"
          >
            <FiMessageCircle />
            AI Assistant
          </button>

          {aiOpen && (
            <motion.section
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="fixed bottom-24 right-6 z-40 w-[min(92vw,420px)] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Society AI Assistant</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Ask anything about your society</p>
                </div>
                <button type="button" onClick={() => setAiOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <FiX />
                </button>
              </div>

              <div className="max-h-[44vh] space-y-2 overflow-y-auto p-3">
                {aiMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {aiSending && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-1 rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-2 flex flex-wrap gap-2">
                  {aiSuggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => sendAiQuestion(item)}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    sendAiQuestion(aiInput);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    value={aiInput}
                    onChange={(event) => setAiInput(event.target.value)}
                    placeholder="Ask anything about your society..."
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                  <button type="submit" disabled={aiSending || !aiInput.trim()} className="inline-flex items-center gap-1 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">
                    <FiSend size={14} />
                    Send
                  </button>
                </form>
              </div>
            </motion.section>
          )}
        </>
      )}
    </div>
  );
}

function DashboardPage() {
  const { admin } = useAuth();
  const residentRoles = new Set(['tenant', 'resident', 'owner']);
  if (residentRoles.has(admin?.role)) {
    return <ResidentDashboard />;
  }
  return <AdminDashboard />;
}

export default DashboardPage;
