import { useEffect, useMemo, useState } from 'react';
import {
  FiCheckCircle,
  FiEdit2,
  FiExternalLink,
  FiFilter,
  FiGrid,
  FiImage,
  FiMessageCircle,
  FiPackage,
  FiPhone,
  FiPlusCircle,
  FiRefreshCw,
  FiSearch,
  FiTag,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import AppCard from '../components/ui/AppCard.jsx';
import AppButton from '../components/ui/AppButton.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { appendImageToCsv, readImageAsDataUrl } from '../utils/imageUpload.js';

const CATEGORIES = [
  'Furniture',
  'Electronics',
  'Books',
  'Home Appliances',
  'Toys',
  'Vehicles / Cycle',
  'Miscellaneous',
];

const CONDITIONS = ['New', 'Like New', 'Good', 'Used'];
const STATUSES = ['AVAILABLE', 'RESERVED', 'SOLD'];

const EMPTY_FORM = {
  title: '',
  category: '',
  description: '',
  price: '',
  condition: '',
  imageUrls: '',
  contactNumber: '',
  pickupPreference: '',
};

function parseImageInput(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return [];
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const values = [];
  lines.forEach((line) => {
    if (line.startsWith('data:image/')) {
      values.push(line);
      return;
    }
    line
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => values.push(item));
  });
  return values.slice(0, 5);
}

function formatPrice(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 'INR 0';
  return `INR ${numeric.toLocaleString('en-IN')}`;
}

function formatDate(value) {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString();
}

function ListingStatusBadge({ status }) {
  const normalized = String(status || '').toUpperCase();
  const style =
    normalized === 'SOLD'
      ? 'bg-emerald-100 text-emerald-700'
      : normalized === 'RESERVED'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-cyan-100 text-cyan-700';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>{normalized || 'AVAILABLE'}</span>;
}

function ListingCard({ item, onView, onEdit, onDelete, onMarkSold, onInterest, canModerate }) {
  const image = item.images?.[0] || '';
  const isSold = item.status === 'SOLD';
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="relative h-36 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
        {image ? (
          <a href={image} target="_blank" rel="noreferrer" className="block h-full w-full">
            <img src={image} alt={item.title} className="h-full w-full object-cover" />
          </a>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            <FiImage size={22} />
          </div>
        )}
      </div>
      <div className="mt-2 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</h3>
          <ListingStatusBadge status={item.status} />
        </div>
        <p className="text-sm font-bold text-indigo-600">{formatPrice(item.price)}</p>
        <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{item.description}</p>
        <div className="flex flex-wrap items-center gap-1 pt-0.5 text-[11px] text-slate-500">
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5">{item.category}</span>
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5">{item.condition}</span>
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5">Flat: {item.flatNumber || 'UNASSIGNED'}</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <AppButton type="button" variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => onView(item)}>
          <FiExternalLink size={12} />
          View
        </AppButton>
        {item.isMine ? (
          <>
            <AppButton type="button" variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => onEdit(item)}>
              <FiEdit2 size={12} />
              Edit
            </AppButton>
            {!isSold ? (
              <AppButton type="button" className="px-2.5 py-1 text-xs" onClick={() => onMarkSold(item)}>
                <FiCheckCircle size={12} />
                Mark Sold
              </AppButton>
            ) : null}
            <AppButton type="button" variant="danger" className="px-2.5 py-1 text-xs" onClick={() => onDelete(item)}>
              <FiTrash2 size={12} />
              Delete
            </AppButton>
          </>
        ) : (
          <>
            {!isSold ? (
              <AppButton type="button" className="px-2.5 py-1 text-xs" onClick={() => onInterest(item)}>
                <FiMessageCircle size={12} />
                Interested
              </AppButton>
            ) : null}
            <AppButton type="button" variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => window.open(`tel:${item.contactNumber}`, '_self')}>
              <FiPhone size={12} />
              Contact
            </AppButton>
            {canModerate ? (
              <AppButton type="button" variant="danger" className="px-2.5 py-1 text-xs" onClick={() => onDelete(item)}>
                <FiTrash2 size={12} />
                Remove
              </AppButton>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}

function MarketplacePage() {
  const { apiRequest, admin } = useAuth();
  const { showToast } = useToast();
  const role = String(admin?.role || '').toLowerCase();
  const canCreate = ['super_admin', 'admin', 'committee', 'resident', 'tenant', 'owner'].includes(role);
  const canModerate = ['admin', 'super_admin'].includes(role);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [listings, setListings] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [detailItem, setDetailItem] = useState(null);
  const [deleteState, setDeleteState] = useState({ open: false, item: null });

  async function loadListings() {
    const params = new URLSearchParams();
    params.set('limit', '60');
    if (search.trim()) params.set('search', search.trim());
    if (categoryFilter) params.set('category', categoryFilter);
    if (statusFilter) params.set('status', statusFilter);

    const [allPayload, minePayload] = await Promise.all([
      apiRequest(`/api/marketplace?${params.toString()}`, { raw: true }),
      apiRequest('/api/marketplace/my-listings?limit=60', { raw: true }),
    ]);
    setListings(allPayload?.data || []);
    setMyListings(minePayload?.data || []);
  }

  useEffect(() => {
    async function boot() {
      try {
        setLoading(true);
        await loadListings();
      } catch (err) {
        showToast(err.message || 'Failed to load marketplace listings.', 'error');
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, []);

  const displayed = useMemo(() => (activeTab === 'mine' ? myListings : listings), [activeTab, myListings, listings]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId('');
  }

  async function uploadListingImage(file) {
    if (!file) return;
    try {
      const imageDataUrl = await readImageAsDataUrl(file);
      setForm((prev) => ({ ...prev, imageUrls: appendImageToCsv(prev.imageUrls, imageDataUrl) }));
      showToast('Listing image attached successfully.', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to attach listing image.', 'error');
    }
  }

  async function submitListing(event) {
    event.preventDefault();
    if (!canCreate) return;
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
        price: Number(form.price),
        condition: form.condition,
        images: parseImageInput(form.imageUrls),
        contactNumber: form.contactNumber.trim(),
        pickupPreference: form.pickupPreference.trim(),
      };
      if (!payload.title) return showToast('Product title is required.', 'error');
      if (!payload.category) return showToast('Category is required.', 'error');
      if (!payload.description) return showToast('Description is required.', 'error');
      if (!Number.isFinite(payload.price) || payload.price < 0) return showToast('Price must be valid.', 'error');
      if (!payload.condition) return showToast('Condition is required.', 'error');
      if (!payload.contactNumber) return showToast('Contact number is required.', 'error');

      setSaving(true);
      if (editingId) {
        await apiRequest(`/api/marketplace/${editingId}`, { method: 'PUT', body: payload, raw: true });
        showToast('Listing updated successfully.', 'success');
      } else {
        await apiRequest('/api/marketplace', { method: 'POST', body: payload, raw: true });
        showToast('Listing posted successfully.', 'success');
      }
      resetForm();
      await loadListings();
      setActiveTab('mine');
    } catch (err) {
      showToast(err.message || 'Failed to save listing.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function markSold(item) {
    try {
      await apiRequest(`/api/marketplace/${item._id}/mark-sold`, { method: 'PUT', raw: true });
      showToast('Listing marked as sold.', 'success');
      await loadListings();
    } catch (err) {
      showToast(err.message || 'Failed to mark listing sold.', 'error');
    }
  }

  async function submitDelete() {
    const item = deleteState.item;
    setDeleteState({ open: false, item: null });
    if (!item?._id) return;
    try {
      await apiRequest(`/api/marketplace/${item._id}`, { method: 'DELETE', raw: true });
      showToast('Listing removed successfully.', 'success');
      if (detailItem?._id === item._id) setDetailItem(null);
      await loadListings();
    } catch (err) {
      showToast(err.message || 'Failed to delete listing.', 'error');
    }
  }

  async function markInterested(item) {
    try {
      await apiRequest(`/api/marketplace/${item._id}/interest`, { method: 'POST', body: {}, raw: true });
      showToast('Interest sent to seller.', 'success');
      await loadListings();
    } catch (err) {
      showToast(err.message || 'Failed to send interest.', 'error');
    }
  }

  if (loading) {
    return <AppCard className="text-sm text-slate-600 dark:text-slate-300">Loading marketplace...</AppCard>;
  }

  return (
    <div className="app-fade-up space-y-4">
      <section className="saas-card rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 p-5 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Community Commerce</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Marketplace Listings</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Buy and sell products securely within your society. Listings are visible only to logged-in society users.
        </p>
      </section>

      <div className={canCreate && canModerate ? 'grid gap-4 2xl:grid-cols-[minmax(360px,420px),minmax(0,1fr)] 2xl:items-start' : 'space-y-4'}>
      {canCreate ? (
        <>
        {editingId ? <div className="fixed inset-0 z-[120] bg-slate-900/45 backdrop-blur-[2px]" /> : null}
        <AppCard className={`space-y-3 ${canModerate ? '2xl:sticky 2xl:top-24' : ''} ${editingId ? 'fixed left-1/2 top-1/2 z-[130] w-[min(980px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto max-h-[85vh]' : ''}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{editingId ? 'Edit Listing' : 'Post Item For Sale'}</h2>
              {!editingId ? <p className="mt-0.5 text-xs text-slate-500">Create listing quickly and manage it from board.</p> : null}
            </div>
            {editingId ? (
              <AppButton type="button" variant="secondary" onClick={resetForm}>
                <FiX size={14} />
                Cancel Edit
              </AppButton>
            ) : null}
          </div>
          <form onSubmit={submitListing} className="grid gap-2 md:grid-cols-2">
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="Enter product title"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="Enter price (INR)"
            />
            <select
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Select category</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select
              value={form.condition}
              onChange={(e) => setForm((prev) => ({ ...prev, condition: e.target.value }))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Select condition</option>
              {CONDITIONS.map((condition) => (
                <option key={condition} value={condition}>{condition}</option>
              ))}
            </select>
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className="min-h-24 rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2 dark:border-slate-700 dark:bg-slate-900"
              placeholder="Describe product details, expected usage, and condition."
            />
            <input
              value={form.imageUrls}
              onChange={(e) => setForm((prev) => ({ ...prev, imageUrls: e.target.value }))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="Image URLs (one per line) or upload below"
            />
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <FiImage size={14} />
              Upload listing image
              <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadListingImage(e.target.files?.[0])} />
            </label>
            <input
              value={form.contactNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, contactNumber: e.target.value }))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="Enter contact number"
            />
            <input
              value={form.pickupPreference}
              onChange={(e) => setForm((prev) => ({ ...prev, pickupPreference: e.target.value }))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2 dark:border-slate-700 dark:bg-slate-900"
              placeholder="Pickup preference (optional)"
            />
            <AppButton type="submit" disabled={saving} className="md:w-fit">
              <FiPlusCircle size={14} />
              {saving ? 'Saving...' : editingId ? 'Update Listing' : 'Post Listing'}
            </AppButton>
          </form>
        </AppCard>
        </>
      ) : null}

      <AppCard className={`space-y-3 ${canCreate && canModerate ? 'classy-list-shell min-h-[680px]' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${activeTab === 'all' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              <FiGrid className="mr-1 inline" />
              Marketplace
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('mine')}
              className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${activeTab === 'mine' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              <FiPackage className="mr-1 inline" />
              My Listings
            </button>
            {canModerate ? <span className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Admin Moderation Enabled</span> : null}
          </div>
          <AppButton type="button" variant="secondary" onClick={loadListings}>
            <FiRefreshCw size={14} />
            Refresh
          </AppButton>
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <FiSearch className="pointer-events-none absolute left-3 top-3 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product title, description, flat, seller"
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">All status</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end">
          <AppButton type="button" variant="ghost" onClick={loadListings}>
            <FiFilter size={14} />
            Apply Filters
          </AppButton>
        </div>

        {displayed.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {displayed.map((item) => (
              <ListingCard
                key={item._id}
                item={item}
                canModerate={canModerate}
                onView={setDetailItem}
                onEdit={(row) => {
                  setEditingId(row._id);
                  setForm({
                    title: row.title || '',
                    category: row.category || '',
                    description: row.description || '',
                    price: String(row.price ?? ''),
                    condition: row.condition || '',
                    imageUrls: (row.images || []).join('\n'),
                    contactNumber: row.contactNumber || '',
                    pickupPreference: row.pickupPreference || '',
                  });
                  setActiveTab('mine');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onDelete={(row) => setDeleteState({ open: true, item: row })}
                onMarkSold={markSold}
                onInterest={markInterested}
              />
            ))}
          </div>
        ) : (
          <EmptyState message={activeTab === 'mine' ? 'No products in your listings yet.' : 'No products listed yet.'} />
        )}
      </AppCard>
      </div>

      {detailItem ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/45 p-3">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-indigo-600">Listing Details</p>
                <h3 className="mt-1 text-lg font-semibold">{detailItem.title}</h3>
                <p className="mt-0.5 text-sm text-slate-600">{detailItem.category} - {detailItem.condition}</p>
              </div>
              <button type="button" onClick={() => setDetailItem(null)} className="rounded-lg bg-slate-100 p-1.5 text-slate-600">
                <FiX size={16} />
              </button>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                {detailItem.images?.[0] ? (
                  <a href={detailItem.images[0]} target="_blank" rel="noreferrer" className="block">
                    <img src={detailItem.images[0]} alt={detailItem.title} className="h-52 w-full rounded-lg object-cover" />
                  </a>
                ) : (
                  <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400">
                    <FiImage size={28} />
                  </div>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">Price:</span> {formatPrice(detailItem.price)}</p>
                <p><span className="font-semibold">Status:</span> <ListingStatusBadge status={detailItem.status} /></p>
                <p><span className="font-semibold">Seller:</span> {detailItem.sellerName || '-'}</p>
                <p><span className="font-semibold">Flat:</span> {detailItem.flatNumber || 'UNASSIGNED'}</p>
                <p><span className="font-semibold">Contact:</span> {detailItem.contactNumber || '-'}</p>
                <p><span className="font-semibold">Pickup:</span> {detailItem.pickupPreference || 'Standard pickup'}</p>
                <p><span className="font-semibold">Posted:</span> {formatDate(detailItem.createdAt)}</p>
                <p><span className="font-semibold">Interested Users:</span> {detailItem.interestCount || 0}</p>
              </div>
            </div>

            <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{detailItem.description}</p>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {!detailItem.isMine && detailItem.status !== 'SOLD' ? (
                <AppButton type="button" onClick={() => markInterested(detailItem)}>
                  <FiMessageCircle size={14} />
                  Interested
                </AppButton>
              ) : null}
              <AppButton type="button" variant="ghost" onClick={() => window.open(`tel:${detailItem.contactNumber}`, '_self')}>
                <FiPhone size={14} />
                Contact Seller
              </AppButton>
              <AppButton type="button" variant="secondary" onClick={() => setDetailItem(null)}>
                Close
              </AppButton>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={deleteState.open}
        title="Delete Listing"
        description="Do you want to remove this listing from Society Marketplace?"
        confirmLabel="Delete"
        onCancel={() => setDeleteState({ open: false, item: null })}
        onConfirm={submitDelete}
      />
    </div>
  );
}

export default MarketplacePage;

