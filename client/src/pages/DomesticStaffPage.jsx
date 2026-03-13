import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiClock, FiCopy, FiImage, FiKey, FiPhone, FiRefreshCw, FiSearch, FiShield, FiTruck, FiUploadCloud, FiUserPlus, FiXCircle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import EditPopup from '../components/EditPopup.jsx';
import { readImageAsDataUrl } from '../utils/imageUpload.js';

const WORK_TYPES = ['maid', 'cook', 'driver', 'nanny', 'other'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function DomesticStaffPage() {
  const { admin, apiRequest } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const role = String(admin?.role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const isResident = role.includes('tenant') || role.includes('owner') || role.includes('resident');
  const isGuard = role.includes('guard') || role.includes('security');
  const isAdmin = role === 'admin' || role === 'super_admin';

  const [loading, setLoading] = useState(false);

  const [staffList, setStaffList] = useState([]);
  const [entryLogs, setEntryLogs] = useState([]);
  const [activeEntries, setActiveEntries] = useState([]);

  const [attendanceStaffId, setAttendanceStaffId] = useState('');
  const [attendanceLogs, setAttendanceLogs] = useState([]);

  const [editingId, setEditingId] = useState('');
  const [residentSearch, setResidentSearch] = useState('');
  const [residentStatusFilter, setResidentStatusFilter] = useState('all');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    photo: '',
    workType: 'maid',
    houseNumber: '',
    workingDays: [],
    expectedEntryTime: '',
    expectedExitTime: '',
  });

  const [guardPhone, setGuardPhone] = useState('');
  const [guardOtp, setGuardOtp] = useState('');
  const [verifiedStaff, setVerifiedStaff] = useState(null);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpPanel, setOtpPanel] = useState(null);

  async function loadResidentData() {
    const payload = await apiRequest('/api/domestic-staff/staff/my', { raw: true });
    setStaffList(payload.data || []);
  }

  async function loadAdminData() {
    const [staffPayload, logsPayload] = await Promise.all([
      apiRequest('/api/domestic-staff/staff', { raw: true }),
      apiRequest('/api/domestic-staff/logs', { raw: true }),
    ]);
    setStaffList(staffPayload.data || []);
    setEntryLogs(logsPayload.data || []);
  }

  async function loadGuardData() {
    const payload = await apiRequest('/api/domestic-staff/entry/active', { raw: true });
    setActiveEntries(payload.data || []);
  }

  async function loadData() {
    try {
      setLoading(true);
      if (isResident) await loadResidentData();
      if (isAdmin) await loadAdminData();
      if (isGuard) await loadGuardData();
    } catch (err) {
      showToast(err.message || 'Failed to load domestic staff data.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [role]);

  useEffect(() => {
    if (otpCooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  function resetForm() {
    setEditingId('');
    setForm({
      name: '',
      phone: '',
      photo: '',
      workType: 'maid',
      houseNumber: '',
      workingDays: [],
      expectedEntryTime: '',
      expectedExitTime: '',
    });
  }

  async function uploadStaffPhoto(file) {
    if (!file) return;
    try {
      const imageDataUrl = await readImageAsDataUrl(file);
      setForm((prev) => ({ ...prev, photo: imageDataUrl }));
      showToast('Photo attached successfully.', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to attach photo.', 'error');
    }
  }

  async function submitStaff(event) {
    event.preventDefault();
    try {
      if (/[A-Za-z]/.test(String(form.phone || ''))) {
        showToast('Phone number cannot contain alphabets.', 'error');
        return;
      }
      const phoneDigits = String(form.phone || '').replace(/\D+/g, '');
      if (phoneDigits.length !== 10) {
        showToast('Phone number must be exactly 10 digits.', 'error');
        return;
      }
      const payload = {
        name: form.name,
        phone: form.phone,
        photo: form.photo,
        workType: form.workType,
        houseNumber: form.houseNumber,
        workingDays: form.workingDays,
        expectedEntryTime: form.expectedEntryTime,
        expectedExitTime: form.expectedExitTime,
      };
      if (editingId) {
        await apiRequest(`/api/domestic-staff/staff/${editingId}`, { method: 'PUT', body: payload, raw: true });
        showToast('Domestic staff updated.', 'success');
      } else {
        await apiRequest('/api/domestic-staff/staff', { method: 'POST', body: payload, raw: true });
        showToast('Domestic staff registered.', 'success');
      }
      resetForm();
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to save staff.', 'error');
    }
  }

  async function deleteStaff(id) {
    try {
      await apiRequest(`/api/domestic-staff/staff/${id}`, { method: 'DELETE', raw: true });
      showToast('Domestic staff removed.', 'success');
      if (attendanceStaffId === id) {
        setAttendanceStaffId('');
        setAttendanceLogs([]);
      }
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to remove staff.', 'error');
    }
  }

  function startEdit(item) {
    setEditingId(item._id);
    setForm({
      name: item.name || '',
      phone: item.phone || '',
      photo: item.photo || '',
      workType: item.workType || 'maid',
      houseNumber: item.houseNumber || '',
      workingDays: item.workingDays || [],
      expectedEntryTime: item.expectedEntryTime || '',
      expectedExitTime: item.expectedExitTime || '',
    });
  }

  async function loadAttendance(staffId) {
    try {
      const payload = await apiRequest(`/api/domestic-staff/staff/${staffId}/logs`, { raw: true });
      setAttendanceStaffId(staffId);
      setAttendanceLogs(payload.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to load attendance history.', 'error');
    }
  }

  async function requestOtp() {
    if (/[A-Za-z]/.test(String(guardPhone || ''))) {
      showToast('Phone number cannot contain alphabets.', 'error');
      return;
    }
    const normalizedPhone = String(guardPhone || '').replace(/\D+/g, '');
    if (normalizedPhone.length !== 10) {
      showToast('Enter a valid staff phone number.', 'error');
      return;
    }
    if (otpCooldown > 0 || otpBusy) return;
    try {
      setOtpBusy(true);
      const payload = await apiRequest('/api/domestic-staff/otp/request', {
        method: 'POST',
        body: { phone: normalizedPhone },
        raw: true,
      });
      setOtpCooldown(60);
      setOtpPanel({
        phone: payload?.data?.phone || normalizedPhone,
        otp: payload?.data?.devOtp || '',
      });
      showToast('OTP sent.', 'success');
      setVerifiedStaff(null);
    } catch (err) {
      showToast(err.message || 'Failed to request OTP.', 'error');
    } finally {
      setOtpBusy(false);
    }
  }

  async function verifyOtp() {
    if (/[A-Za-z]/.test(String(guardPhone || ''))) {
      showToast('Phone number cannot contain alphabets.', 'error');
      return;
    }
    const normalizedPhone = String(guardPhone || '').replace(/\D+/g, '');
    if (normalizedPhone.length !== 10) {
      showToast('Enter a valid staff phone number.', 'error');
      return;
    }
    try {
      const payload = await apiRequest('/api/domestic-staff/otp/verify', {
        method: 'POST',
        body: { phone: normalizedPhone, otp: guardOtp },
        raw: true,
      });
      setVerifiedStaff(payload.data || null);
      setOtpPanel(null);
      setOtpCooldown(0);
      showToast('OTP verified. Entry can be marked.', 'success');
    } catch (err) {
      showToast(err.message || 'OTP verification failed.', 'error');
    }
  }

  async function markEntry() {
    if (!verifiedStaff?.staffId) return;
    try {
      await apiRequest('/api/domestic-staff/entry', {
        method: 'POST',
        body: { staffId: verifiedStaff.staffId },
        raw: true,
      });
      showToast('Entry marked successfully.', 'success');
      setGuardPhone('');
      setGuardOtp('');
      setVerifiedStaff(null);
      setOtpPanel(null);
      setOtpCooldown(0);
      await loadGuardData();
    } catch (err) {
      showToast(err.message || 'Failed to mark entry.', 'error');
    }
  }

  async function markExit(logId) {
    try {
      await apiRequest(`/api/domestic-staff/entry/${logId}/exit`, { method: 'PUT', raw: true });
      showToast('Exit marked successfully.', 'success');
      await loadGuardData();
    } catch (err) {
      showToast(err.message || 'Failed to mark exit.', 'error');
    }
  }

  async function updateStaffStatus(id, status) {
    try {
      await apiRequest(`/api/domestic-staff/staff/${id}/status`, {
        method: 'PUT',
        body: { status },
        raw: true,
      });
      showToast('Staff status updated.', 'success');
      await loadAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to update status.', 'error');
    }
  }

  const selectedAttendanceName = useMemo(
    () => staffList.find((s) => s._id === attendanceStaffId)?.name || '',
    [attendanceStaffId, staffList]
  );
  const filteredResidentStaff = useMemo(() => {
    if (!isResident) return staffList;
    const needle = residentSearch.trim().toLowerCase();
    return staffList.filter((item) => {
      const haystack = `${item.name || ''} ${item.workType || ''} ${item.phone || ''} ${item.houseNumber || ''}`.toLowerCase();
      const matchesSearch = !needle || haystack.includes(needle);
      const normalizedStatus = String(item.status || '').toLowerCase();
      const matchesStatus = residentStatusFilter === 'all' ? true : normalizedStatus === residentStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [isResident, residentSearch, residentStatusFilter, staffList]);

  return (
    <div className="space-y-5">
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-white to-emerald-50 p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-700">Domestic Staff</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">Domestic Staff Management</h2>
          </div>
          <button onClick={loadData} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </motion.section>

      {isResident && (
        <>
          <div className="grid gap-5 2xl:grid-cols-[390px,1fr] 2xl:items-start">
            <section className="2xl:sticky 2xl:top-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <FiUserPlus />
                    Register Staff
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">Add domestic helpers with timing and working-day schedule.</p>
                </div>
                <span className="rounded-full bg-cyan-50 px-2 py-1 text-[11px] font-semibold text-cyan-700">{staffList.length} total</span>
              </div>
              <form onSubmit={submitStaff} className="mt-4 grid gap-3 md:grid-cols-2">
                <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required placeholder="Staff full name" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} required placeholder="Staff phone number" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-600">
                  <FiUploadCloud />
                  Upload staff photo (optional)
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadStaffPhoto(e.target.files?.[0])} />
                </label>
                <select value={form.workType} onChange={(e) => setForm((prev) => ({ ...prev, workType: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                  {WORK_TYPES.map((workType) => (
                    <option key={workType} value={workType}>{workType}</option>
                  ))}
                </select>
                <input value={form.houseNumber} onChange={(e) => setForm((prev) => ({ ...prev, houseNumber: e.target.value }))} required placeholder="Assigned house/flat number" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                <div className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Working Days</p>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((day) => (
                      <label key={day} className="inline-flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={form.workingDays.includes(day)}
                          onChange={(e) => {
                            setForm((prev) => ({
                              ...prev,
                              workingDays: e.target.checked
                                ? [...prev.workingDays, day]
                                : prev.workingDays.filter((d) => d !== day),
                            }));
                          }}
                        />
                        {day}
                      </label>
                    ))}
                  </div>
                </div>
                <input type="time" value={form.expectedEntryTime} onChange={(e) => setForm((prev) => ({ ...prev, expectedEntryTime: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                <input type="time" value={form.expectedExitTime} onChange={(e) => setForm((prev) => ({ ...prev, expectedExitTime: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                {form.photo ? (
                  <a href={form.photo} target="_blank" rel="noreferrer" className="md:col-span-2 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                    <FiImage size={12} /> View uploaded photo
                  </a>
                ) : null}
                <div className="md:col-span-2 flex gap-2">
                  <button className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700">
                    Add Staff
                  </button>
                </div>
              </form>
            </section>

            <section className="classy-list-shell rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <div className="classy-list-toolbar mb-3 flex flex-wrap items-center gap-2">
                <h3 className="mr-auto text-lg font-semibold text-slate-900">Staff List</h3>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <FiSearch className="text-slate-400" />
                  <input
                    value={residentSearch}
                    onChange={(e) => setResidentSearch(e.target.value)}
                    placeholder="Search by name, phone, type, house"
                    className="w-48 bg-transparent text-sm outline-none"
                  />
                </div>
                <select
                  value={residentStatusFilter}
                  onChange={(e) => setResidentStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">All status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="blocked">Blocked</option>
                </select>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{filteredResidentStaff.length} shown</span>
              </div>
              <div className="classy-list-grid mt-3 grid gap-3 lg:grid-cols-2">
                {filteredResidentStaff.map((item) => (
                  <article key={item._id} className="classy-list-card rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{item.name} ({item.workType})</p>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${String(item.status || '').toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>{item.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Phone: {item.phone} | House: {item.houseNumber}</p>
                    {item.photo ? (
                      <a href={item.photo} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200">
                        <FiImage size={11} /> View photo
                      </a>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">Days: {(item.workingDays || []).join(', ') || '-'}</p>
                    <p className="mt-1 text-xs text-slate-500">Expected: {item.expectedEntryTime || '-'} to {item.expectedExitTime || '-'}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button onClick={() => startEdit(item)} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white">Edit</button>
                      <button onClick={() => deleteStaff(item._id)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">Remove</button>
                      <button onClick={() => loadAttendance(item._id)} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white">Attendance History</button>
                    </div>
                  </article>
                ))}
                {!filteredResidentStaff.length && <p className="text-sm text-slate-500">No staff matched your filters.</p>}
              </div>
            </section>

            {attendanceStaffId && (
              <section className="classy-list-shell rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
                <h3 className="text-lg font-semibold text-slate-900">Attendance History: {selectedAttendanceName}</h3>
                <div className="classy-list-grid mt-3 space-y-2">
                  {attendanceLogs.map((row) => (
                    <div key={row._id} className="classy-list-card rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                      <p>Date: {row.date}</p>
                      <p>Entry: {row.entryTime ? new Date(row.entryTime).toLocaleString() : '-'}</p>
                      <p>Exit: {row.exitTime ? new Date(row.exitTime).toLocaleString() : '-'}</p>
                      <p>Guard: {row.guardId?.name || '-'}</p>
                    </div>
                  ))}
                  {!attendanceLogs.length && <p className="text-sm text-slate-500">No attendance records yet.</p>}
                </div>
              </section>
            )}
          </div>
        </>
      )}

      {isGuard && (
        <>
          <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900"><FiTruck /> Delivery Prompt</h3>
                <p className="mt-1 text-sm text-slate-600">For Swiggy/Zomato/Amazon OTP flow, go to Gate Management Deliveries tab.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/app/visitor-management?tab=deliveries')}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
              >
                Open Deliveries Tab
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-white to-emerald-50 p-5 text-slate-900 shadow-panel">
            <h3 className="inline-flex items-center gap-2 text-lg font-semibold"><FiShield /> Domestic Staff Entry</h3>
            <p className="mt-1 text-sm text-slate-600">Secure gate verification with one-time passcode</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <input
                value={guardPhone}
                onChange={(e) => setGuardPhone(e.target.value)}
                placeholder="Enter staff phone number"
                disabled={otpCooldown > 0}
                className="rounded-xl border border-cyan-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 disabled:opacity-70"
              />
              <button
                onClick={requestOtp}
                disabled={otpBusy || otpCooldown > 0 || String(guardPhone || '').replace(/\D+/g, '').length < 7}
                className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {otpBusy ? 'Sending...' : otpCooldown > 0 ? `OTP Sent (${otpCooldown}s)` : 'Send OTP'}
              </button>
              <input
                value={guardOtp}
                onChange={(e) => setGuardOtp(e.target.value)}
                placeholder="Enter OTP code"
                className="rounded-xl border border-cyan-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={verifyOtp} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Verify OTP</button>
              {otpCooldown > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setOtpCooldown(0);
                    setOtpPanel(null);
                  }}
                  className="rounded-xl border border-cyan-300 px-4 py-2.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100"
                >
                  Reset OTP Session
                </button>
              )}
            </div>

            {otpPanel?.otp && (
              <div className="mt-4 rounded-2xl border border-cyan-300 bg-cyan-50 p-3">
                <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-700">
                  <FiKey />
                  Gate OTP Preview
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="font-mono text-3xl font-bold tracking-[0.45em] text-cyan-700">{otpPanel.otp}</p>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(String(otpPanel.otp));
                      showToast('OTP copied.', 'success');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-cyan-300 px-2 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100"
                  >
                    <FiCopy size={12} />
                    Copy
                  </button>
                </div>
                <p className="mt-1 text-xs text-cyan-700">Phone: {otpPanel.phone}</p>
              </div>
            )}
            {verifiedStaff && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="font-semibold text-emerald-800">{verifiedStaff.name}</p>
                <p className="text-sm text-emerald-700">Work Type: {verifiedStaff.workType}</p>
                <p className="text-sm text-emerald-700">House Number: {verifiedStaff.houseNumber}</p>
                <button onClick={markEntry} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
                  <FiCheckCircle />
                  Mark Entry
                </button>
              </div>
            )}
          </section>

          <section className="classy-list-shell rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
            <div className="classy-list-toolbar mb-3 flex flex-wrap items-center gap-2">
              <h3 className="mr-auto inline-flex items-center gap-2 text-lg font-semibold text-slate-900"><FiClock /> Active Entries</h3>
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{activeEntries.length} inside</span>
            </div>
            <div className="classy-list-grid mt-3 space-y-2">
              {activeEntries.map((row) => (
                <div key={row._id} className="classy-list-card rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="font-semibold text-slate-900">{row.staffId?.name || '-'}</p>
                  <p className="text-xs text-slate-500">Phone: {row.staffId?.phone || '-'}</p>
                  <p className="text-xs text-slate-500">Work: {row.staffId?.workType || '-'}</p>
                  <p className="text-xs text-slate-500">House: {row.houseNumber}</p>
                  <p className="text-xs text-slate-500">Entry: {row.entryTime ? new Date(row.entryTime).toLocaleString() : '-'}</p>
                  <button onClick={() => markExit(row._id)} className="mt-2 inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">
                    <FiXCircle />
                    Mark Exit
                  </button>
                </div>
              ))}
              {!activeEntries.length && <p className="text-sm text-slate-500">No active staff entries.</p>}
            </div>
          </section>
        </>
      )}

      {isAdmin && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
            <h3 className="text-lg font-semibold text-slate-900">All Registered Staff</h3>
            <div className="mt-3 space-y-2">
              {staffList.map((item) => (
                <div key={item._id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{item.name} ({item.workType})</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={item.status} onChange={(e) => updateStaffStatus(item._id, e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs">
                        <option value="active">active</option>
                        <option value="blocked">blocked</option>
                        <option value="inactive">inactive</option>
                      </select>
                      <button type="button" onClick={() => startEdit(item)} className="rounded-lg bg-cyan-600 px-2.5 py-1 text-xs font-semibold text-white">
                        Edit
                      </button>
                      <button type="button" onClick={() => deleteStaff(item._id)} className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white">
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">Resident: {item.residentId?.name || '-'} | House: {item.houseNumber}</p>
                  <p className="text-xs text-slate-500"><FiPhone className="mr-1 inline" />{item.phone}</p>
                  {item.photo ? (
                    <a href={item.photo} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200">
                      <FiImage size={11} /> View photo
                    </a>
                  ) : null}
                </div>
              ))}
              {!staffList.length && <p className="text-sm text-slate-500">No staff records found.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
            <h3 className="text-lg font-semibold text-slate-900">Staff Entry Logs</h3>
            <div className="mt-3 space-y-2">
              {entryLogs.map((log) => (
                <div key={log._id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-semibold text-slate-900">{log.staffId?.name || '-'} ({log.staffId?.workType || '-'})</p>
                  <p className="text-xs text-slate-500">House: {log.houseNumber} | Resident: {log.residentId?.name || '-'}</p>
                  <p className="text-xs text-slate-500">Entry: {log.entryTime ? new Date(log.entryTime).toLocaleString() : '-'}</p>
                  <p className="text-xs text-slate-500">Exit: {log.exitTime ? new Date(log.exitTime).toLocaleString() : '-'}</p>
                  <p className="text-xs text-slate-500">Guard: {log.guardId?.name || '-'}</p>
                </div>
              ))}
              {!entryLogs.length && <p className="text-sm text-slate-500">No entry logs yet.</p>}
            </div>
          </section>
        </>
      )}

      <EditPopup open={Boolean(editingId)} title="Edit Staff" onClose={resetForm} maxWidthClass="max-w-3xl">
        <form onSubmit={submitStaff} className="grid gap-3 md:grid-cols-2">
          <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required placeholder="Staff full name" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} required placeholder="Staff phone number" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-600">
            <FiUploadCloud />
            Upload staff photo (optional)
            <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadStaffPhoto(e.target.files?.[0])} />
          </label>
          <select value={form.workType} onChange={(e) => setForm((prev) => ({ ...prev, workType: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            {WORK_TYPES.map((workType) => (
              <option key={workType} value={workType}>{workType}</option>
            ))}
          </select>
          <input value={form.houseNumber} onChange={(e) => setForm((prev) => ({ ...prev, houseNumber: e.target.value }))} required placeholder="Assigned house/flat number" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          <div className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Working Days</p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <label key={day} className="inline-flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={form.workingDays.includes(day)}
                    onChange={(e) => {
                      setForm((prev) => ({
                        ...prev,
                        workingDays: e.target.checked
                          ? [...prev.workingDays, day]
                          : prev.workingDays.filter((d) => d !== day),
                      }));
                    }}
                  />
                  {day}
                </label>
              ))}
            </div>
          </div>
          <input type="time" value={form.expectedEntryTime} onChange={(e) => setForm((prev) => ({ ...prev, expectedEntryTime: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          <input type="time" value={form.expectedExitTime} onChange={(e) => setForm((prev) => ({ ...prev, expectedExitTime: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          {form.photo ? (
            <a href={form.photo} target="_blank" rel="noreferrer" className="md:col-span-2 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200">
              <FiImage size={12} /> View uploaded photo
            </a>
          ) : null}
          <div className="md:col-span-2 flex gap-2">
            <button className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700">
              Update Staff
            </button>
            <button type="button" onClick={resetForm} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">
              Cancel
            </button>
          </div>
        </form>
      </EditPopup>
    </div>
  );
}

export default DomesticStaffPage;


