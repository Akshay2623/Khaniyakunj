import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiFilter,
  FiImage,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiTag,
  FiUploadCloud,
  FiUser,
  FiZap,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

const CATEGORY_OPTIONS = ['Electrician', 'Plumber', 'Lift', 'Water', 'Cleaning', 'Security'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];
const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'Pending', label: 'Pending' },
  { key: 'InProgress', label: 'In Progress' },
  { key: 'Resolved', label: 'Resolved' },
];
const DRAFT_KEY_BASE = 'resident_service_request_draft_v2';

function normalizeStatus(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'completed') return 'Resolved';
  if (normalized === 'assigned') return 'InProgress';
  if (normalized === 'inprogress') return 'InProgress';
  if (normalized === 'resolved') return 'Resolved';
  return 'Pending';
}

function formatStatus(status) {
  if (status === 'InProgress') return 'In Progress';
  return status;
}

function statusTone(status) {
  if (status === 'Resolved') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200';
  if (status === 'InProgress') return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-200';
  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200';
}

function StatCard({ title, value, icon: Icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{title}</p>
        <span className="rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
          <Icon size={15} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
    </motion.div>
  );
}

function RequestCard({ request, canUpdateStatus, onStatusUpdate, statusUpdatingId }) {
  const status = normalizeStatus(request.status);
  const creatorName = request?.createdBy?.name || request?.residentId?.name || '-';
  const creatorRole = String(request?.createdByRole || request?.createdBy?.role || '').toUpperCase();
  const canStartWork = status === 'Pending';
  const canResolve = status === 'InProgress' || status === 'Pending';

  return (
    <li className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{request.title}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{request.description}</p>
          {request.imageUrl && (
            <a
              href={request.imageUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
            >
              <FiImage size={12} /> View image
            </a>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
              {request.category}
            </span>
            <span className={`rounded-full px-2 py-0.5 font-semibold ${statusTone(status)}`}>{formatStatus(status)}</span>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
              Priority: {request.priority}
            </span>
          </div>
          <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <p>Submitted: {new Date(request.createdAt).toLocaleString()}</p>
            <p>Assigned workflow: Guard</p>
            <p className="inline-flex items-center gap-1">
              <FiUser size={12} /> Creator: {creatorName} {creatorRole ? `(${creatorRole})` : ''}
            </p>
            {request.preferredVisitTime ? <p>Preferred visit: {new Date(request.preferredVisitTime).toLocaleString()}</p> : null}
          </div>
        </div>

        {canUpdateStatus ? (
          <div className="w-full space-y-2 md:w-56">
            {canStartWork ? (
              <button
                type="button"
                onClick={() => onStatusUpdate(request._id, 'InProgress')}
                disabled={statusUpdatingId === String(request._id)}
                className="w-full rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-60"
              >
                {statusUpdatingId === String(request._id) ? 'Updating...' : 'Start Work'}
              </button>
            ) : null}
            {canResolve ? (
              <button
                type="button"
                onClick={() => onStatusUpdate(request._id, 'Resolved')}
                disabled={statusUpdatingId === String(request._id)}
                className="w-full rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {statusUpdatingId === String(request._id) ? 'Updating...' : 'Mark Resolved'}
              </button>
            ) : null}
            {!canStartWork && !canResolve ? (
              <span className="inline-flex w-full justify-center rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Workflow Complete
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function ServiceRequestsPage() {
  const { apiRequest, admin } = useAuth();
  const { showToast } = useToast();
  const role = String(admin?.role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const roleLooksGuard = role.includes('guard') || role.includes('security');
  const canCreateRequest = ['admin', 'super_admin', 'committee', 'tenant', 'owner', 'resident'].includes(role);
  const canUpdateStatus = ['admin', 'super_admin'].includes(role) || roleLooksGuard;
  const draftKey = `${DRAFT_KEY_BASE}:${String(admin?._id || 'anon')}`;

  const [requests, setRequests] = useState([]);
  const [filters, setFilters] = useState({ status: '', category: '' });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState('');
  const [showBoard, setShowBoard] = useState(!['admin', 'super_admin'].includes(role));

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Electrician',
    priority: 'Medium',
    imageUrl: '',
    preferredVisitTime: '',
  });

  useEffect(() => {
    if (!canCreateRequest) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) setForm((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch {
      // ignore invalid local draft
    }
  }, [canCreateRequest, draftKey]);

  useEffect(() => {
    if (!canCreateRequest) return;
    localStorage.setItem(draftKey, JSON.stringify(form));
  }, [canCreateRequest, draftKey, form]);

  async function loadRequests() {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (filters.status) query.set('status', filters.status);
      if (filters.category) query.set('category', filters.category);
      const payload = await apiRequest(`/api/service-requests${query.toString() ? `?${query.toString()}` : ''}`, { raw: true });
      const rows = Array.isArray(payload) ? payload : payload?.data || [];
      setRequests(rows);
    } catch (error) {
      showToast(error.message || 'Failed to load service requests.', 'error');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!role) return;
    loadRequests();
  }, [role, filters.status, filters.category]);

  useEffect(() => {
    setShowBoard(!['admin', 'super_admin'].includes(role));
  }, [role]);

  function clearRequestForm() {
    setForm({
      title: '',
      description: '',
      category: 'Electrician',
      priority: 'Medium',
      imageUrl: '',
      preferredVisitTime: '',
    });
    localStorage.removeItem(draftKey);
    showToast('Draft cleared.', 'info');
  }

  async function handleImageUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, imageUrl: String(reader.result || '') }));
    reader.readAsDataURL(file);
  }

  function requestCreate(event) {
    event.preventDefault();
    if (!String(form.title || '').trim()) {
      showToast('Title is required.', 'error');
      return;
    }
    if (!String(form.description || '').trim()) {
      showToast('Description is required.', 'error');
      return;
    }
    if (!String(form.category || '').trim()) {
      showToast('Category is required.', 'error');
      return;
    }
    if (!PRIORITY_OPTIONS.includes(form.priority)) {
      showToast('Invalid priority selected.', 'error');
      return;
    }
    setConfirmSubmit(true);
  }

  async function confirmCreateComplaint() {
    try {
      await apiRequest('/api/service-requests', {
        method: 'POST',
        body: {
          ...form,
          title: String(form.title || '').trim(),
          description: String(form.description || '').trim(),
        },
      });
      showToast('Service request created and routed to Guard workflow.', 'success');
      clearRequestForm();
      setConfirmSubmit(false);
      await loadRequests();
    } catch (error) {
      showToast(error.message || 'Failed to create service request.', 'error');
      setConfirmSubmit(false);
    }
  }

  async function updateStatus(id, status) {
    try {
      setStatusUpdatingId(String(id));
      await apiRequest(`/api/service-requests/${id}/status`, {
        method: 'PUT',
        body: { status },
      });
      showToast('Service request status updated.', 'success');
      await loadRequests();
    } catch (error) {
      showToast(error.message || 'Failed to update status.', 'error');
    } finally {
      setStatusUpdatingId('');
    }
  }

  const stats = useMemo(() => {
    const normalized = requests.map((row) => normalizeStatus(row.status));
    const total = normalized.length;
    const pending = normalized.filter((s) => s === 'Pending').length;
    const inProgress = normalized.filter((s) => s === 'InProgress').length;
    const resolved = normalized.filter((s) => s === 'Resolved').length;
    return { total, pending, inProgress, resolved };
  }, [requests]);

  const visibleRequests = useMemo(() => {
    const query = String(search || '').trim().toLowerCase();
    if (!query) return requests;
    return requests.filter((item) =>
      [
        item.title,
        item.description,
        item.category,
        item.priority,
        item.status,
        item?.createdBy?.name,
        item?.createdByRole,
        item?.residentId?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [requests, search]);

  return (
    <div className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-white to-emerald-50 p-5 shadow-panel"
      >
        <h2 className="text-2xl font-semibold text-slate-900">Service Request Workflow</h2>
        <p className="mt-1 text-sm text-slate-600">
          Requests are auto-routed to Guard workflow. Visibility is restricted to creator, admin, and guard.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key || 'all'}
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, status: tab.key }))}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                filters.status === tab.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </motion.section>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Requests" value={stats.total} icon={FiAlertCircle} />
        <StatCard title="Pending" value={stats.pending} icon={FiClock} />
        <StatCard title="In Progress" value={stats.inProgress} icon={FiZap} />
        <StatCard title="Resolved" value={stats.resolved} icon={FiCheckCircle} />
      </div>

      {canCreateRequest ? (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-cyan-50/40 to-emerald-50/40 p-5 shadow-panel dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Create Service Request</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Title, description and category are mandatory. Request is assigned to Guard automatically.
              </p>
            </div>
          </div>

          <form className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]" onSubmit={requestCreate}>
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/70">
              <label className="block">
                <span className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <FiEdit3 size={12} /> Request title
                </span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Example: Water leakage in kitchen"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <FiTag size={12} /> Description
                </span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Describe location and issue details"
                  className="min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </label>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/70">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Category</span>
                <select
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</span>
                <select
                  value={form.priority}
                  onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800"
                >
                  {PRIORITY_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Preferred visit time</span>
                <input
                  type="datetime-local"
                  value={form.preferredVisitTime}
                  onChange={(event) => setForm((prev) => ({ ...prev, preferredVisitTime: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
            </div>

            <label className="lg:col-span-2 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <FiUploadCloud />
              Upload image evidence
              <input type="file" accept="image/*" className="hidden" onChange={(event) => handleImageUpload(event.target.files?.[0])} />
              {form.imageUrl ? (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                  <FiImage size={12} /> Attached
                </span>
              ) : null}
            </label>

            <div className="lg:col-span-2 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={clearRequestForm}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              >
                Clear Draft
              </button>
              <button className="rounded-xl bg-gradient-to-r from-cyan-600 via-brand-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 hover:brightness-105">
                <span className="inline-flex items-center gap-2">
                  <FiZap size={14} />
                  <FiSend /> Submit Request
                </span>
              </button>
            </div>
          </form>
        </motion.section>
      ) : null}

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-lg font-semibold text-slate-900 dark:text-white">Service Request Board</h2>
          <button
            type="button"
            onClick={() => setShowBoard((prev) => !prev)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          >
            {showBoard ? 'Hide List' : 'Show List'}
          </button>
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <FiFilter size={12} /> Filter
          </span>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
            <FiSearch size={12} className="text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search requests"
              className="w-40 bg-transparent text-xs outline-none"
            />
          </div>
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="InProgress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>
          <select
            value={filters.category}
            onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={loadRequests}
            className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
          >
            <span className="inline-flex items-center gap-1">
              <FiRefreshCw size={12} /> Refresh
            </span>
          </button>
        </div>
        {showBoard ? (
          loading ? (
            <div className="space-y-2">
              <div className="h-20 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-20 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-20 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            </div>
          ) : !visibleRequests.length ? (
            <EmptyState
              message={
                canCreateRequest ? 'You have not created any requests yet, or none match current filters.' : 'No service requests found.'
              }
            />
          ) : (
            <ul className="space-y-3">
              {visibleRequests.map((request) => (
                <RequestCard
                  key={request._id}
                  request={request}
                  canUpdateStatus={canUpdateStatus}
                  onStatusUpdate={updateStatus}
                  statusUpdatingId={statusUpdatingId}
                />
              ))}
            </ul>
          )
        ) : (
          <EmptyState message="List is hidden. Click Show List to view requests." />
        )}
      </motion.section>

      <ConfirmModal
        open={confirmSubmit}
        title="Submit Service Request"
        description="This request will be auto-assigned to Guard workflow. Continue?"
        confirmLabel="Submit"
        onConfirm={confirmCreateComplaint}
        onCancel={() => setConfirmSubmit(false)}
      />
    </div>
  );
}

export default ServiceRequestsPage;
