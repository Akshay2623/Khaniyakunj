import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiFilter, FiImage, FiMapPin, FiPackage, FiPlusCircle, FiRefreshCw, FiUploadCloud, FiX } from 'react-icons/fi';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { readImageAsDataUrl } from '../utils/imageUpload.js';

const STATUS_STYLE = {
  FOUND: 'bg-amber-100 text-amber-700',
  CLAIMED: 'bg-emerald-100 text-emerald-700',
};

function StatusBadge({ status }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLE[status] || 'bg-slate-100 text-slate-700'}`}>{status}</span>;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
}

function resolveImageSource(value) {
  const source = String(value || '').trim();
  if (!source) return '';
  if (source.startsWith('data:image/')) return source;
  if (source.startsWith('http://') || source.startsWith('https://')) return source;
  if (source.startsWith('{') || source.startsWith('[')) {
    try {
      const parsed = JSON.parse(source);
      if (parsed && typeof parsed === 'object') {
        const candidates = [
          parsed.url,
          parsed.secure_url,
          parsed.image,
          parsed.src,
          parsed.fileUrl,
          parsed.path,
        ];
        const match = candidates.find((item) => typeof item === 'string' && (item.startsWith('data:image/') || item.startsWith('http://') || item.startsWith('https://')));
        if (match) return match;
      }
    } catch {
      return '';
    }
  }
  return '';
}

function LostFoundPage() {
  const { admin, apiRequest } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = String(admin?.role || '').toLowerCase();

  const isGuard = role === 'guard';
  const canClaim = ['tenant', 'owner', 'resident', 'admin', 'committee', 'super_admin'].includes(role);
  const canClose = role === 'guard';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [withPhotoOnly, setWithPhotoOnly] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const [form, setForm] = useState({
    itemName: '',
    description: '',
    locationFound: '',
    dateFound: '',
    image: '',
    notes: '',
  });

  async function loadLostItems() {
    try {
      setLoading(true);
      const query = statusFilter ? `?status=${statusFilter}` : '';
      const payload = await apiRequest(`/api/lost-items${query}`, { raw: true });
      setItems(payload.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to fetch lost items.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLostItems();
  }, [statusFilter]);

  useEffect(() => {
    const itemFromQuery = searchParams.get('item');
    if (itemFromQuery) {
      setSelectedItemId(itemFromQuery);
    }
  }, [searchParams]);

  async function onUploadImage(file) {
    if (!file) return;
    try {
      const imageDataUrl = await readImageAsDataUrl(file);
      setForm((prev) => ({ ...prev, image: imageDataUrl }));
      showToast('Photo attached successfully.', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to attach photo.', 'error');
    }
  }

  async function postLostItem(event) {
    event.preventDefault();
    if (!form.itemName.trim() || !form.locationFound.trim() || !form.dateFound) {
      showToast('Item name, location and date found are required.', 'error');
      return;
    }
    try {
      setSaving(true);
      await apiRequest('/api/lost-items', {
        method: 'POST',
        body: {
          itemName: form.itemName.trim(),
          description: form.description.trim(),
          locationFound: form.locationFound.trim(),
          dateFound: form.dateFound,
          image: form.image,
          notes: form.notes.trim(),
        },
        raw: true,
      });
      showToast('Lost item posted successfully.', 'success');
      setForm({
        itemName: '',
        description: '',
        locationFound: '',
        dateFound: '',
        image: '',
        notes: '',
      });
      setSelectedItemId('');
      await loadLostItems();
    } catch (err) {
      showToast(err.message || 'Failed to post lost item.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function claimItem(itemId) {
    try {
      await apiRequest(`/api/lost-items/${itemId}/claim`, { method: 'PUT', raw: true });
      showToast('Claim request submitted.', 'success');
      await loadLostItems();
    } catch (err) {
      showToast(err.message || 'Failed to claim item.', 'error');
    }
  }

  async function closeItem(item) {
    try {
      await apiRequest(`/api/lost-items/${item._id}/close`, {
        method: 'PUT',
        body: {
          claimedBy: item.claimedBy?._id || item.claimedBy || null,
        },
        raw: true,
      });
      showToast('Item marked as claimed.', 'success');
      await loadLostItems();
    } catch (err) {
      showToast(err.message || 'Failed to close item.', 'error');
    }
  }

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = items.filter((item) =>
      [item.itemName, item.description, item.locationFound, item.notes]
        .join(' ')
        .toLowerCase()
        .includes(q || '')
    );
    const photoFiltered = withPhotoOnly ? base.filter((item) => Boolean(resolveImageSource(item.image))) : base;
    return photoFiltered;
  }, [items, search, withPhotoOnly]);

  function clearPostForm() {
    setForm({
      itemName: '',
      description: '',
      locationFound: '',
      dateFound: '',
      image: '',
      notes: '',
    });
  }

  function clearAllFilters() {
    setSearch('');
    setStatusFilter('');
    setWithPhotoOnly(false);
    setSelectedItemId('');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('item');
      return next;
    });
  }

  function openImagePreview(source) {
    const safe = resolveImageSource(source);
    if (!safe) {
      showToast('Image source is invalid or missing.', 'error');
      return;
    }
    setPreviewImage(safe);
  }

  return (
    <div className="relative space-y-5">
      <div className="pointer-events-none absolute -top-8 left-8 h-36 w-36 rounded-full bg-emerald-200/45 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-16 h-28 w-28 rounded-full bg-sky-200/45 blur-3xl" />
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-sky-50 p-5 shadow-panel">
        <motion.div
          aria-hidden
          animate={{ x: [0, 22, 0], y: [0, -10, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute -right-10 -top-8 h-28 w-28 rounded-full bg-emerald-300/30 blur-2xl"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Lost & Found</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">Lost & Found Item Management</h2>
            <p className="mt-1 text-sm text-slate-600">Track found items with photos, claim flow, and live updates.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setWithPhotoOnly((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ring-1 ${withPhotoOnly ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'}`}
            >
              <FiImage />
              {withPhotoOnly ? 'Photos: ON' : 'With Photos'}
            </button>
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <FiX />
              Reset Filters
            </button>
            <button onClick={loadLostItems} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              <FiRefreshCw />
              Refresh
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr,180px,180px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search item, location, notes"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
            <option value="">All Status</option>
            <option value="FOUND">FOUND</option>
            <option value="CLAIMED">CLAIMED</option>
          </select>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600">
            <FiFilter />
            {visibleItems.length} results
          </div>
        </div>
      </motion.section>

      <div className={`${isGuard ? 'grid gap-5 2xl:grid-cols-[420px,1fr] 2xl:items-start' : ''}`}>
      {isGuard && (
        <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onSubmit={postLostItem} className="2xl:sticky 2xl:top-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-900">Post Found Item</h3>
            <button
              type="button"
              onClick={clearPostForm}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
              <FiX />
              Clear Form
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-500">Add details so residents and management can identify the item quickly.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input value={form.itemName} onChange={(e) => setForm((prev) => ({ ...prev, itemName: e.target.value }))} placeholder="Enter item name" required className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <input value={form.locationFound} onChange={(e) => setForm((prev) => ({ ...prev, locationFound: e.target.value }))} placeholder="Enter location where item was found" required className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <input type="date" value={form.dateFound} onChange={(e) => setForm((prev) => ({ ...prev, dateFound: e.target.value }))} required className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <input value={form.image} onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.value }))} placeholder="Image URL (optional, use upload below)" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          </div>
          <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Enter item description" className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          <textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Notes (optional)" className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            <FiUploadCloud />
            Upload photo (optional)
            <input type="file" accept="image/*" onChange={(e) => onUploadImage(e.target.files?.[0])} className="hidden" />
          </label>
          {form.image ? (
            <div className="mt-3 rounded-xl border border-slate-200 p-2">
              <button type="button" onClick={() => openImagePreview(form.image)} className="w-full text-left">
                <img src={form.image} alt="Preview" className="h-28 w-full rounded-lg object-cover" />
              </button>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openImagePreview(form.image)}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  <FiImage />
                  View Full Photo
                </button>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, image: '' }))}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <FiX />
                  Remove Photo
                </button>
              </div>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              <FiPlusCircle />
              {saving ? 'Posting...' : 'Post Item'}
            </button>
            <button type="button" onClick={loadLostItems} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">
              <FiRefreshCw />
              Sync List
            </button>
          </div>
        </motion.form>
      )}

      <section className="classy-list-shell rounded-2xl border border-slate-200 bg-white p-4 shadow-panel">
        <div className="classy-list-toolbar mb-3 flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-lg font-semibold text-slate-900">Found Item Board</h3>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{visibleItems.length} items</span>
        </div>
        <div className="classy-list-grid grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <>
            <div className="h-44 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-44 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-44 animate-pulse rounded-2xl bg-slate-200" />
          </>
        ) : (
          visibleItems.map((item) => {
            const safeImage = resolveImageSource(item.image);
            return (
            <motion.article
              key={item._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`classy-list-card rounded-2xl border bg-white p-4 shadow-panel transition ${selectedItemId && selectedItemId === String(item._id) ? 'border-emerald-300 ring-2 ring-emerald-200' : 'border-slate-200'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold text-slate-900">{item.itemName}</h3>
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-2 text-sm text-slate-600">{item.description || '-'}</p>
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500"><FiMapPin /> {item.locationFound}</p>
              <p className="mt-1 text-xs text-slate-500">Date Found: {formatDate(item.dateFound)}</p>
              <p className="mt-1 text-xs text-slate-500">Posted: {formatDate(item.createdAt)}</p>
              <p className="mt-1 text-xs text-slate-500">Found By: {item.foundByGuard?.name || '-'}</p>
              <p className="mt-1 text-xs text-slate-500">Claimed By: {item.claimedBy?.name || '-'}</p>
              {item.notes ? <p className="mt-2 text-xs text-slate-600">Notes: {item.notes}</p> : null}
              {safeImage ? (
                <div className="mt-3">
                  <button type="button" onClick={() => openImagePreview(safeImage)} className="w-full text-left">
                    <img src={safeImage} alt={item.itemName} className="h-28 w-full rounded-lg border border-slate-200 object-cover" />
                  </button>
                  <button type="button" onClick={() => openImagePreview(safeImage)} className="mt-2 inline-block rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                    View Full Photo
                  </button>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {canClaim && item.status === 'FOUND' && !item.claimedBy && (
                  <button onClick={() => claimItem(item._id)} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">
                    Claim Item
                  </button>
                )}
                {canClose && item.status === 'FOUND' && (
                  <button onClick={() => closeItem(item)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                    <FiCheckCircle />
                    Mark Claimed
                  </button>
                )}
              </div>
            </motion.article>
          )})
        )}
        </div>
      </section>
      </div>

      {!loading && !visibleItems.length && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          No lost & found items available.
        </div>
      )}

      {previewImage ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/55 p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewImage('')}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                <FiX />
                Close
              </button>
            </div>
            <img src={previewImage} alt="Full Preview" className="max-h-[80vh] w-full rounded-xl object-contain" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default LostFoundPage;

