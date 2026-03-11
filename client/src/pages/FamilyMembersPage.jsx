import { useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiTrash2, FiUsers, FiHome } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

const INITIAL_FORM = {
  name: '',
  age: '',
  gender: 'Female',
  relation: 'Father',
  phone: '',
};

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function FamilyMembersPage() {
  const { apiRequest, admin } = useAuth();
  const { showToast } = useToast();
  const role = String(admin?.role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const isResidentRole = ['resident', 'tenant', 'owner'].includes(role);
  const isViewerRole = ['admin', 'super_admin', 'committee'].includes(role);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingId, setEditingId] = useState('');
  const [myData, setMyData] = useState({ flat: null, members: [], summary: { totalMembers: 0, children: 0, teens: 0, adults: 0, seniorCitizens: 0 } });
  const [flatRows, setFlatRows] = useState([]);
  const [flatDetails, setFlatDetails] = useState(null);
  const [selectedFlatId, setSelectedFlatId] = useState('');
  const [showFlatList, setShowFlatList] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState('');

  async function loadResidentData() {
    const payload = await apiRequest('/api/family-members/me', { raw: true });
    setMyData(payload?.data || { flat: null, members: [], summary: { totalMembers: 0, children: 0, teens: 0, adults: 0, seniorCitizens: 0 } });
  }

  async function loadAdminData() {
    const payload = await apiRequest('/api/family-members/flats', { raw: true });
    const rows = payload?.data || [];
    setFlatRows(rows);
    if (!selectedFlatId && rows.length) {
      setSelectedFlatId(String(rows[0]._id));
    }
  }

  async function loadFlatDetails(flatId) {
    if (!flatId) return;
    const payload = await apiRequest(`/api/family-members/flats/${encodeURIComponent(flatId)}`, { raw: true });
    setFlatDetails(payload?.data || null);
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        if (isResidentRole) {
          await loadResidentData();
        } else {
          await loadAdminData();
        }
      } catch (err) {
        showToast(err.message || 'Failed to load family members.', 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isResidentRole]);

  useEffect(() => {
    if (!isResidentRole && selectedFlatId) {
      loadFlatDetails(selectedFlatId).catch(() => {});
    }
  }, [isResidentRole, selectedFlatId]);

  const memberSummary = useMemo(() => (isResidentRole ? myData.summary : flatDetails?.summary || { totalMembers: 0, children: 0, teens: 0, adults: 0, seniorCitizens: 0 }), [isResidentRole, myData.summary, flatDetails?.summary]);

  async function submitMember(event) {
    event.preventDefault();
    try {
      const name = String(form.name || '').trim();
      if (!name) {
        showToast('Full name is required.', 'error');
        return;
      }
      const ageNum = Number(form.age);
      if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 130) {
        showToast('Age must be between 0 and 130.', 'error');
        return;
      }
      const phone = String(form.phone || '').trim();
      if (phone) {
        if (/[A-Za-z]/.test(phone)) {
          showToast('Phone number cannot contain alphabets.', 'error');
          return;
        }
        const phoneDigits = phone.replace(/\D+/g, '');
        if (phoneDigits.length !== 10) {
          showToast('Phone number must be exactly 10 digits.', 'error');
          return;
        }
      }
      setSaving(true);
      const body = {
        name,
        age: ageNum,
        gender: form.gender,
        relation: form.relation,
        phone,
      };
      if (editingId) {
        await apiRequest(`/api/family-members/me/${editingId}`, { method: 'PUT', body, raw: true });
        showToast('Family member updated.', 'success');
      } else {
        await apiRequest('/api/family-members/me', { method: 'POST', body, raw: true });
        showToast('Family member added.', 'success');
      }
      setForm(INITIAL_FORM);
      setEditingId('');
      await loadResidentData();
    } catch (err) {
      showToast(err.message || 'Failed to save family member.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row) {
    setEditingId(String(row._id));
    setForm({
      name: row.name || '',
      age: row.age ?? '',
      gender: row.gender || 'Female',
      relation: row.relation || 'Father',
      phone: row.phone || '',
    });
  }

  async function deleteMember(id) {
    try {
      await apiRequest(`/api/family-members/me/${id}`, { method: 'DELETE', raw: true });
      showToast('Family member deleted.', 'success');
      if (editingId === id) {
        setEditingId('');
        setForm(INITIAL_FORM);
      }
      await loadResidentData();
    } catch (err) {
      showToast(err.message || 'Failed to delete family member.', 'error');
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Loading family members...</div>;
  }

  if (!isResidentRole && !isViewerRole) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-800/70 dark:bg-amber-900/20 dark:text-amber-200">
        Family Members module is available for Resident/Tenant/Owner (manage) and Admin/Committee (view).
      </div>
    );
  }

  if (isResidentRole) {
    return (
      <>
        <div className="space-y-5">
          <section className="rounded-3xl border border-cyan-200/70 bg-gradient-to-r from-cyan-50 via-white to-emerald-50 p-5 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-300">My Family Members</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Flat Population Registry</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Flat: <span className="font-semibold">{myData.flat?.flatNumber || '-'}</span>
          </p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Total Members" value={memberSummary.totalMembers || 0} />
          <SummaryCard label="Children" value={memberSummary.children || 0} />
          <SummaryCard label="Teens" value={memberSummary.teens || 0} />
          <SummaryCard label="Adults" value={memberSummary.adults || 0} />
          <SummaryCard label="Senior Citizens" value={memberSummary.seniorCitizens || 0} />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{editingId ? 'Edit Family Member' : 'Add Family Member'}</h3>
          <form onSubmit={submitMember} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Full Name" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
            <input value={form.age} onChange={(e) => setForm((prev) => ({ ...prev, age: e.target.value }))} placeholder="Age" type="number" min="0" max="130" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
            <select value={form.gender} onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            <select value={form.relation} onChange={(e) => setForm((prev) => ({ ...prev, relation: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
              {['Father', 'Mother', 'Son', 'Daughter', 'Grandfather', 'Grandmother', 'Relative', 'Spouse', 'Sibling', 'Other'].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone Number (optional)" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
            <div className="flex items-center gap-2">
              <button type="submit" disabled={saving} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">
                {saving ? 'Saving...' : editingId ? 'Update Member' : 'Add Member'}
              </button>
              {editingId ? (
                <button type="button" onClick={() => { setEditingId(''); setForm(INITIAL_FORM); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Family Members List</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Relation</th>
                  <th className="px-2 py-2">Age</th>
                  <th className="px-2 py-2">Gender</th>
                  <th className="px-2 py-2">Phone</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {myData.members.map((row) => (
                  <tr key={row._id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-2 font-medium text-slate-900 dark:text-white">{row.name}</td>
                    <td className="px-2 py-2 text-slate-700 dark:text-slate-300">{row.relation}</td>
                    <td className="px-2 py-2 text-slate-700 dark:text-slate-300">{row.age}</td>
                    <td className="px-2 py-2 text-slate-700 dark:text-slate-300">{row.gender}</td>
                    <td className="px-2 py-2 text-slate-700 dark:text-slate-300">{row.phone || '-'}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => startEdit(row)} className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 px-2 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50">
                          <FiEdit2 size={12} /> Edit
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(String(row._id))} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                          <FiTrash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!myData.members.length ? <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No family members added yet.</p> : null}
          </div>
          </section>
        </div>
        <ConfirmModal
          open={Boolean(confirmDeleteId)}
          title="Delete Family Member"
          description="Are you sure you want to delete this family member?"
          confirmLabel="Delete"
          onCancel={() => setConfirmDeleteId('')}
          onConfirm={async () => {
            const id = confirmDeleteId;
            setConfirmDeleteId('');
            if (!id) return;
            await deleteMember(id);
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-indigo-200/70 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 p-5 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-700 dark:text-indigo-300">Family Member Registry</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Flat-wise Population View</h2>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr,1.4fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Flats & Total Members</h3>
            <button
              type="button"
              onClick={() => setShowFlatList((prev) => !prev)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {showFlatList ? 'Hide List' : 'Show List'}
            </button>
          </div>
          <div className={`mt-3 overflow-y-auto ${showFlatList ? 'max-h-[58vh]' : 'max-h-0 overflow-hidden'}`}>
            {flatRows.map((row) => (
              <button
                key={row._id}
                type="button"
                onClick={() => setSelectedFlatId(String(row._id))}
                className={`mb-2 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left ${selectedFlatId === String(row._id) ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/20' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40'}`}
              >
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <FiHome size={14} />
                  {row.flatNumber}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-700">
                  <FiUsers size={12} />
                  {row.totalMembers}
                </span>
              </button>
            ))}
            {!flatRows.length ? <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No family member records yet.</p> : null}
          </div>
          {!showFlatList && flatRows.length ? (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">List hidden. Click "Show List" to browse all flats.</p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Flat Details</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {flatDetails?.flatNumber ? `Flat ${flatDetails.flatNumber}` : 'Select a flat to view members'}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="Total" value={memberSummary.totalMembers || 0} />
            <SummaryCard label="Child" value={memberSummary.children || 0} />
            <SummaryCard label="Teen" value={memberSummary.teens || 0} />
            <SummaryCard label="Adult" value={memberSummary.adults || 0} />
            <SummaryCard label="Senior" value={memberSummary.seniorCitizens || 0} />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Relation</th>
                  <th className="px-2 py-2">Age</th>
                  <th className="px-2 py-2">Gender</th>
                  <th className="px-2 py-2">Phone</th>
                </tr>
              </thead>
              <tbody>
                {(flatDetails?.members || []).map((row) => (
                  <tr key={row._id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-2 font-medium text-slate-900 dark:text-white">{row.name}</td>
                    <td className="px-2 py-2 text-slate-700 dark:text-slate-300">{row.relation}</td>
                    <td className="px-2 py-2 text-slate-700 dark:text-slate-300">{row.age}</td>
                    <td className="px-2 py-2 text-slate-700 dark:text-slate-300">{row.gender}</td>
                    <td className="px-2 py-2 text-slate-700 dark:text-slate-300">{row.phone || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {flatDetails && !(flatDetails.members || []).length ? <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No members in this flat.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

export default FamilyMembersPage;
