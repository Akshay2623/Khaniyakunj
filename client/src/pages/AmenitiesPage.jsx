import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCalendar, FiCheck, FiClock, FiMapPin, FiPlus, FiSearch, FiTrash2, FiX } from 'react-icons/fi';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';

const BOOKING_STATUSES = ['Pending', 'Approved', 'Rejected', 'Completed'];

const EMPTY_AMENITY_FORM = {
  name: '',
  description: '',
  location: '',
  capacity: 20,
  pricePerHour: 0,
  openingTime: '06:00',
  closingTime: '22:00',
  bookingRequired: true,
  approvalRequired: false,
  isActive: true,
};

const EMPTY_BOOKING_FORM = {
  amenityId: '',
  bookingDate: '',
  startTime: '10:00',
  endTime: '11:00',
  totalGuests: 1,
  specialRequest: '',
  unitId: '',
};

function formatDateInput(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function formatDateLabel(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
}

function statusBadgeClass(status) {
  if (status === 'Approved') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200';
  if (status === 'Rejected') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200';
  if (status === 'Completed') return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200';
  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200';
}

function AmenityCard({ amenity, canManage, canBook, onEdit, onDelete, onQuickBook, compact = false }) {
  if (compact) {
    return (
      <motion.article
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel transition hover:-translate-y-0.5 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid gap-4 p-4 md:grid-cols-[1.1fr,1fr,auto] md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{amenity.name}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${amenity.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>
                {amenity.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{amenity.description || 'Amenity available for society members.'}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
            <p className="inline-flex items-center gap-1"><FiMapPin />{amenity.location || 'Main Campus'}</p>
            <p>Capacity: {amenity.capacity || '-'}</p>
            <p>Hours: {amenity.openingTime} - {amenity.closingTime}</p>
            <p>INR {Number(amenity.pricePerHour || 0).toFixed(2)}/hour</p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            {canBook && amenity.isActive && (
              <button onClick={() => onQuickBook(amenity)} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                Book This
              </button>
            )}
            {canManage && (
              <>
                <button onClick={() => onEdit(amenity)} className="rounded-xl bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700">Edit</button>
                <button onClick={() => onDelete(amenity)} className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"><FiTrash2 />Delete</button>
              </>
            )}
          </div>
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="h-24 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500" />
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{amenity.name}</h3>
          <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${amenity.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>
            {amenity.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">{amenity.description || 'Amenity available for society members.'}</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
          <p className="inline-flex items-center gap-1"><FiMapPin />{amenity.location || 'Main Campus'}</p>
          <p>Capacity: {amenity.capacity || '-'}</p>
          <p>Hours: {amenity.openingTime} - {amenity.closingTime}</p>
          <p>INR {Number(amenity.pricePerHour || 0).toFixed(2)}/hour</p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {canBook && amenity.isActive && (
            <button onClick={() => onQuickBook(amenity)} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
              Book This
            </button>
          )}
          {canManage && (
            <>
            <button onClick={() => onEdit(amenity)} className="rounded-xl bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700">Edit</button>
            <button onClick={() => onDelete(amenity)} className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"><FiTrash2 />Delete</button>
            </>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function AmenitiesPage() {
  const { apiRequest, admin } = useAuth();
  const { showToast } = useToast();

  const role = admin?.role || '';
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isCommittee = role === 'committee';
  const isGuard = role === 'guard';
  const canFetchUnits = isAdmin || isCommittee;

  const canManageAmenities = isAdmin;
  const canApproveBookings = isAdmin || isCommittee;
  const canBook = !isGuard;

  const [societies, setSocieties] = useState([]);
  const [selectedSocietyId, setSelectedSocietyId] = useState('');
  const showSocietyScope = !isGuard && societies.length > 1;
  const requiresSocietySelection = showSocietyScope && !admin?.societyId;

  const [amenities, setAmenities] = useState([]);
  const [units, setUnits] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [calendarRows, setCalendarRows] = useState([]);
  const [availability, setAvailability] = useState(null);
  const [amenitySearch, setAmenitySearch] = useState('');
  const [amenityStateFilter, setAmenityStateFilter] = useState('all');
  const [amenityView, setAmenityView] = useState('list');

  const [amenityForm, setAmenityForm] = useState(EMPTY_AMENITY_FORM);
  const [editingAmenityId, setEditingAmenityId] = useState('');
  const [showAmenityForm, setShowAmenityForm] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState(EMPTY_BOOKING_FORM);

  const [deleteState, setDeleteState] = useState({ open: false, amenityId: '', amenityName: '' });
  const [loading, setLoading] = useState(true);
  const [societiesReady, setSocietiesReady] = useState(false);

  const scopedSocietyId = selectedSocietyId || admin?.societyId || '';
  const blockedWithoutSociety = requiresSocietySelection && !scopedSocietyId;

  const upcomingBookings = useMemo(() => {
    const today = formatDateInput(new Date());
    return bookings
      .filter((booking) => String(booking.bookingDate || '').slice(0, 10) >= today)
      .slice(0, 8);
  }, [bookings]);

  const filteredAmenities = useMemo(() => {
    return amenities.filter((amenity) => {
      const hay = `${amenity.name || ''} ${amenity.description || ''} ${amenity.location || ''}`.toLowerCase();
      const matchesSearch = hay.includes(amenitySearch.toLowerCase().trim());
      const matchesState = amenityStateFilter === 'all' ? true : amenityStateFilter === 'active' ? amenity.isActive : !amenity.isActive;
      return matchesSearch && matchesState;
    });
  }, [amenities, amenitySearch, amenityStateFilter]);

  function withSociety(params = {}) {
    if (!scopedSocietyId) return params;
    return { ...params, societyId: scopedSocietyId };
  }

  function makeQuery(params = {}) {
    return new URLSearchParams(withSociety(params)).toString();
  }

  async function loadSocieties() {
    if (!isAdmin && !isCommittee) {
      setSocietiesReady(true);
      if (admin?.societyId) {
        setSelectedSocietyId(String(admin.societyId));
      }
      return;
    }
    try {
      const payload = await apiRequest('/api/societies', { raw: true });
      const list = payload.data || [];
      setSocieties(list);
      if (admin?.societyId) {
        setSelectedSocietyId(String(admin.societyId));
        return;
      }
      if (!selectedSocietyId && list.length) {
        setSelectedSocietyId(String(list[0]._id));
      }
    } finally {
      setSocietiesReady(true);
    }
  }

  async function loadAmenities() {
    const query = makeQuery({});
    const list = await apiRequest(`/api/amenities${query ? `?${query}` : ''}`);
    setAmenities(Array.isArray(list) ? list : []);
  }

  async function loadUnits() {
    if (!canFetchUnits) {
      setUnits([]);
      return;
    }
    if (!scopedSocietyId) {
      setUnits([]);
      return;
    }
    const list = await apiRequest(`/api/units?${new URLSearchParams({ societyId: scopedSocietyId }).toString()}`);
    setUnits(Array.isArray(list) ? list : []);
  }

  function getBookingsEndpoint() {
    if (isGuard) return '/api/amenities/today-bookings';
    if (isAdmin) return '/api/amenities/all-bookings';
    if (isCommittee) return '/api/amenities/bookings';
    return '/api/amenities/my-bookings';
  }

  async function loadBookings() {
    const endpoint = getBookingsEndpoint();
    const query = makeQuery({});
    const list = await apiRequest(`${endpoint}${query ? `?${query}` : ''}`);
    setBookings(Array.isArray(list) ? list : []);
  }

  async function loadCalendar() {
    const from = formatDateInput(new Date());
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 30);
    const to = formatDateInput(toDate);
    const query = makeQuery({ from, to });
    const payload = await apiRequest(`/api/amenities/calendar?${query}`);
    setCalendarRows(Array.isArray(payload) ? payload : []);
  }

  async function refreshAll() {
    if (requiresSocietySelection && !scopedSocietyId) return;
    await Promise.all([loadAmenities(), loadUnits(), loadBookings(), loadCalendar()]);
  }

  useEffect(() => {
    loadSocieties().catch((err) => showToast(err.message || 'Failed to load societies.', 'error'));
  }, []);

  useEffect(() => {
    async function bootstrap() {
      if (!societiesReady) return;
      if (requiresSocietySelection && !scopedSocietyId) {
        setLoading(false);
        return;
      }
      if (!scopedSocietyId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        await refreshAll();
      } catch (err) {
        showToast(err.message || 'Failed to load amenities module.', 'error');
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, [scopedSocietyId, role, societiesReady]);

  useEffect(() => {
    const activeAmenityIds = new Set(amenities.filter((item) => item.isActive).map((item) => String(item._id)));
    setBookingForm((prev) => {
      const next = { ...prev };
      if (prev.amenityId && !activeAmenityIds.has(String(prev.amenityId))) {
        next.amenityId = '';
      }
      if (prev.unitId && !units.some((unit) => String(unit._id) === String(prev.unitId))) {
        next.unitId = '';
      }
      return next;
    });
  }, [amenities, units]);

  useEffect(() => {
    async function loadSlotAvailability() {
      if (!scopedSocietyId) {
        setAvailability(null);
        return;
      }
      if (!bookingForm.amenityId || !bookingForm.bookingDate) {
        setAvailability(null);
        return;
      }

      try {
        const query = makeQuery({ amenityId: bookingForm.amenityId, bookingDate: bookingForm.bookingDate });
        const payload = await apiRequest(`/api/amenities/availability?${query}`);
        setAvailability(payload || null);
      } catch (err) {
        setAvailability(null);
        showToast(err.message || 'Failed to fetch availability.', 'error');
      }
    }
    loadSlotAvailability();
  }, [bookingForm.amenityId, bookingForm.bookingDate, scopedSocietyId]);

  function resetAmenityForm() {
    setAmenityForm(EMPTY_AMENITY_FORM);
    setEditingAmenityId('');
    setShowAmenityForm(false);
  }

  function openCreateAmenityModal() {
    setEditingAmenityId('');
    setAmenityForm({ ...EMPTY_AMENITY_FORM });
    setShowAmenityForm(true);
  }

  function closeBookingModal() {
    setShowBookingModal(false);
  }

  function openBookingModal(amenityId = '') {
    setBookingForm((prev) => ({
      ...prev,
      amenityId: amenityId || prev.amenityId || '',
    }));
    setShowBookingModal(true);
  }

  function onEditAmenity(amenity) {
    setShowAmenityForm(true);
    setEditingAmenityId(amenity._id);
    setAmenityForm({
      name: amenity.name || '',
      description: amenity.description || '',
      location: amenity.location || '',
      capacity: amenity.capacity || 1,
      pricePerHour: amenity.pricePerHour || 0,
      openingTime: amenity.openingTime || '06:00',
      closingTime: amenity.closingTime || '22:00',
      bookingRequired: Boolean(amenity.bookingRequired),
      approvalRequired: Boolean(amenity.approvalRequired),
      isActive: Boolean(amenity.isActive),
    });
  }

  async function submitAmenityForm(event) {
    event.preventDefault();
    try {
      const payload = withSociety(amenityForm);
      if (editingAmenityId) {
        await apiRequest(`/api/amenities/${editingAmenityId}`, { method: 'PUT', body: payload, raw: true });
        showToast('Amenity updated successfully.', 'success');
      } else {
        await apiRequest('/api/amenities', { method: 'POST', body: payload, raw: true });
        showToast('Amenity created successfully.', 'success');
      }
      resetAmenityForm();
      await refreshAll();
    } catch (err) {
      showToast(err.message || 'Failed to save amenity.', 'error');
    }
  }

  async function onDeleteAmenity() {
    if (!deleteState.amenityId) return;
    try {
      await apiRequest(`/api/amenities/${deleteState.amenityId}`, { method: 'DELETE', raw: true });
      showToast('Amenity deleted successfully.', 'success');
      setDeleteState({ open: false, amenityId: '', amenityName: '' });
      if (editingAmenityId === deleteState.amenityId) {
        resetAmenityForm();
      }
      await refreshAll();
    } catch (err) {
      showToast(err.message || 'Failed to delete amenity.', 'error');
      setDeleteState({ open: false, amenityId: '', amenityName: '' });
    }
  }

  async function submitBooking(event) {
    event.preventDefault();
    try {
      const payload = withSociety({
        ...bookingForm,
        totalGuests: Number(bookingForm.totalGuests || 1),
        unitId: bookingForm.unitId || undefined,
      });
      const response = await apiRequest('/api/amenities/book', { method: 'POST', body: payload, raw: true });
      showToast(response.message || 'Booking created successfully.', 'success');
      setBookingForm((prev) => ({ ...EMPTY_BOOKING_FORM, amenityId: prev.amenityId || '' }));
      setShowBookingModal(false);
      await refreshAll();
    } catch (err) {
      showToast(err.message || 'Failed to create booking.', 'error');
    }
  }

  async function updateBookingStatus(bookingId, nextStatus) {
    try {
      const endpoint = nextStatus === 'Approved' ? `/api/amenities/approve/${bookingId}` : `/api/amenities/reject/${bookingId}`;
      const payload = await apiRequest(endpoint, { method: 'PUT', raw: true });
      showToast(payload.message || `Booking ${nextStatus.toLowerCase()} successfully.`, 'success');
      await refreshAll();
    } catch (err) {
      showToast(err.message || `Failed to ${nextStatus.toLowerCase()} booking.`, 'error');
    }
  }

  function quickBookAmenity(amenity) {
    setBookingForm((prev) => ({
      ...prev,
      amenityId: amenity._id,
    }));
    setShowBookingModal(true);
    showToast(`${amenity.name} selected for booking.`, 'info');
  }

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading amenities workspace...</p>;
  }

  if (blockedWithoutSociety) {
    return (
      <div className="space-y-5">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-sky-200/70 bg-gradient-to-r from-cyan-50 via-white to-emerald-50 p-5 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800"
        >
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Amenity Operations & Booking</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Select a society to load amenities and bookings.</p>
          <div className="mt-4 max-w-sm">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Society Scope</label>
            <select
              value={selectedSocietyId}
              onChange={(e) => setSelectedSocietyId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Select society</option>
              {societies.map((society) => (
                <option key={society._id} value={society._id}>{society.name}</option>
              ))}
            </select>
          </div>
        </motion.section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-sky-200/70 bg-gradient-to-r from-cyan-50 via-white to-emerald-50 p-5 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800"
      >
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Amenity Operations & Booking</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Dynamic amenity management, live slot availability, and role-based booking workflows.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-cyan-100 px-2.5 py-1 font-semibold text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-200">Admin can create + book amenities</span>
          <span className="rounded-full bg-indigo-100 px-2.5 py-1 font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">Committee can approve/reject</span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">Residents can self-book</span>
        </div>

        {showSocietyScope && (
          <div className="mt-4 max-w-sm">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Society Scope</label>
            <select
              value={selectedSocietyId}
              onChange={(e) => setSelectedSocietyId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Select society</option>
              {societies.map((society) => (
                <option key={society._id} value={society._id}>{society.name}</option>
              ))}
            </select>
          </div>
        )}
      </motion.section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search Amenities</span>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <FiSearch className="text-slate-400" />
              <input
                value={amenitySearch}
                onChange={(e) => setAmenitySearch(e.target.value)}
                placeholder="Search by name, location, description"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Amenity State</span>
            <select value={amenityStateFilter} onChange={(e) => setAmenityStateFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
        {!isGuard && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/50">
              <button
                type="button"
                onClick={() => setAmenityView('list')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${amenityView === 'list' ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-900 dark:text-cyan-300' : 'text-slate-600 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-slate-700'}`}
              >
                List View
              </button>
              <button
                type="button"
                onClick={() => setAmenityView('grid')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${amenityView === 'grid' ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-900 dark:text-cyan-300' : 'text-slate-600 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-slate-700'}`}
              >
                Grid View
              </button>
            </div>
            <div className="flex items-center gap-2">
              {canBook && (
                <button
                  type="button"
                  onClick={() => openBookingModal()}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700/40 dark:bg-emerald-900/30 dark:text-emerald-200"
                >
                  <FiCalendar />
                  Book Amenity
                </button>
              )}
              {canManageAmenities && (
                <button
                  type="button"
                  onClick={openCreateAmenityModal}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white hover:from-cyan-700 hover:to-teal-700"
                >
                  <FiPlus />
                  Add Amenity
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="classy-list-shell rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-slate-900">
        <div className="classy-list-toolbar mb-3 flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-lg font-semibold text-slate-900 dark:text-white">Amenities Listing</h3>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{filteredAmenities.length} items</span>
        </div>
        <div className={amenityView === 'list' ? 'classy-list-grid space-y-3' : 'classy-list-grid grid gap-4 lg:grid-cols-3'}>
          {filteredAmenities.map((amenity) => (
            <AmenityCard
              key={amenity._id}
              amenity={amenity}
              canManage={canManageAmenities}
              canBook={canBook}
              onEdit={onEditAmenity}
              onDelete={(item) => setDeleteState({ open: true, amenityId: item._id, amenityName: item.name })}
              onQuickBook={quickBookAmenity}
              compact={amenityView === 'list'}
            />
          ))}
          {!filteredAmenities.length && (
            <div className="classy-list-note rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              No amenities found for current filters. {canManageAmenities ? 'Create your first amenity below.' : ''}
            </div>
          )}
        </div>
      </section>

      {canManageAmenities && showAmenityForm && typeof document !== 'undefined' && createPortal(
          <>
          <div className="fixed inset-0 z-[1000] bg-slate-900/45 backdrop-blur-[2px]" onClick={resetAmenityForm} />
          <div className="fixed inset-0 z-[1001] overflow-y-auto p-3 md:p-5">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto flex min-h-[min-content] w-full max-w-[960px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{editingAmenityId ? 'Edit Amenity' : 'Add Amenity'}</h3>
              <button onClick={resetAmenityForm} className="rounded-lg bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">Close</button>
            </div>
            <form onSubmit={submitAmenityForm} className="flex min-h-0 flex-1 flex-col">
              <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto px-5 py-4 md:grid-cols-2">
              <input value={amenityForm.name} onChange={(e) => setAmenityForm((p) => ({ ...p, name: e.target.value }))} placeholder="Enter amenity name" required className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              <input value={amenityForm.location} onChange={(e) => setAmenityForm((p) => ({ ...p, location: e.target.value }))} placeholder="Enter amenity location" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              <textarea value={amenityForm.description} onChange={(e) => setAmenityForm((p) => ({ ...p, description: e.target.value }))} placeholder="Enter amenity description" className="md:col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" rows={3} />
              <input type="number" min="1" value={amenityForm.capacity} onChange={(e) => setAmenityForm((p) => ({ ...p, capacity: Number(e.target.value || 1) }))} placeholder="Enter amenity capacity" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              <input type="number" min="0" step="0.01" value={amenityForm.pricePerHour} onChange={(e) => setAmenityForm((p) => ({ ...p, pricePerHour: Number(e.target.value || 0) }))} placeholder="Enter price per hour (INR)" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              <input type="time" value={amenityForm.openingTime} onChange={(e) => setAmenityForm((p) => ({ ...p, openingTime: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              <input type="time" value={amenityForm.closingTime} onChange={(e) => setAmenityForm((p) => ({ ...p, closingTime: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />

              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                <input type="checkbox" checked={amenityForm.bookingRequired} onChange={(e) => setAmenityForm((p) => ({ ...p, bookingRequired: e.target.checked }))} />
                Booking Required
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                <input type="checkbox" checked={amenityForm.approvalRequired} onChange={(e) => setAmenityForm((p) => ({ ...p, approvalRequired: e.target.checked }))} />
                Approval Required
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 md:col-span-2">
                <input type="checkbox" checked={amenityForm.isActive} onChange={(e) => setAmenityForm((p) => ({ ...p, isActive: e.target.checked }))} />
                Amenity Active
              </label>
              </div>
              <div className="border-t border-slate-200 px-5 py-3 dark:border-slate-700">
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:from-cyan-700 hover:to-teal-700">
                  <FiPlus />{editingAmenityId ? 'Update Amenity' : 'Create Amenity'}
                </button>
              </div>
            </form>
          </motion.section>
          </div>
          </>
        , document.body)}

      {canBook && showBookingModal && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[1000] bg-slate-900/45 backdrop-blur-[2px]" onClick={closeBookingModal} />
          <div className="fixed inset-0 z-[1001] overflow-y-auto p-3 md:p-5">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto flex w-full max-w-[920px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Book Amenity</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Double-booking is blocked automatically.</p>
              </div>
              <button onClick={closeBookingModal} className="rounded-lg bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                Close
              </button>
            </div>

            <form onSubmit={submitBooking} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <select value={bookingForm.amenityId} onChange={(e) => setBookingForm((p) => ({ ...p, amenityId: e.target.value }))} required className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                    <option value="">Select amenity</option>
                    {amenities.filter((item) => item.isActive).map((amenity) => (
                      <option key={amenity._id} value={amenity._id}>{amenity.name}</option>
                    ))}
                  </select>
                  <input type="date" value={bookingForm.bookingDate} onChange={(e) => setBookingForm((p) => ({ ...p, bookingDate: e.target.value }))} min={formatDateInput(new Date())} required className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
                  <input type="time" value={bookingForm.startTime} onChange={(e) => setBookingForm((p) => ({ ...p, startTime: e.target.value }))} required className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
                  <input type="time" value={bookingForm.endTime} onChange={(e) => setBookingForm((p) => ({ ...p, endTime: e.target.value }))} required className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
                  <input type="number" min="1" value={bookingForm.totalGuests} onChange={(e) => setBookingForm((p) => ({ ...p, totalGuests: Number(e.target.value || 1) }))} placeholder="Enter total guests count" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
                  <select value={bookingForm.unitId} onChange={(e) => setBookingForm((p) => ({ ...p, unitId: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                    <option value="">Select unit (optional)</option>
                    {units.map((unit) => <option key={unit._id} value={unit._id}>{unit.unitNumber}</option>)}
                  </select>
                  <textarea value={bookingForm.specialRequest} onChange={(e) => setBookingForm((p) => ({ ...p, specialRequest: e.target.value }))} placeholder="Enter special request (optional)" rows={3} className="md:col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Availability Slots</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <select
                      value={bookingForm.amenityId}
                      onChange={(e) => setBookingForm((p) => ({ ...p, amenityId: e.target.value }))}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="">Select amenity</option>
                      {amenities.filter((item) => item.isActive).map((amenity) => (
                        <option key={`availability-${amenity._id}`} value={amenity._id}>
                          {amenity.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={bookingForm.bookingDate}
                      onChange={(e) => setBookingForm((p) => ({ ...p, bookingDate: e.target.value }))}
                      min={formatDateInput(new Date())}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  {!availability?.slots?.length ? (
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Select amenity and date to view available slots.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {availability.slots.map((slot) => (
                        <span
                          key={`${slot.startTime}-${slot.endTime}`}
                          className={`rounded-lg px-2 py-1 text-xs font-medium ${slot.isAvailable ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'}`}
                        >
                          {slot.startTime} - {slot.endTime}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-200 px-5 py-3 dark:border-slate-700">
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:from-emerald-700 hover:to-teal-700">
                  <FiCalendar />Book Now
                </button>
              </div>
            </form>
          </motion.section>
          </div>
        </>
      , document.body)}

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Bookings</h3>
          <button onClick={refreshAll} className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">Refresh</button>
        </div>

        {!bookings.length ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No bookings found for your role scope.</p>
        ) : (
          <div className="space-y-2">
            {bookings.map((booking) => (
              <div key={booking._id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900 dark:text-white">{booking.amenityId?.name || 'Amenity'}</p>
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(booking.bookingStatus)}`}>{booking.bookingStatus}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{formatDateLabel(booking.bookingDate)} {booking.startTime} - {booking.endTime}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Guests: {booking.totalGuests}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">By: {booking.userId?.name || '-'}</span>

                  {canApproveBookings && booking.bookingStatus === 'Pending' && (
                    <div className="ml-auto flex gap-2">
                      <button onClick={() => updateBookingStatus(booking._id, 'Approved')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"><FiCheck />Approve</button>
                      <button onClick={() => updateBookingStatus(booking._id, 'Rejected')} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"><FiX />Reject</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      <section className="grid gap-5 xl:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-slate-900"
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Upcoming Bookings</h3>
          <div className="mt-3 space-y-2">
            {upcomingBookings.map((item) => (
              <div key={item._id} className="rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700">
                <p className="font-medium text-slate-900 dark:text-white">{item.amenityId?.name || 'Amenity'} | {formatDateLabel(item.bookingDate)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.startTime} - {item.endTime} | {item.userId?.name || '-'}</p>
              </div>
            ))}
            {!upcomingBookings.length && <p className="text-sm text-slate-500 dark:text-slate-400">No upcoming bookings.</p>}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-slate-900"
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Calendar Feed (30 days)</h3>
          <div className="mt-3 space-y-2 max-h-80 overflow-auto pr-1">
            {calendarRows.map((item) => (
              <div key={item.bookingId} className="rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700">
                <p className="font-medium text-slate-900 dark:text-white">{formatDateLabel(item.date)} | {item.amenityName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1"><FiClock />{item.startTime} - {item.endTime}</p>
                <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(item.bookingStatus)}`}>{item.bookingStatus}</span>
              </div>
            ))}
            {!calendarRows.length && <p className="text-sm text-slate-500 dark:text-slate-400">No calendar records for the selected range.</p>}
          </div>
        </motion.section>
      </section>

      <ConfirmModal
        open={deleteState.open}
        title="Delete Amenity"
        description={`Delete ${deleteState.amenityName}? Existing bookings will remain for audit.`}
        confirmLabel="Delete"
        onConfirm={onDeleteAmenity}
        onCancel={() => setDeleteState({ open: false, amenityId: '', amenityName: '' })}
      />
    </div>
  );
}

export default AmenitiesPage;

