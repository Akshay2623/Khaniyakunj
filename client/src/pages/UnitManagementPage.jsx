import { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiEdit2, FiHome, FiPlusCircle, FiRefreshCw, FiUserCheck, FiUserX } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

const UNIT_TYPES = ['1BHK', '2BHK', '3BHK', 'Villa', 'Other'];
const UNIT_STATUSES = ['VACANT', 'OCCUPIED', 'INACTIVE'];

const EMPTY_FORM = {
  wing: '',
  flatNumber: '',
  floor: 0,
  unitType: '2BHK',
  status: 'VACANT',
};

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function UnitManagementPage() {
  const { apiRequest } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState({ totalUnits: 0, occupiedUnits: 0, vacantUnits: 0, inactiveUnits: 0 });
  const [units, setUnits] = useState([]);
  const [residents, setResidents] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [editingUnitId, setEditingUnitId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const [assignState, setAssignState] = useState({ open: false, unitId: '', residentId: '' });
  const [vacateState, setVacateState] = useState({ open: false, unitId: '' });

  async function loadResidents() {
    const payload = await apiRequest('/api/users?role=resident&limit=500', { raw: true });
    setResidents(payload?.data || []);
  }

  async function loadUnits() {
    const query = new URLSearchParams();
    if (search.trim()) query.set('search', search.trim());
    if (statusFilter) query.set('status', statusFilter);
    const payload = await apiRequest(`/api/units${query.toString() ? `?${query.toString()}` : ''}`, { raw: true });
    setUnits(payload?.data || []);
  }

  async function loadSummary() {
    const payload = await apiRequest('/api/units/summary', { raw: true });
    setSummary(payload?.data || { totalUnits: 0, occupiedUnits: 0, vacantUnits: 0, inactiveUnits: 0 });
  }

  async function loadAll() {
    try {
      setLoading(true);
      await Promise.all([loadSummary(), loadUnits(), loadResidents()]);
    } catch (err) {
      showToast(err.message || 'Failed to load unit management data.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadUnits().catch((err) => showToast(err.message || 'Failed to load units.', 'error'));
  }, [search, statusFilter]);

  const visibleResidents = useMemo(() => {
    return residents.filter((row) => String(row.status || '').toLowerCase() === 'active');
  }, [residents]);

  function beginEdit(unit) {
    setEditingUnitId(String(unit._id));
    setForm({
      wing: unit.wing || '',
      flatNumber: unit.flatNumber || unit.unitNumber || '',
      floor: Number(unit.floor ?? unit.floorNumber ?? 0),
      unitType: unit.unitType || '2BHK',
      status: unit.status || 'VACANT',
    });
  }

  function resetForm() {
    setEditingUnitId('');
    setForm(EMPTY_FORM);
  }

  async function submitUnit(event) {
    event.preventDefault();
    try {
      setSaving(true);
      const body = {
        wing: String(form.wing || '').trim().toUpperCase(),
        flatNumber: String(form.flatNumber || '').trim().toUpperCase(),
        floor: Number(form.floor || 0),
        unitType: form.unitType,
        status: form.status,
      };
      if (!body.flatNumber) {
        showToast('Flat number is required.', 'error');
        return;
      }
      if (!Number.isFinite(body.floor) || body.floor < 0) {
        showToast('Floor must be 0 or greater.', 'error');
        return;
      }

      if (editingUnitId) {
        await apiRequest(`/api/units/${editingUnitId}`, { method: 'PUT', body, raw: true });
        showToast('Unit updated successfully.', 'success');
      } else {
        await apiRequest('/api/units', { method: 'POST', body, raw: true });
        showToast('Unit created successfully.', 'success');
      }
      resetForm();
      await Promise.all([loadSummary(), loadUnits()]);
    } catch (err) {
      showToast(err.message || 'Failed to save unit.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function assignResident() {
    try {
      if (!assignState.unitId || !assignState.residentId) return;
      await apiRequest(`/api/units/${assignState.unitId}/assign`, {
        method: 'PUT',
        body: { residentId: assignState.residentId },
        raw: true,
      });
      setAssignState({ open: false, unitId: '', residentId: '' });
      showToast('Resident assigned successfully.', 'success');
      await Promise.all([loadSummary(), loadUnits()]);
    } catch (err) {
      showToast(err.message || 'Failed to assign resident.', 'error');
    }
  }

  async function vacateUnit() {
    try {
      if (!vacateState.unitId) return;
      await apiRequest(`/api/units/${vacateState.unitId}/vacate`, { method: 'PUT', raw: true });
      setVacateState({ open: false, unitId: '' });
      showToast('Unit marked as vacant.', 'success');
      await Promise.all([loadSummary(), loadUnits()]);
    } catch (err) {
      showToast(err.message || 'Failed to mark unit vacant.', 'error');
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading unit management...</p>;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-cyan-200/70 bg-gradient-to-r from-cyan-50 via-white to-emerald-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">Admin Panel</p>
        <h2 className="mt-1 text-3xl font-semibold text-slate-900">Unit Management</h2>
        <p className="mt-1 text-sm text-slate-600">Master inventory of flats/units, occupancy status, and resident assignment.</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Units" value={summary.totalUnits || 0} />
        <SummaryCard label="Occupied" value={summary.occupiedUnits || 0} />
        <SummaryCard label="Vacant" value={summary.vacantUnits || 0} />
        <SummaryCard label="Inactive" value={summary.inactiveUnits || 0} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
        <h3 className="text-lg font-semibold text-slate-900">{editingUnitId ? 'Edit Unit' : 'Create Unit'}</h3>
        <form onSubmit={submitUnit} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input value={form.wing} onChange={(e) => setForm((prev) => ({ ...prev, wing: e.target.value }))} placeholder="Wing / Tower" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          <input value={form.flatNumber} onChange={(e) => setForm((prev) => ({ ...prev, flatNumber: e.target.value }))} placeholder="Flat Number" required className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          <input type="number" min="0" value={form.floor} onChange={(e) => setForm((prev) => ({ ...prev, floor: e.target.value }))} placeholder="Floor" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          <select value={form.unitType} onChange={(e) => setForm((prev) => ({ ...prev, unitType: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            {UNIT_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            {UNIT_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <div className="md:col-span-2 xl:col-span-5 flex flex-wrap gap-2">
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">
              <FiPlusCircle />
              {saving ? 'Saving...' : editingUnitId ? 'Update Unit' : 'Create Unit'}
            </button>
            {editingUnitId && (
              <button type="button" onClick={resetForm} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search wing/flat" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">All status</option>
            {UNIT_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <button onClick={loadAll} className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            <FiRefreshCw /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                <th className="px-2 py-2">Wing</th>
                <th className="px-2 py-2">Flat</th>
                <th className="px-2 py-2">Floor</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Assigned Resident</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit._id} className="border-b border-slate-100">
                  <td className="px-2 py-2">{unit.wing || '-'}</td>
                  <td className="px-2 py-2 font-semibold text-slate-900">{unit.flatNumber || unit.unitNumber}</td>
                  <td className="px-2 py-2">{unit.floorNumber ?? unit.floor ?? 0}</td>
                  <td className="px-2 py-2">{unit.unitType || '-'}</td>
                  <td className="px-2 py-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${String(unit.status || '').toUpperCase() === 'OCCUPIED' ? 'bg-emerald-100 text-emerald-700' : String(unit.status || '').toUpperCase() === 'INACTIVE' ? 'bg-slate-200 text-slate-700' : 'bg-cyan-100 text-cyan-700'}`}>
                      {unit.status || 'VACANT'}
                    </span>
                  </td>
                  <td className="px-2 py-2">{unit.assignedResident?.name || '-'}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => beginEdit(unit)} className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-2 py-1 text-xs font-semibold text-white">
                        <FiEdit2 size={12} /> Edit
                      </button>
                      {String(unit.status || '').toUpperCase() !== 'OCCUPIED' ? (
                        <button
                          type="button"
                          onClick={() => setAssignState({ open: true, unitId: unit._id, residentId: '' })}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white"
                        >
                          <FiUserCheck size={12} /> Assign Resident
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setVacateState({ open: true, unitId: unit._id })}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-1 text-xs font-semibold text-white"
                        >
                          <FiUserX size={12} /> Mark Vacant
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!units.length ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No units found.</div>
          ) : null}
        </div>
      </section>

      <ConfirmModal
        open={assignState.open}
        title="Assign Resident"
        description={
          <div className="space-y-2 text-sm">
            <p>Select a resident to assign to this unit.</p>
            <select
              value={assignState.residentId}
              onChange={(e) => setAssignState((prev) => ({ ...prev, residentId: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            >
              <option value="">Select resident</option>
              {visibleResidents.map((row) => (
                <option key={row.id} value={row.id}>{row.name} ({row.email})</option>
              ))}
            </select>
          </div>
        }
        confirmLabel="Assign"
        onCancel={() => setAssignState({ open: false, unitId: '', residentId: '' })}
        onConfirm={assignResident}
      />

      <ConfirmModal
        open={vacateState.open}
        title="Mark Unit Vacant"
        description="Do you want to mark this unit as vacant and clear resident assignment?"
        confirmLabel="Mark Vacant"
        onCancel={() => setVacateState({ open: false, unitId: '' })}
        onConfirm={vacateUnit}
      />
    </div>
  );
}

export default UnitManagementPage;
