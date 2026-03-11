import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { FiBell, FiMapPin, FiTrash2 } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import AppButton from '../components/ui/AppButton.jsx';
import AppCard from '../components/ui/AppCard.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

function NoticesPage() {
  const { apiRequest, admin } = useAuth();
  const { showToast } = useToast();
  const role = admin?.role;
  const isAdmin = role === 'admin' || role === 'super_admin';

  const [societies, setSocieties] = useState([]);
  const [selectedSocietyId, setSelectedSocietyId] = useState(admin?.societyId || '');
  const [notices, setNotices] = useState([]);
  const [alertsHistory, setAlertsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: '' });
  const [confirmDeleteAlert, setConfirmDeleteAlert] = useState({ open: false, id: '' });

  const canPickSociety = isAdmin && !admin?.societyId;

  async function loadSocieties() {
    if (!canPickSociety) return;
    try {
      const payload = await apiRequest('/api/societies?limit=100', { raw: true });
      const list = payload.data || [];
      setSocieties(list);
      if (!selectedSocietyId && list.length) {
        setSelectedSocietyId(list[0]._id);
      }
    } catch {
      // Non-blocking
    }
  }

  async function loadNotices() {
    try {
      setLoading(true);
      setError('');
      const query = canPickSociety && selectedSocietyId ? `?societyId=${selectedSocietyId}` : '';
      const payload = await apiRequest(`/api/notices${query}`, { raw: true });
      setNotices(payload.data || []);
    } catch (err) {
      const message = err.message || 'Failed to load notices.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadAlertsHistory() {
    if (!isAdmin) return;
    try {
      const payload = await apiRequest('/api/alerts/history', { raw: true });
      setAlertsHistory(payload?.data || []);
    } catch {
      setAlertsHistory([]);
    }
  }

  useEffect(() => {
    loadSocieties();
  }, [canPickSociety]);

  useEffect(() => {
    if (canPickSociety && !selectedSocietyId) return;
    loadNotices();
    loadAlertsHistory();
  }, [selectedSocietyId, canPickSociety]);

  async function deleteNotice() {
    try {
      const id = confirmDelete.id;
      if (!id) return;
      await apiRequest(`/api/notices/${id}`, { method: 'DELETE' });
      setConfirmDelete({ open: false, id: '' });
      showToast('Notice deleted successfully.', 'success');
      window.dispatchEvent(new CustomEvent('society:ticker-refresh'));
      await loadNotices();
    } catch (err) {
      const message = err.message || 'Failed to delete notice.';
      setError(message);
      showToast(message, 'error');
      setConfirmDelete({ open: false, id: '' });
    }
  }

  async function markRead(id) {
    try {
      const query = canPickSociety && selectedSocietyId ? `?societyId=${selectedSocietyId}` : '';
      await apiRequest(`/api/notices/${id}/read${query}`, { method: 'PUT' });
      await loadNotices();
    } catch (err) {
      const message = err.message || 'Failed to mark notice as read.';
      setError(message);
      showToast(message, 'error');
    }
  }

  async function deleteAlert() {
    try {
      const id = confirmDeleteAlert.id;
      if (!id) return;
      await apiRequest(`/api/alerts/${id}`, { method: 'DELETE', raw: true });
      setConfirmDeleteAlert({ open: false, id: '' });
      showToast('Alert deleted successfully.', 'success');
      window.dispatchEvent(new CustomEvent('society:ticker-refresh'));
      await loadAlertsHistory();
    } catch (err) {
      const message = err.message || 'Failed to delete alert.';
      showToast(message, 'error');
      setConfirmDeleteAlert({ open: false, id: '' });
    }
  }

  const pinnedNotices = useMemo(() => notices.filter((item) => item.isPinned), [notices]);

  return (
    <div className="app-fade-up space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-cyan-200/70 bg-gradient-to-br from-cyan-100 via-white to-blue-100 p-6 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800"
      >
        <div className="flex items-center gap-3">
          <FiBell className="text-cyan-700 dark:text-cyan-300" size={22} />
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Notice Board</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Admin can publish notices. All users can read notices in their society.
            </p>
          </div>
        </div>
      </motion.section>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <AppCard className="p-5">
          {canPickSociety && (
            <div className="mb-4 max-w-md">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Society
              </label>
              <select
                value={selectedSocietyId}
                onChange={(e) => setSelectedSocietyId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              >
                <option value="">Select Society</option>
                {societies.map((society) => (
                  <option key={society._id} value={society._id}>
                    {society.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {loading ? (
            <div className="space-y-2">
              <div className="h-20 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-20 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-20 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            </div>
          ) : notices.length === 0 ? (
            <EmptyState message="No notices available." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Details</th>
                    <th className="px-3 py-2">Posted By</th>
                    <th className="px-3 py-2">Posted On</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {notices.map((notice) => (
                    <tr key={notice._id} className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                      <td className="px-3 py-3">
                        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                          {notice.title}
                          {notice.isPinned && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                              <FiMapPin size={11} /> Pinned
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="max-w-lg px-3 py-3 text-sm text-slate-600 dark:text-slate-300">{notice.description}</td>
                      <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">{notice.createdBy?.name || 'Admin'}</td>
                      <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">{new Date(notice.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-3">
                        {notice.isRead ? (
                          <span className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                            Read
                          </span>
                        ) : (
                          <span className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                            Unread
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {!notice.isRead && (
                            <AppButton
                              type="button"
                              onClick={() => markRead(notice._id)}
                              className="px-2.5 py-1.5 text-xs"
                            >
                              Mark Read
                            </AppButton>
                          )}
                          {isAdmin && (
                            <AppButton
                              type="button"
                              variant="secondary"
                              onClick={() => setConfirmDelete({ open: true, id: notice._id })}
                              className="p-2"
                            >
                              <FiTrash2 size={14} />
                            </AppButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AppCard>
      </motion.div>

      {isAdmin && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <AppCard className="p-5">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Alert History</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Scheduled alert notices posted from notification control.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Start</th>
                    <th className="px-3 py-2">End</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {alertsHistory.map((row) => (
                    <tr key={row._id} className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                      <td className="px-3 py-3 text-sm font-semibold text-slate-900 dark:text-white">{row.title}</td>
                      <td className="px-3 py-3 text-sm text-slate-700 dark:text-slate-300">{row.priority}</td>
                      <td className="px-3 py-3 text-sm text-slate-700 dark:text-slate-300">{row.startTime ? new Date(row.startTime).toLocaleString() : '-'}</td>
                      <td className="px-3 py-3 text-sm text-slate-700 dark:text-slate-300">{row.endTime ? new Date(row.endTime).toLocaleString() : '-'}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${row.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>
                          {row.status || 'Expired'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <AppButton
                          type="button"
                          variant="secondary"
                          onClick={() => setConfirmDeleteAlert({ open: true, id: row._id })}
                          className="p-2"
                        >
                          <FiTrash2 size={14} />
                        </AppButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!alertsHistory.length ? <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No alert history yet.</p> : null}
            </div>
          </AppCard>
        </motion.div>
      )}

      {pinnedNotices.length > 0 && (
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Active pinned notices: {pinnedNotices.length}
        </p>
      )}

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">{error}</p>}

      <ConfirmModal
        open={confirmDelete.open}
        title="Delete Notice"
        description="Do you want to remove this notice?"
        confirmLabel="Delete"
        onConfirm={deleteNotice}
        onCancel={() => setConfirmDelete({ open: false, id: '' })}
      />
      <ConfirmModal
        open={confirmDeleteAlert.open}
        title="Delete Alert"
        description="Do you want to remove this scheduled alert?"
        confirmLabel="Delete"
        onConfirm={deleteAlert}
        onCancel={() => setConfirmDeleteAlert({ open: false, id: '' })}
      />
    </div>
  );
}

export default NoticesPage;
