import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiClock, FiDollarSign, FiSearch, FiTrendingUp } from 'react-icons/fi';
import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '../contexts/AuthContext.jsx';

function PaymentStat({ label, value, icon: Icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</p>
        <span className="rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
          <Icon size={15} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
    </motion.div>
  );
}

function PaymentsPage() {
  const { apiRequest, admin } = useAuth();
  const role = admin?.role;
  const isAdmin = role === 'admin' || role === 'committee';

  const [bills, setBills] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [quickStatus, setQuickStatus] = useState('all');

  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    status: '',
    month: '',
  });

  async function loadBills() {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      if (!isAdmin) {
        const payload = await apiRequest('/api/maintenance/my');
        setBills(Array.isArray(payload) ? payload : payload.data || []);
        setPagination(null);
        return;
      }

      const query = new URLSearchParams();
      query.set('page', String(filters.page));
      query.set('limit', String(filters.limit));
      if (filters.status) query.set('status', filters.status);
      if (filters.month) query.set('month', filters.month);

      const payload = await apiRequest(`/api/maintenance?${query.toString()}`);
      setBills(payload.data || []);
      setPagination(payload.pagination || null);
    } catch (err) {
      setError(err.message || 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBills();
  }, [filters.page, filters.status, filters.month, role]);

  async function markAsPaid(id) {
    try {
      setError('');
      setSuccess('');
      await apiRequest(`/api/maintenance/${id}/pay`, { method: 'PUT' });
      await loadBills();
      setSuccess('Payment updated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to mark as paid.');
    }
  }

  const summary = useMemo(() => {
    const paid = bills.filter((b) => b.status === 'Paid');
    const pending = bills.filter((b) => b.status !== 'Paid');
    const totalCollected = paid.reduce((sum, bill) => sum + Number(bill.amount || 0) + Number(bill.lateFee || 0), 0);
    const totalPending = pending.reduce((sum, bill) => sum + Number(bill.amount || 0) + Number(bill.lateFee || 0), 0);

    return {
      paidCount: paid.length,
      pendingCount: pending.length,
      totalCollected: totalCollected.toFixed(2),
      totalPending: totalPending.toFixed(2),
    };
  }, [bills]);

  const statusChartData = useMemo(() => {
    const paid = bills.filter((b) => b.status === 'Paid').length;
    const overdue = bills.filter((b) => b.status === 'Overdue').length;
    const unpaid = bills.filter((b) => b.status === 'Unpaid').length;
    return [
      { name: 'Paid', value: paid, fill: '#14b8a6' },
      { name: 'Unpaid', value: unpaid, fill: '#0ea5e9' },
      { name: 'Overdue', value: overdue, fill: '#ef4444' },
    ];
  }, [bills]);

  const visibleBills = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = !term ? bills : bills.filter((bill) =>
      [bill.month, bill.status, bill?.residentId?.name, bill?.residentId?.email]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
    if (quickStatus === 'all') return base;
    if (quickStatus === 'pending') return base.filter((bill) => bill.status !== 'Paid');
    return base.filter((bill) => bill.status === quickStatus);
  }, [bills, search, quickStatus]);

  return (
    <div className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-emerald-200/60 bg-gradient-to-br from-emerald-100 via-white to-cyan-100 p-6 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800"
      >
        <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-emerald-400/20 blur-2xl" />
        <div className="absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-cyan-400/20 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-300">Collections</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Payment Intelligence Desk</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              Track bill collections, payment health, and pending exposure with role-based actions.
            </p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <p className="text-xs uppercase tracking-wider text-slate-500">Collection Ratio</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
              {summary.paidCount + summary.pendingCount === 0
                ? '0%'
                : `${Math.round((summary.paidCount / (summary.paidCount + summary.pendingCount)) * 100)}%`}
            </p>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-4 md:grid-cols-4">
        <PaymentStat label="Paid Bills" value={summary.paidCount} icon={FiCheckCircle} />
        <PaymentStat label="Pending Bills" value={summary.pendingCount} icon={FiClock} />
        <PaymentStat label="Collected" value={`INR ${summary.totalCollected}`} icon={FiDollarSign} />
        <PaymentStat label="Pending Amount" value={`INR ${summary.totalPending}`} icon={FiTrendingUp} />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel xl:col-span-2 dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Payment Status Mix</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Current distribution of bill states.</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusChartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel xl:col-span-3 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-lg font-semibold text-slate-900 dark:text-white">Payment Ledger</h2>
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search month/status/resident"
                className="w-56 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <button onClick={() => setQuickStatus('all')} className={`px-2.5 py-1.5 text-xs font-semibold ${quickStatus === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}>All</button>
              <button onClick={() => setQuickStatus('Paid')} className={`px-2.5 py-1.5 text-xs font-semibold ${quickStatus === 'Paid' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}>Paid</button>
              <button onClick={() => setQuickStatus('pending')} className={`px-2.5 py-1.5 text-xs font-semibold ${quickStatus === 'pending' ? 'bg-amber-600 text-white' : 'bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}>Pending</button>
            </div>
            {isAdmin && (
              <>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">All Status</option>
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Overdue">Overdue</option>
                </select>
                <input
                  type="month"
                  value={filters.month}
                  onChange={(e) => setFilters((prev) => ({ ...prev, month: e.target.value, page: 1 }))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800"
                />
              </>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading payment records...</p>
          ) : visibleBills.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No bills found.</p>
          ) : (
            <div className="space-y-3">
              {visibleBills.map((bill) => (
                <div
                  key={bill._id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:-translate-y-0.5 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <div className={`mb-2 h-1.5 rounded-full ${bill.status === 'Paid' ? 'bg-emerald-500' : bill.status === 'Overdue' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {bill.month} - INR {Number(bill.amount || 0).toFixed(2)}
                    </p>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                      {bill.status}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Due: {new Date(bill.dueDate).toLocaleDateString()}
                    </p>
                    {bill.paidAt && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-300">
                        Paid: {new Date(bill.paidAt).toLocaleDateString()}
                      </p>
                    )}
                    {bill.lateFee > 0 && (
                      <p className="text-xs text-rose-600 dark:text-rose-300">
                        Late Fee: INR {Number(bill.lateFee).toFixed(2)}
                      </p>
                    )}
                    {isAdmin && bill.status !== 'Paid' && (
                      <button
                        type="button"
                        onClick={() => markAsPaid(bill._id)}
                        className="ml-auto rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Mark Paid
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {pagination && (
                <div className="flex items-center justify-between pt-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <span>
                    Page {pagination.page} of {pagination.totalPages || 1}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pagination.page <= 1}
                      onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
                      className="rounded-lg bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-100"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
                      className="rounded-lg bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-100"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.section>
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">{error}</p>}
      {success && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">{success}</p>}
    </div>
  );
}

export default PaymentsPage;
