import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { FiRefreshCw, FiUserX, FiEdit2, FiTrash2, FiUserCheck } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import EditPopup from '../components/EditPopup.jsx';

const ROLE_OPTIONS = ['committee', 'resident', 'guard'];
const STATUS_OPTIONS = ['Active', 'Inactive', 'Suspended'];

function UserManagementPage() {
  const { apiRequest } = useAuth();
  const { showToast } = useToast();

  const [societies, setSocieties] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [units, setUnits] = useState([]);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submittingUser, setSubmittingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState({ open: false, userId: '' });

  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    role: '',
    status: '',
    search: '',
    societyId: '',
  });

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    societyId: '',
    buildingId: '',
    unitId: '',
    status: 'Active',
  });

  const isUnitRole = useMemo(() => ['resident', 'tenant', 'owner'].includes(String(form.role || '').toLowerCase()), [form.role]);
  const showSocietySelector = societies.length > 1;

  function setSocietyScope(nextSocietyId) {
    setForm((prev) => ({
      ...prev,
      societyId: nextSocietyId,
      buildingId: '',
      unitId: '',
    }));
    setFilters((prev) => ({
      ...prev,
      societyId: nextSocietyId,
      page: 1,
    }));
  }

  async function loadSocieties() {
    const payload = await apiRequest('/api/societies?limit=100', { raw: true });
    const list = payload.data || [];
    setSocieties(list);
    if (!form.societyId && list.length) {
      setSocietyScope(list[0]._id);
    }
  }

  async function loadBuildings(societyId) {
    if (!societyId) {
      setBuildings([]);
      return;
    }
    const list = await apiRequest(`/api/buildings?societyId=${societyId}`);
    setBuildings(list || []);
  }

  async function loadUnits(societyId, buildingId) {
    if (!societyId) {
      setUnits([]);
      return;
    }
    const query = new URLSearchParams();
    query.set('societyId', societyId);
    if (buildingId) query.set('buildingId', buildingId);
    const list = await apiRequest(`/api/units?${query.toString()}`);
    setUnits(list || []);
  }

  async function loadUsers(nextFilters = filters) {
    const query = new URLSearchParams();
    query.set('page', String(nextFilters.page));
    query.set('limit', String(nextFilters.limit));
    if (nextFilters.role) query.set('role', nextFilters.role);
    if (nextFilters.status) query.set('status', nextFilters.status);
    if (nextFilters.search) query.set('search', nextFilters.search);
    if (nextFilters.societyId) query.set('societyId', nextFilters.societyId);
    const payload = await apiRequest(`/api/users?${query.toString()}`, { raw: true });
    setUsers(payload.data || []);
    setPagination(payload.meta?.pagination || null);
  }

  async function bootstrap() {
    try {
      setLoading(true);
      await loadSocieties();
    } catch (err) {
      showToast(err.message || 'Failed to load initial data.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (!form.societyId) return;
    loadBuildings(form.societyId).catch(() => showToast('Failed to load buildings.', 'error'));
  }, [form.societyId]);

  useEffect(() => {
    if (!form.societyId) return;
    loadUnits(form.societyId, form.buildingId).catch(() => showToast('Failed to load units.', 'error'));
  }, [form.societyId, form.buildingId]);

  useEffect(() => {
    loadUsers(filters).catch((err) => showToast(err.message || 'Failed to load users.', 'error'));
  }, [filters.page, filters.role, filters.status, filters.search, filters.societyId]);

  function onFormChange(event) {
    const { name, value, type, checked } = event.target;
    const nextValue = type === 'checkbox' ? checked : value;
    if (name === 'societyId') {
      setSocietyScope(nextValue);
      return;
    }
    setForm((prev) => {
      if (name === 'buildingId') {
        return {
          ...prev,
          buildingId: nextValue,
          unitId: '',
        };
      }
      return { ...prev, [name]: nextValue };
    });
  }

  function resetForm() {
    setEditingUserId('');
    setForm((prev) => ({
      ...prev,
      name: '',
      email: '',
      phone: '',
      role: '',
      buildingId: '',
      unitId: '',
      status: 'Active',
    }));
  }

  function onEditUser(user) {
    setEditingUserId(user.id);
    setForm((prev) => ({
      ...prev,
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || '',
      societyId: user.societyId || prev.societyId || '',
      buildingId: user.buildingId || '',
      unitId: user.unitId || '',
      status: user.status || 'Active',
    }));
  }

  async function onSubmitUser(event) {
    event.preventDefault();
    if (submittingUser) return;
    if (!editingUserId && !String(form.role || '').trim()) {
      showToast('Please select a role.', 'error');
      return;
    }
    if (String(form.phone || '').trim()) {
      if (/[A-Za-z]/.test(String(form.phone))) {
        showToast('Phone number cannot contain alphabets.', 'error');
        return;
      }
      const digits = String(form.phone).replace(/\D+/g, '');
      if (digits.length !== 10) {
        showToast('Phone number must be exactly 10 digits.', 'error');
        return;
      }
    }
    if (!editingUserId && isUnitRole && !String(form.unitId || '').trim()) {
      showToast('Please select an available unit for this resident.', 'error');
      return;
    }
    try {
      setSubmittingUser(true);
      if (editingUserId) {
        const payload = {
          name: form.name,
          email: form.email,
          phone: form.phone,
          status: form.status,
          societyId: form.societyId || undefined,
          buildingId: form.buildingId || undefined,
          unitId: isUnitRole ? form.unitId || undefined : undefined,
        };
        const updated = await apiRequest(`/api/users/${editingUserId}`, {
          method: 'PUT',
          body: payload,
          raw: true,
        });
        showToast(updated.message || 'User updated successfully.', 'success');
      } else {
        const payload = {
          ...form,
          societyId: form.societyId || undefined,
          sendInvite: true,
          buildingId: form.buildingId || undefined,
          unitId: isUnitRole ? form.unitId || undefined : undefined,
        };
        const created = await apiRequest('/api/users', { method: 'POST', body: payload, raw: true });
        const inviteStatus = String(created.data?.invite?.status || '').toUpperCase();
        if (inviteStatus === 'SENT') {
          showToast('User added and email password has been sent to login.', 'success');
        } else {
          const tempPassword = created.data?.temporaryPassword ? ` Temp password: ${created.data.temporaryPassword}` : '';
          showToast(`User added, but email could not be sent right now.${tempPassword}`, 'error');
        }
      }

      resetForm();
      setFilters((prev) => ({
        ...prev,
        page: 1,
        societyId: form.societyId || prev.societyId,
      }));
      await loadUsers({
        ...filters,
        page: 1,
        societyId: form.societyId || filters.societyId,
      });
    } catch (err) {
      showToast(err.message || (editingUserId ? 'Failed to update user.' : 'Failed to create user.'), 'error');
    } finally {
      setSubmittingUser(false);
    }
  }

  async function doAction(userId, action, body = null) {
    try {
      const payload = await apiRequest(`/api/users/${userId}/${action}`, {
        method: action === 'resend-invite' ? 'POST' : 'PUT',
        body: body || undefined,
        raw: true,
      });
      const tempPassword = payload.data?.temporaryPassword ? ` Temp password: ${payload.data.temporaryPassword}` : '';
      showToast(`${payload.message || 'Action completed.'}${tempPassword}`, 'success');
      await loadUsers(filters);
    } catch (err) {
      const errorText = String(err?.message || '').toLowerCase();
      if (action === 'activate' && errorText.includes('route not found')) {
        try {
          const fallback = await apiRequest(`/api/users/${userId}`, {
            method: 'PUT',
            body: { status: 'Active' },
            raw: true,
          });
          showToast(fallback.message || 'User activated successfully.', 'success');
          await loadUsers(filters);
          return;
        } catch (fallbackErr) {
          showToast(fallbackErr.message || 'Activation failed.', 'error');
          return;
        }
      }
      showToast(err.message || 'Action failed.', 'error');
    }
  }

  async function onDeleteUser() {
    try {
      if (!confirmDelete.userId) return;
      const payload = await apiRequest(`/api/users/${confirmDelete.userId}`, { method: 'DELETE', raw: true });
      showToast(payload.message || 'User deleted successfully.', 'success');
      if (editingUserId === confirmDelete.userId) {
        resetForm();
      }
      setConfirmDelete({ open: false, userId: '' });
      await loadUsers(filters);
    } catch (err) {
      showToast(err.message || 'Failed to delete user.', 'error');
      setConfirmDelete({ open: false, userId: '' });
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading user management...</p>;
  }

  return (
    <div className="space-y-5">
      <div className={`${!editingUserId ? 'grid gap-5 xl:grid-cols-[minmax(380px,460px),minmax(0,1fr)] xl:items-start' : ''}`}>
      {!editingUserId && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="xl:sticky xl:top-24 rounded-3xl border border-sky-200/80 bg-gradient-to-br from-white via-sky-50 to-blue-100/80 p-5 shadow-panel dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">User Access & Role Management</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Create and lifecycle-manage users with dynamic role impact.</p>

          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onSubmitUser}>
            <input name="name" value={form.name} onChange={onFormChange} placeholder="Full name" className="rounded-xl border border-sky-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800" required />
            <input type="email" name="email" value={form.email} onChange={onFormChange} placeholder="Enter email address" className="rounded-xl border border-sky-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800" required />
            <input name="phone" value={form.phone} onChange={onFormChange} placeholder="Enter phone number" className="rounded-xl border border-sky-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800" />

            <select
              name="role"
              value={form.role}
              onChange={onFormChange}
              className="rounded-xl border border-sky-200 bg-white/90 px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800"
              required
            >
              <option value="" disabled>
                Select role
              </option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            {isUnitRole && (
              <select
                name="unitId"
                value={form.unitId}
                onChange={onFormChange}
                className="md:col-span-2 rounded-xl border border-sky-200 bg-white/90 px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800"
                required
              >
                <option value="">Select available unit</option>
                {units
                  .filter((unit) => {
                    const status = String(unit?.status || '').toUpperCase();
                    const occupied = String(unit?.occupancyStatus || '').toLowerCase() === 'occupied';
                    const hasAssigned = Boolean(unit?.assignedResidentId || unit?.tenantId || unit?.ownerId);
                    return !hasAssigned && !occupied && status !== 'OCCUPIED';
                  })
                  .map((unit) => (
                    <option key={unit._id} value={unit._id}>
                      {unit.unitNumber || `${unit.wing || ''}${unit.wing ? '-' : ''}${unit.flatNumber || ''}`.replace(/^-/, '')}
                    </option>
                  ))}
              </select>
            )}
            <button
              disabled={submittingUser}
              className="md:col-span-2 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-300/60 hover:from-sky-500 hover:via-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingUser ? 'Creating...' : 'Create User'}
            </button>
          </form>
        </motion.section>
      )}

      <EditPopup open={Boolean(editingUserId)} title="Edit User" onClose={resetForm} maxWidthClass="max-w-4xl">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={onSubmitUser}>
          <input name="name" value={form.name} onChange={onFormChange} placeholder="Full name" className="rounded-xl border border-sky-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800" required />
          <input type="email" name="email" value={form.email} onChange={onFormChange} placeholder="Enter email address" className="rounded-xl border border-sky-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800" required />
          <input name="phone" value={form.phone} onChange={onFormChange} placeholder="Enter phone number" className="rounded-xl border border-sky-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800" />

          <select
            name="role"
            value={form.role}
            onChange={onFormChange}
            disabled
            className="rounded-xl border border-sky-200 bg-white/90 px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800"
            required
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          {isUnitRole && (
            <select
              name="unitId"
              value={form.unitId}
              onChange={onFormChange}
              className="rounded-xl border border-sky-200 bg-white/90 px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">Select available unit</option>
              {units
                .filter((unit) => {
                  const status = String(unit?.status || '').toUpperCase();
                  const occupied = String(unit?.occupancyStatus || '').toLowerCase() === 'occupied';
                  const hasAssigned = Boolean(unit?.assignedResidentId || unit?.tenantId || unit?.ownerId);
                  const isCurrentEditUnit = String(unit?._id) === String(form.unitId);
                  return isCurrentEditUnit || (!hasAssigned && !occupied && status !== 'OCCUPIED');
                })
                .map((unit) => (
                  <option key={unit._id} value={unit._id}>
                    {unit.unitNumber || `${unit.wing || ''}${unit.wing ? '-' : ''}${unit.flatNumber || ''}`.replace(/^-/, '')}
                  </option>
                ))}
            </select>
          )}
          <div className="md:col-span-2 xl:col-span-4 flex gap-2">
            <button
              disabled={submittingUser}
              className="rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-300/60 hover:from-sky-500 hover:via-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingUser ? 'Updating...' : 'Save Changes'}
            </button>
            <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
              Cancel
            </button>
          </div>
        </form>
      </EditPopup>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="classy-list-shell rounded-3xl border border-sky-200/80 bg-gradient-to-br from-white via-blue-50 to-sky-100/70 p-5 shadow-panel dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="classy-list-toolbar mb-4 flex flex-wrap gap-2">
          <input
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
            placeholder="Search by name/email/phone"
            className="w-full min-w-[220px] flex-1 rounded-xl border border-sky-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800"
          />
          <select value={filters.role} onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value, page: 1 }))} className="rounded-xl border border-sky-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800">
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))} className="rounded-xl border border-sky-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800">
            <option value="">All status</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {showSocietySelector && (
            <select
              value={filters.societyId}
              onChange={(e) => setSocietyScope(e.target.value)}
              className="rounded-xl border border-sky-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">All societies</option>
              {societies.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          )}
          <button onClick={() => loadUsers(filters)} className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-blue-700 to-cyan-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-300/60 hover:from-blue-600 hover:to-cyan-500"><FiRefreshCw />Refresh</button>
        </div>

        <div className="classy-list-grid space-y-3">
          {!users.length && (
            <p className="classy-list-note rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No users found for the current filters.
            </p>
          )}
          {users.map((u) => (
            <div key={u.id} className="classy-list-card rounded-2xl border border-sky-200 bg-gradient-to-r from-white to-sky-50 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white">{u.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-slate-700">{u.role}</span>
                    <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs text-cyan-800 dark:bg-slate-700">{u.status}</span>
                    <span className="text-xs text-slate-600">{u.email}</span>
                  </div>
                </div>
                <div className="ml-auto flex flex-wrap gap-2">
                  <button onClick={() => onEditUser(u)} className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-md hover:from-cyan-400 hover:to-blue-500">
                    <FiEdit2 />Edit
                  </button>
                  <button
                    onClick={() => doAction(u.id, String(u.status) === 'Active' ? 'deactivate' : 'activate')}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white shadow-md ${
                      String(u.status) === 'Active'
                        ? 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500'
                        : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500'
                    }`}
                  >
                    {String(u.status) === 'Active' ? (
                      <>
                        <FiUserX />Deactivate
                      </>
                    ) : (
                      <>
                        <FiUserCheck />Activate
                      </>
                    )}
                  </button>
                  <button onClick={() => setConfirmDelete({ open: true, userId: u.id })} className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-md hover:from-rose-500 hover:to-red-500">
                    <FiTrash2 />Delete
                  </button>
                  <button
                    onClick={() => doAction(u.id, 'resend-invite')}
                    className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-md hover:from-indigo-500 hover:to-violet-500"
                  >
                    <FiRefreshCw />Resend Invite
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {pagination && (
          <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-wide text-slate-600">
            <span>Page {pagination.page} of {pagination.totalPages || 1}</span>
            <div className="flex gap-2">
              <button disabled={pagination.page <= 1} onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))} className="rounded-lg bg-gradient-to-r from-slate-200 to-slate-300 px-2.5 py-1.5 font-semibold text-slate-700 disabled:opacity-50 dark:bg-slate-700">Prev</button>
              <button disabled={pagination.page >= pagination.totalPages} onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))} className="rounded-lg bg-gradient-to-r from-slate-200 to-slate-300 px-2.5 py-1.5 font-semibold text-slate-700 disabled:opacity-50 dark:bg-slate-700">Next</button>
            </div>
          </div>
        )}
      </motion.section>
      </div>

      <ConfirmModal
        open={confirmDelete.open}
        title="Delete User"
        description="Do you want to delete this user? This is a soft delete and can affect related records."
        confirmLabel="Delete"
        onConfirm={onDeleteUser}
        onCancel={() => setConfirmDelete({ open: false, userId: '' })}
      />
    </div>
  );
}

export default UserManagementPage;

