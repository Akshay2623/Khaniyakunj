import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiEdit2,
  FiGrid,
  FiHome,
  FiMail,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUserPlus,
  FiUsers,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

const RESIDENT_ROLE_OPTIONS = [
  { value: 'resident', label: 'Resident' },
  { value: 'tenant', label: 'Tenant' },
];

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  role: 'resident',
  unitId: '',
};

function normalizePhone(value = '') {
  return String(value).replace(/\D+/g, '');
}

function ResidentsPage() {
  const { apiRequest, admin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const role = admin?.role || '';
  const canManage = role === 'admin' || role === 'super_admin';

  const [societies, setSocieties] = useState([]);
  const [selectedSocietyId, setSelectedSocietyId] = useState('');
  const [residents, setResidents] = useState([]);
  const [units, setUnits] = useState([]);
  const [unitSearch, setUnitSearch] = useState('');
  const showSocietySelector = societies.length > 1;

  const [loading, setLoading] = useState(true);
  const [residentLoading, setResidentLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pagination, setPagination] = useState(null);

  const [editingResidentId, setEditingResidentId] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState({ page: 1, limit: 8 });
  const [occupancyFilter, setOccupancyFilter] = useState('all');
  const [blockFilter, setBlockFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: '' });
  const [showResidentList, setShowResidentList] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);

  const canSubmit = useMemo(
    () =>
      canManage &&
      selectedSocietyId &&
      form.name.trim() &&
      form.email.trim() &&
      form.phone.trim() &&
      form.role &&
      form.unitId,
    [canManage, selectedSocietyId, form]
  );

  const blockOptions = useMemo(() => {
    const unique = Array.from(new Set(residents.map((resident) => (resident.block || '').trim()).filter(Boolean)));
    return unique.sort((a, b) => a.localeCompare(b));
  }, [residents]);

  const stats = useMemo(() => {
    const residentHeads = residents.filter(
      (resident) => String(resident.linkedRole || resident.occupancyType || '').toLowerCase() !== 'tenant'
    ).length;
    const tenants = residents.filter(
      (resident) => String(resident.linkedRole || resident.occupancyType || '').toLowerCase() === 'tenant'
    ).length;
    const uniqueBlocks = new Set(
      residents.map((resident) => (resident.block || '').trim().toLowerCase()).filter(Boolean)
    ).size;

    return {
      totalOnPage: residents.length,
      totalAcrossPages: pagination?.total || residents.length,
      residentHeads,
      tenants,
      uniqueBlocks,
    };
  }, [residents, pagination]);

  const blockInsights = useMemo(() => {
    const map = new Map();
    residents.forEach((resident) => {
      const block = (resident.block || 'N/A').trim() || 'N/A';
      map.set(block, (map.get(block) || 0) + 1);
    });

    const list = Array.from(map.entries())
      .map(([block, count]) => ({ block, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const max = list[0]?.count || 1;
    return list.map((item) => ({ ...item, pct: Math.round((item.count / max) * 100) }));
  }, [residents]);

  const visibleResidents = useMemo(() => {
    let list = [...residents];

    if (occupancyFilter !== 'all') {
      list = list.filter((resident) => String(resident.occupancyType || '').toLowerCase() === occupancyFilter);
    }

    if (blockFilter !== 'all') {
      list = list.filter((resident) => String(resident.block || '').toLowerCase() === blockFilter.toLowerCase());
    }

    if (sortBy === 'name-asc') {
      list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    } else if (sortBy === 'flat-asc') {
      list.sort((a, b) => String(a.flatNumber || '').localeCompare(String(b.flatNumber || '')));
    }

    return list;
  }, [residents, occupancyFilter, blockFilter, sortBy]);

  const selectedUnit = useMemo(
    () => units.find((unit) => String(unit._id) === String(form.unitId)) || null,
    [units, form.unitId]
  );

  const vacantUnits = useMemo(() => {
    const selectedResident = editingResidentId
      ? residents.find((row) => String(row._id) === String(editingResidentId))
      : null;
    const selectedResidentUserId = selectedResident?.userId ? String(selectedResident.userId) : null;

    return units.filter((unit) => {
      const status = String(unit.status || '').toUpperCase();
      const assignedId = String(unit.assignedResidentId || '');
      if (status === 'VACANT') return true;
      if (!selectedResidentUserId) return false;
      return assignedId && assignedId === selectedResidentUserId;
    });
  }, [units, editingResidentId, residents]);

  const filteredUnits = useMemo(() => {
    const key = unitSearch.trim().toLowerCase();
    if (!key) return vacantUnits;
    return vacantUnits.filter((unit) => {
      const label = [
        unit.unitNumber || unit.flatNumber || '',
        unit.wing || '',
        unit.unitType || '',
        unit.status || '',
      ]
        .join(' ')
        .toLowerCase();
      return label.includes(key);
    });
  }, [vacantUnits, unitSearch]);

  async function loadSocieties() {
    try {
      setLoading(true);
      setError('');
      const payload = await apiRequest('/api/societies?limit=100', { raw: true });
      const data = payload.data || [];
      setSocieties(data);

      if (!data.length) {
        setSelectedSocietyId('');
      } else if (!selectedSocietyId || !data.some((x) => x._id === selectedSocietyId)) {
        setSelectedSocietyId(data[0]._id);
      }
    } catch (err) {
      const message = err.message || 'Failed to load societies.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadResidents(nextQuery = query, nextSearch = search) {
    if (!selectedSocietyId) {
      setResidents([]);
      setPagination(null);
      return;
    }

    try {
      setResidentLoading(true);
      setError('');
      const params = new URLSearchParams();
      params.set('societyId', selectedSocietyId);
      params.set('page', String(nextQuery.page));
      params.set('limit', String(nextQuery.limit));
      if (nextSearch.trim()) params.set('search', nextSearch.trim());

      const payload = await apiRequest(`/api/residents?${params.toString()}`, { raw: true });
      setResidents(payload.data || []);
      setPagination(payload.pagination || null);
    } catch (err) {
      const message = err.message || 'Failed to load residents.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setResidentLoading(false);
    }
  }

  async function loadUnits() {
    if (!selectedSocietyId) {
      setUnits([]);
      return;
    }

    try {
      const params = new URLSearchParams();
      params.set('societyId', selectedSocietyId);
      const list = await apiRequest(`/api/units?${params.toString()}`);
      setUnits(Array.isArray(list) ? list : []);
    } catch (err) {
      setUnits([]);
      showToast(err.message || 'Failed to load units.', 'error');
    }
  }

  useEffect(() => {
    loadSocieties();
  }, []);

  useEffect(() => {
    if (!selectedSocietyId) return;
    setQuery((prev) => ({ ...prev, page: 1 }));
    setForm(EMPTY_FORM);
    setEditingResidentId('');
    loadResidents({ ...query, page: 1 }, search);
    loadUnits();
  }, [selectedSocietyId]);

  useEffect(() => {
    if (!selectedSocietyId) return;
    const handle = setTimeout(() => {
      loadResidents(query, search);
    }, 250);
    return () => clearTimeout(handle);
  }, [query.page, query.limit, search]);

  function onChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    const normalizedPhone = normalizePhone(form.phone);
    if (normalizedPhone.length !== 10) {
      showToast('Phone number must be exactly 10 digits.', 'error');
      return;
    }

    const endpoint = editingResidentId ? `/api/residents/${editingResidentId}` : '/api/admin/residents/create';
    const method = editingResidentId ? 'PUT' : 'POST';

    try {
      setError('');
      setSuccess('');
      const payload = await apiRequest(endpoint, {
        method,
        body: {
          societyId: selectedSocietyId,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: normalizedPhone,
          role: form.role,
          unitId: form.unitId,
          occupancyType: form.role === 'tenant' ? 'tenant' : 'owner',
        },
        raw: true,
      });

      setEditingResidentId('');
      setForm(EMPTY_FORM);
      setUnitSearch('');
      const msg = payload?.message || (method === 'POST'
        ? 'Resident account created and unit assigned successfully.'
        : 'Resident updated successfully.');
      setSuccess(msg);
      showToast(msg, 'success');
      await Promise.all([loadResidents(), loadUnits()]);
    } catch (err) {
      const message = err.message || 'Failed to save resident.';
      setError(message);
      showToast(message, 'error');
    }
  }

  function editResident(resident) {
    setEditingResidentId(resident._id);
    setForm({
      name: resident.name || '',
      email: resident.email || '',
      phone: resident.phone || '',
      role: String(resident.linkedRole || resident.occupancyType || '').toLowerCase() === 'tenant' ? 'tenant' : 'resident',
      unitId: resident.unitId ? String(resident.unitId) : '',
    });
    setUnitSearch('');
  }

  function cancelEdit() {
    setEditingResidentId('');
    setForm(EMPTY_FORM);
    setUnitSearch('');
  }

  async function deleteResident() {
    try {
      const id = confirmDelete.id;
      if (!id) return;
      setError('');
      setSuccess('');
      await apiRequest(`/api/residents/${id}`, { method: 'DELETE' });
      await Promise.all([loadResidents(), loadUnits()]);
      if (editingResidentId === id) cancelEdit();
      setConfirmDelete({ open: false, id: '' });
      setSuccess('Resident deleted successfully.');
      showToast('Resident deleted successfully.', 'success');
    } catch (err) {
      const message = err.message || 'Failed to delete resident.';
      setError(message);
      showToast(message, 'error');
      setConfirmDelete({ open: false, id: '' });
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading resident workspace...</p>;
  }

  return (
    <div className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-cyan-200/70 bg-gradient-to-br from-cyan-100 via-white to-emerald-100 p-6 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800"
      >
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-300/20 blur-2xl" />
        <div className="absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-emerald-300/20 blur-2xl" />

        <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-700 dark:text-cyan-300">Resident Workspace</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Resident Control Center</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Create resident heads with live unit assignment and occupancy-safe onboarding.</p>
          </div>
          <button
            onClick={() => {
              loadResidents();
              loadUnits();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
          >
            <FiRefreshCw />Refresh
          </button>
          {canManage ? (
            <button
              onClick={() => navigate('/app/family-members')}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500"
            >
              <FiUsers />View Family Data
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/80">
            <p className="text-xs uppercase tracking-wider text-slate-500">Total Residents</p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white"><FiUsers className="text-cyan-600" /> {stats.totalAcrossPages}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/80">
            <p className="text-xs uppercase tracking-wider text-slate-500">Resident Heads (Page)</p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white"><FiHome className="text-emerald-600" /> {stats.residentHeads}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/80">
            <p className="text-xs uppercase tracking-wider text-slate-500">Tenants (Page)</p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white"><FiUsers className="text-indigo-600" /> {stats.tenants}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/80">
            <p className="text-xs uppercase tracking-wider text-slate-500">Blocks (Page)</p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white"><FiGrid className="text-amber-600" /> {stats.uniqueBlocks}</p>
          </div>
        </div>
      </motion.section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {showSocietySelector ? (
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Society</span>
              <select
                value={selectedSocietyId}
                onChange={(event) => setSelectedSocietyId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {societies.map((society) => (
                  <option key={society._id} value={society._id}>{society.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Society: {societies[0]?.name || 'Default Society'}
            </div>
          )}

          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search</span>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <FiSearch className="text-slate-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setQuery((prev) => ({ ...prev, page: 1 }));
                }}
                placeholder="Search by name or flat"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Occupancy</span>
            <select value={occupancyFilter} onChange={(e) => setOccupancyFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
              <option value="all">All</option>
              <option value="owner">Owner</option>
              <option value="tenant">Tenant</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Block</span>
            <select value={blockFilter} onChange={(e) => setBlockFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
              <option value="all">All blocks</option>
              {blockOptions.map((block) => (
                <option key={block} value={block}>{block}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-5">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel xl:col-span-2 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{editingResidentId ? 'Update Resident' : 'Create Resident + Assign Unit'}</h3>
            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-200">
              {canManage ? 'Editable' : 'Read Only'}
            </span>
          </div>

          {societies.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Add a society first.</p>
          ) : canManage ? (
            <form className="space-y-3" onSubmit={onSubmit}>
              <div className="grid gap-3">
                <input name="name" value={form.name} onChange={onChange} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Resident Name" required />
                <input type="email" name="email" value={form.email} onChange={onChange} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Resident Email" required />
                <input name="phone" value={form.phone} onChange={onChange} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Phone (10 digits)" required />
                <select name="role" value={form.role} onChange={onChange} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">
                  {RESIDENT_ROLE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>

                <input
                  value={unitSearch}
                  onChange={(e) => setUnitSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  placeholder="Search available units"
                />
                <select
                  name="unitId"
                  value={form.unitId}
                  onChange={onChange}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                >
                  <option value="">Select available unit</option>
                  {filteredUnits.map((unit) => {
                    const label = `${unit.unitNumber || unit.flatNumber} | ${unit.wing || 'NA'} | ${unit.unitType || 'Other'} | ${String(unit.status || '').toUpperCase()}`;
                    return (
                      <option key={unit._id} value={unit._id}>{label}</option>
                    );
                  })}
                </select>
              </div>

              {selectedUnit ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-900/20 dark:text-emerald-100">
                  <p className="font-semibold">Selected Unit</p>
                  <p className="mt-1">Flat: {selectedUnit.unitNumber || selectedUnit.flatNumber || '-'}</p>
                  <p>Wing: {selectedUnit.wing || '-'}</p>
                  <p>Type: {selectedUnit.unitType || '-'}</p>
                  <p>Status: {String(selectedUnit.status || 'VACANT').toUpperCase()}</p>
                </div>
              ) : null}

              <div className="flex gap-2">
                <button type="submit" disabled={!canSubmit} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  <FiUserPlus />{editingResidentId ? 'Update Resident' : 'Create Resident'}
                </button>
                {editingResidentId && (
                  <button type="button" onClick={cancelEdit} className="rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          ) : (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Your role has read-only resident access.</p>
          )}

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top Blocks (Current Page)</p>
            <div className="mt-2 space-y-2">
              {blockInsights.map((item) => (
                <div key={item.block}>
                  <div className="mb-1 flex justify-between text-xs text-slate-600 dark:text-slate-300">
                    <span>{item.block}</span>
                    <span>{item.count}</span>
                  </div>
                  <div className="h-2 rounded bg-slate-200 dark:bg-slate-700">
                    <div className="h-2 rounded bg-gradient-to-r from-cyan-500 to-emerald-500" style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
              {!blockInsights.length && <p className="text-xs text-slate-500 dark:text-slate-400">No block insights yet.</p>}
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel xl:col-span-3 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-lg font-semibold text-slate-900 dark:text-white">Resident Directory</h2>
            <button
              type="button"
              onClick={() => setShowResidentList((prev) => !prev)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {showResidentList ? 'Hide List' : 'Show List'}
            </button>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
              <option value="newest">Newest</option>
              <option value="name-asc">Name A-Z</option>
              <option value="flat-asc">Flat A-Z</option>
            </select>
          </div>

          {!showResidentList ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">List hidden. Click "Show List" to view resident records.</p>
          ) : residentLoading ? (
            <div className="space-y-2">
              <div className="h-20 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-20 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-20 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            </div>
          ) : visibleResidents.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No residents found for current filters.</p>
          ) : (
            <>
              <ul className="mt-2 grid gap-3 md:grid-cols-2">
                {visibleResidents.map((resident) => (
                  <li key={resident._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-cyan-300 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{resident.name}</h3>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          <FiHome className="mr-1 inline-block text-slate-400" />
                          Flat {resident.flatNumber || '-'} | Block {resident.block || '-'}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          <FiGrid className="mr-1 inline-block text-slate-400" />
                          Assigned Unit: {resident.assignedUnit?.unitNumber || resident.flatNumber || '-'}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          <FiPhone className="mr-1 inline-block text-slate-400" />
                          {resident.phone || '-'}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          <FiMail className="mr-1 inline-block text-slate-400" />
                          {resident.email || '-'}
                        </p>
                        <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${String(resident.occupancyType || '').toLowerCase() === 'owner' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200'}`}>
                          {resident.occupancyType || 'resident'}
                        </span>
                      </div>

                      {canManage && (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => editResident(resident)} className="rounded-lg bg-slate-200 p-2 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            <FiEdit2 size={14} />
                          </button>
                          <button type="button" onClick={() => setConfirmDelete({ open: true, id: resident._id })} className="rounded-lg bg-rose-100 p-2 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {pagination && (
                <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <span>Page {pagination.page} of {pagination.totalPages || 1} | Total {pagination.total}</span>
                  <div className="flex gap-2">
                    <button
                      disabled={pagination.page <= 1}
                      onClick={() => setQuery((prev) => ({ ...prev, page: prev.page - 1 }))}
                      className="rounded bg-slate-200 px-2 py-1 disabled:opacity-50 dark:bg-slate-700"
                    >
                      Prev
                    </button>
                    <button
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setQuery((prev) => ({ ...prev, page: prev.page + 1 }))}
                      className="rounded bg-slate-200 px-2 py-1 disabled:opacity-50 dark:bg-slate-700"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.section>
      </div>

      {success && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">{success}</p>}
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">{error}</p>}

      <ConfirmModal
        open={confirmDelete.open}
        title="Delete Resident"
        description="This will permanently remove the resident record. Continue?"
        confirmLabel="Delete"
        onConfirm={deleteResident}
        onCancel={() => setConfirmDelete({ open: false, id: '' })}
      />
    </div>
  );
}

export default ResidentsPage;
