import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { FiAlertTriangle, FiCalendar, FiCheckCircle, FiClock, FiFileText, FiSearch, FiTrendingUp, FiUser } from 'react-icons/fi';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import AppButton from '../components/ui/AppButton.jsx';
import AppCard from '../components/ui/AppCard.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

function StatCard({ title, value, icon: Icon, tone = 'default' }) {
  const toneClass =
    tone === 'danger'
      ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/25 dark:text-rose-200'
      : tone === 'success'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-200'
      : tone === 'warning'
      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-200'
      : 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/25 dark:text-cyan-200';

  return (
    <AppCard className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{title}</p>
        <span className={`rounded-xl p-2 ${toneClass}`}>
          <Icon size={14} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
    </AppCard>
  );
}

function toMonthKey(value) {
  const raw = String(value || '').trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : '';
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString();
}

function monthLabel(value) {
  const key = toMonthKey(value);
  if (!key) return value || '-';
  const [year, month] = key.split('-').map((item) => Number(item));
  return new Date(year, month - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function billStatusPill(status) {
  const normalized = String(status || 'Unpaid');
  if (normalized === 'Paid') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200';
  if (normalized === 'Overdue') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200';
  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200';
}

async function requestWithFallback(apiRequest, paths, options = {}) {
  const candidates = Array.isArray(paths) ? paths.filter(Boolean) : [paths].filter(Boolean);
  let lastError = null;
  for (const path of candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await apiRequest(path, options);
    } catch (error) {
      lastError = error;
      const message = String(error?.message || '');
      if (!/route not found/i.test(message)) {
        throw error;
      }
    }
  }
  throw lastError || new Error('Request failed.');
}

function MaintenancePage() {
  const { apiRequest, admin } = useAuth();
  const { showToast } = useToast();
  const isAdmin = ['admin', 'super_admin', 'committee'].includes(String(admin?.role || '').toLowerCase());

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState('');
  const [bills, setBills] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [summary, setSummary] = useState({
    totalBills: 0,
    paidBills: 0,
    pendingBills: 0,
    overdueBills: 0,
    totalCollected: 0,
  });
  const [revenueReport, setRevenueReport] = useState([]);
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));

  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    status: '',
    month: '',
    year: '',
    search: '',
    flatNumber: '',
  });

  const [form, setForm] = useState({
    month: new Date().toISOString().slice(0, 7),
    amount: '',
    dueDate: '',
  });

  async function loadBills(nextFilters = filters) {
    if (!isAdmin) return;
    const params = new URLSearchParams();
    params.set('page', String(nextFilters.page || 1));
    params.set('limit', String(nextFilters.limit || 20));
    if (nextFilters.status) params.set('status', nextFilters.status);
    if (nextFilters.month) params.set('month', nextFilters.month);
    if (nextFilters.year) params.set('year', nextFilters.year);
    if (nextFilters.search) params.set('search', nextFilters.search);
    if (nextFilters.flatNumber) params.set('flatNumber', nextFilters.flatNumber);

    const payload = await requestWithFallback(
      apiRequest,
      [`/api/maintenance/bills?${params.toString()}`, `/api/maintenance?${params.toString()}`, `/api/bills?${params.toString()}`],
      { raw: true }
    );
    setBills(payload.data || []);
    setPagination(payload.pagination || { page: 1, totalPages: 1 });
    setSummary(
      payload.summary || {
        totalBills: 0,
        paidBills: 0,
        pendingBills: 0,
        overdueBills: 0,
        totalCollected: 0,
      }
    );
  }

  async function loadRevenue(year = reportYear) {
    if (!isAdmin) return;
    const payload = await requestWithFallback(
      apiRequest,
      [
        `/api/maintenance/revenue?year=${encodeURIComponent(year)}`,
        `/api/maintenance/reports/monthly-revenue?year=${encodeURIComponent(year)}`,
        `/api/bills/reports/monthly-revenue?year=${encodeURIComponent(year)}`,
      ],
      { raw: true }
    );
    setRevenueReport(payload.data || []);
  }

  async function refreshAll(nextFilters = filters, year = reportYear) {
    try {
      setLoading(true);
      await Promise.all([loadBills(nextFilters), loadRevenue(year)]);
    } catch (error) {
      showToast(error.message || 'Failed to load maintenance data.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll(filters, reportYear);
  }, [filters.page, filters.status, filters.month, filters.year, reportYear]);

  async function handleGenerate(event) {
    event.preventDefault();
    const month = toMonthKey(form.month);
    const amount = Number(form.amount);
    const dueDate = String(form.dueDate || '').trim();

    if (!month) {
      showToast('Billing month is required.', 'error');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Maintenance amount must be greater than zero.', 'error');
      return;
    }
    if (!dueDate) {
      showToast('Due date is required.', 'error');
      return;
    }
    const parsedDueDate = new Date(dueDate);
    if (Number.isNaN(parsedDueDate.getTime())) {
      showToast('Please select a valid due date.', 'error');
      return;
    }

    try {
      setGenerating(true);
      const payload = await requestWithFallback(
        apiRequest,
        ['/api/maintenance/generate', '/api/maintenance/generate-bulk', '/api/bills/generate-bulk'],
        {
          method: 'POST',
          body: {
            month,
            amount,
            dueDate,
          },
          raw: true,
        }
      );

      const total = Number(payload.totalTargeted || 0);
      const created = Number(payload.generatedCount || 0);
      const skipped = Number(payload.duplicateCount || payload.skippedCount || 0);
      if (skipped > 0) {
        showToast(
          `Bills generated: ${created}/${total}. Skipped duplicates: ${skipped}. Bills for some flats already exist for this month.`,
          'warning'
        );
      } else {
        showToast(`Monthly bills generated successfully. Created ${created} bills.`, 'success');
      }

      await refreshAll({ ...filters, page: 1, month }, reportYear);
      setFilters((prev) => ({ ...prev, page: 1, month }));
    } catch (error) {
      showToast(error.message || 'Failed to generate monthly bills.', 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleMarkPaid(billId) {
    if (!billId) return;
    try {
      setMarkingPaidId(String(billId));
      await requestWithFallback(
        apiRequest,
        [`/api/maintenance/${billId}/mark-paid`, `/api/maintenance/${billId}/pay`, `/api/bills/${billId}/pay`],
        { method: 'PUT', raw: true }
      );
      showToast('Maintenance bill marked as paid successfully.', 'success');
      await refreshAll(filters, reportYear);
    } catch (error) {
      showToast(error.message || 'Failed to mark bill as paid.', 'error');
    } finally {
      setMarkingPaidId('');
    }
  }

  const visibleBills = useMemo(() => {
    const term = String(filters.search || '').trim().toLowerCase();
    if (!term) return bills;
    return bills.filter((bill) => {
      const hay = [
        bill.month,
        bill.status,
        bill.flatNumber,
        bill.residentName || bill?.residentId?.name,
        bill.residentEmail || bill?.residentId?.email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(term);
    });
  }, [bills, filters.search]);

  if (!isAdmin) {
    return <EmptyState message="Maintenance management is available for admin and committee users." />;
  }

  return (
    <div className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-cyan-200/60 bg-gradient-to-br from-cyan-100 via-white to-indigo-100 p-6 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-300">Admin Panel</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Maintenance Management</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Generate monthly maintenance bills for occupied flats, avoid duplicates for the same month, track overdue/late fee status,
          and monitor collections through monthly revenue trend.
        </p>
      </motion.section>

      <div className="grid gap-4 md:grid-cols-5">
        <StatCard title="Total Bills" value={summary.totalBills} icon={FiFileText} />
        <StatCard title="Paid Bills" value={summary.paidBills} icon={FiCheckCircle} tone="success" />
        <StatCard title="Pending Bills" value={summary.pendingBills} icon={FiClock} tone="warning" />
        <StatCard title="Overdue Bills" value={summary.overdueBills} icon={FiAlertTriangle} tone="danger" />
        <StatCard title="Total Collected" value={`INR ${Number(summary.totalCollected || 0).toFixed(2)}`} icon={FiTrendingUp} />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <AppCard className="p-5 xl:col-span-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Generate Monthly Bills</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            One bill per occupied flat for selected billing month. Existing flat-month bills are skipped automatically.
          </p>
          <form className="mt-4 space-y-3" onSubmit={handleGenerate}>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Billing Month
            </label>
            <input
              type="month"
              value={form.month}
              onChange={(event) => setForm((prev) => ({ ...prev, month: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800"
              required
            />
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Maintenance Amount
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              placeholder="e.g. 2500"
              value={form.amount}
              onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800"
              required
            />
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Due Date
            </label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800"
              required
            />
            <AppButton type="submit" disabled={generating} className="w-full justify-center">
              {generating ? 'Generating...' : 'Generate Bills'}
            </AppButton>
          </form>
        </AppCard>

        <AppCard className="p-5 xl:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Monthly Revenue</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Collected maintenance + late fee by month</p>
            </div>
            <div className="flex items-center gap-2">
              <FiCalendar className="text-slate-400" />
              <input
                type="number"
                min="2000"
                max="2100"
                value={reportYear}
                onChange={(event) => {
                  const year = String(event.target.value || '').trim();
                  setReportYear(year);
                }}
                className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
          <div className="mt-4 h-64">
            {!revenueReport.length ? (
              <EmptyState message="No revenue data available for this year." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueReport}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dce6f4" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="totalRevenue" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </AppCard>
      </div>

      <AppCard className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h3 className="mr-auto text-lg font-semibold text-slate-900 dark:text-white">Bill Register</h3>
          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Search month/flat/resident/status"
              className="w-64 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">All Status</option>
            <option value="Unpaid">Pending</option>
            <option value="Overdue">Overdue</option>
            <option value="Paid">Paid</option>
          </select>
          <input
            type="month"
            value={filters.month}
            onChange={(event) => setFilters((prev) => ({ ...prev, month: event.target.value, page: 1 }))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800"
          />
          <input
            type="number"
            min="2000"
            max="2100"
            placeholder="Year"
            value={filters.year}
            onChange={(event) => setFilters((prev) => ({ ...prev, year: event.target.value, page: 1 }))}
            className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading bills...</p>
        ) : !visibleBills.length ? (
          <EmptyState message="No bills found for selected filters." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100/90 dark:bg-slate-800/80">
                <tr className="text-left text-slate-600 dark:text-slate-300">
                  <th className="px-4 py-3 font-semibold">Billing Month</th>
                  <th className="px-4 py-3 font-semibold">Flat</th>
                  <th className="px-4 py-3 font-semibold">Resident</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Due Date</th>
                  <th className="px-4 py-3 font-semibold">Late Fee</th>
                  <th className="px-4 py-3 font-semibold">Paid Date</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleBills.map((bill) => (
                  <tr key={bill._id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{monthLabel(bill.month)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{bill.flatNumber || '-'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <div className="inline-flex items-center gap-2">
                        <FiUser size={13} />
                        <span>{bill.residentName || bill?.residentId?.name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">INR {Number(bill.amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${billStatusPill(bill.status)}`}>{bill.status || 'Unpaid'}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(bill.dueDate)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">INR {Number(bill.lateFee || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(bill.paidAt)}</td>
                    <td className="px-4 py-3">
                      {String(bill.status || '').toLowerCase() === 'paid' ? (
                        <span className="text-xs font-semibold text-emerald-600">Completed</span>
                      ) : (
                        <AppButton type="button" variant="primary" onClick={() => handleMarkPaid(bill._id)} disabled={markingPaidId === String(bill._id)}>
                          {markingPaidId === String(bill._id) ? 'Marking...' : 'Mark Paid'}
                        </AppButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <span>
            Page {pagination.page || 1} of {pagination.totalPages || 1}
          </span>
          <div className="flex gap-2">
            <AppButton type="button" variant="secondary" disabled={(pagination.page || 1) <= 1} onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, Number(prev.page || 1) - 1) }))}>
              Prev
            </AppButton>
            <AppButton type="button" variant="secondary" disabled={(pagination.page || 1) >= (pagination.totalPages || 1)} onClick={() => setFilters((prev) => ({ ...prev, page: Number(prev.page || 1) + 1 }))}>
              Next
            </AppButton>
          </div>
        </div>
      </AppCard>
    </div>
  );
}

export default MaintenancePage;
