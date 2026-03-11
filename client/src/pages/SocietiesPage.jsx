import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiGrid, FiMapPin, FiSearch, FiTrendingUp } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext.jsx';

function SocietiesPage() {
  const { apiRequest } = useAuth();
  const [societies, setSocieties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [form, setForm] = useState({ name: '', address: '', totalFlats: '' });

  const canSubmit = useMemo(
    () => form.name.trim() && form.address.trim() && Number(form.totalFlats) > 0,
    [form]
  );

  const completion = useMemo(() => {
    let score = 0;
    if (form.name.trim()) score += 1;
    if (form.address.trim()) score += 1;
    if (Number(form.totalFlats) > 0) score += 1;
    return Math.round((score / 3) * 100);
  }, [form]);

  const stats = useMemo(() => {
    const totalSocieties = societies.length;
    const totalFlats = societies.reduce((sum, s) => sum + (Number(s.totalFlats) || 0), 0);
    const avgFlats = totalSocieties ? Math.round(totalFlats / totalSocieties) : 0;
    return { totalSocieties, totalFlats, avgFlats };
  }, [societies]);

  const maxFlats = useMemo(
    () => Math.max(...societies.map((society) => Number(society.totalFlats) || 0), 1),
    [societies]
  );

  const filteredSocieties = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = societies.filter((society) => {
      if (!query) return true;
      return (
        society.name?.toLowerCase().includes(query) || society.address?.toLowerCase().includes(query)
      );
    });

    const sorted = [...result];
    if (sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'flats_desc') {
      sorted.sort((a, b) => Number(b.totalFlats) - Number(a.totalFlats));
    } else if (sortBy === 'flats_asc') {
      sorted.sort((a, b) => Number(a.totalFlats) - Number(b.totalFlats));
    } else {
      sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    return sorted;
  }, [societies, search, sortBy]);

  async function fetchSocieties() {
    try {
      setLoading(true);
      setError('');
      const data = await apiRequest('/api/societies');
      setSocieties(data);
    } catch (err) {
      setError(err.message || 'Failed to load societies.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSocieties();
  }, []);

  function onChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function applyTemplate(template) {
    setForm(template);
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    try {
      setError('');
      await apiRequest('/api/societies', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          address: form.address.trim(),
          totalFlats: Number(form.totalFlats),
        },
      });

      setForm({ name: '', address: '', totalFlats: '' });
      await fetchSocieties();
    } catch (err) {
      setError(err.message || 'Failed to create society.');
    }
  }

  const societyCode = useMemo(() => {
    const label = form.name.trim();
    if (!label) return 'SOC-NEW';
    const compact = label.replace(/[^a-zA-Z0-9 ]/g, '').trim();
    const acronym = compact
      .split(/\s+/)
      .slice(0, 3)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');
    return `${acronym || 'SOC'}-${String(form.totalFlats || 0).padStart(3, '0')}`;
  }, [form.name, form.totalFlats]);

  return (
    <div className="space-y-5 font-['Space_Grotesk']">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-cyan-200/70 bg-gradient-to-r from-cyan-100 via-white to-sky-100 p-6 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800"
      >
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-400/20 blur-2xl dark:bg-cyan-400/10" />
        <div className="absolute -bottom-14 left-40 h-40 w-40 rounded-full bg-sky-400/20 blur-2xl dark:bg-sky-400/10" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300">
            Society Workspace
          </p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">Society Control Center</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Register communities, track flat capacity, and maintain a clean live directory for your operations.
          </p>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
            <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Total Societies</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{stats.totalSocieties}</p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
            <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Total Flats</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{stats.totalFlats}</p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
            <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Avg / Society</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{stats.avgFlats}</p>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-4 xl:grid-cols-5">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel xl:col-span-2 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Add New Society</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Enter core details to onboard a new community.
            </p>
          </div>
          <span className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 dark:border-cyan-700/40 dark:bg-cyan-900/20 dark:text-cyan-300">
            {societyCode}
          </span>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Form completion</span>
            <span>{completion}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-500 transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Society Name
            </label>
            <div className="relative">
              <FiGrid className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                name="name"
                value={form.name}
                onChange={onChange}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-800"
                placeholder="Green Valley Residency"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Address
            </label>
            <div className="relative">
              <FiMapPin className="pointer-events-none absolute left-3 top-3 text-slate-400" />
              <textarea
                rows={3}
                name="address"
                value={form.address}
                onChange={onChange}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-800"
                placeholder="Sector 21, Noida"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total Flats
            </label>
            <input
              type="number"
              min="1"
              name="totalFlats"
              value={form.totalFlats}
              onChange={onChange}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-800"
              placeholder="120"
              required
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Tip: Use approved flat inventory from your society records.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                applyTemplate({
                  name: 'Maple Heights',
                  address: 'Near Metro Station, Sector 18, Noida',
                  totalFlats: '180',
                })
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Use sample A
            </button>
            <button
              type="button"
              onClick={() =>
                applyTemplate({
                  name: 'Skyline Residency',
                  address: 'Ring Road, Kalwar Road, Jaipur',
                  totalFlats: '240',
                })
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Use sample B
            </button>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-cyan-700 hover:to-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiCheckCircle />
            Add Society
          </button>
        </form>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel xl:col-span-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Society Directory</h2>
          <div className="flex w-full gap-2 sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or address"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="newest">Newest</option>
              <option value="name">Name A-Z</option>
              <option value="flats_desc">Flats high-low</option>
              <option value="flats_asc">Flats low-high</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading societies...</p>
        ) : filteredSocieties.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No societies added yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {filteredSocieties.map((society, index) => (
              <motion.li
                key={society._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.2) }}
                className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 dark:border-slate-700 dark:from-slate-900 dark:to-slate-800/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">{society.name}</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{society.address}</p>
                  </div>
                  <span className="rounded-lg bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300">
                    {Number(society.totalFlats) >= 150 ? 'Large' : 'Standard'}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <FiGrid />
                    {society.totalFlats} flats
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FiTrendingUp />
                    {Math.round(((Number(society.totalFlats) || 0) / maxFlats) * 100)}% capacity scale
                  </span>
                </div>

                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-500"
                    style={{ width: `${Math.max(8, Math.round(((Number(society.totalFlats) || 0) / maxFlats) * 100))}%` }}
                  />
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </motion.section>
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">{error}</p>}
    </div>
  );
}

export default SocietiesPage;
