import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { FiBell, FiClock, FiGlobe, FiMoon, FiSave, FiShield, FiUser } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';

function formatRelative(dateValue) {
  if (!dateValue) return '-';
  const date = new Date(dateValue);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hrs ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} days ago`;
  return date.toLocaleDateString();
}

function MyProfilePage() {
  const { apiRequest } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const [profile, setProfile] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    phone: '',
    emergencyContact: '',
    profileImageUrl: '',
    languagePreference: 'en-US',
    timezone: 'UTC',
    currentPassword: '',
    newPassword: '',
    notificationPreferences: {
      email: true,
      sms: false,
      push: true,
    },
    uiPreferences: {
      darkMode: false,
    },
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const [profileData, activityPayload] = await Promise.all([
          apiRequest('/api/residents/my-profile'),
          apiRequest('/api/resident/activity', { raw: true }),
        ]);
        setProfile(profileData);
        setActivity(activityPayload.data || []);
        setForm((prev) => ({
          ...prev,
          phone: profileData?.phone || '',
          languagePreference: profileData?.userId?.languagePreference || 'en-US',
          emergencyContact: profileData?.userId?.emergencyContact || '',
          profileImageUrl: profileData?.userId?.profileImageUrl || '',
          timezone: profileData?.userId?.timezone || 'UTC',
          notificationPreferences: profileData?.userId?.notificationPreferences || prev.notificationPreferences,
          uiPreferences: profileData?.userId?.uiPreferences || { darkMode: theme === 'dark' },
        }));
      } catch (err) {
        setError(err.message || 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const userName = useMemo(() => profile?.name || 'Resident User', [profile]);

  async function onSubmit(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      await apiRequest('/api/resident/profile', { method: 'PUT', body: form, raw: true });
      setSuccess('Profile and settings updated.');
      showToast('Profile updated successfully.', 'success');
      setForm((prev) => ({ ...prev, currentPassword: '', newPassword: '' }));
      const activityPayload = await apiRequest('/api/resident/activity', { raw: true });
      setActivity(activityPayload.data || []);
    } catch (err) {
      const message = err.message || 'Failed to update profile.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading profile...</p>;
  }

  return (
    <div className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-panel dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center gap-4">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-cyan-100 text-xl font-bold text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-200">
            {userName[0]?.toUpperCase() || 'R'}
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{userName}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{profile?.email}</p>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-4 xl:grid-cols-3">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel xl:col-span-2 dark:border-slate-800 dark:bg-slate-900"
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Profile & Settings</h3>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
            <input
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="Phone"
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              value={form.emergencyContact}
              onChange={(e) => setForm((prev) => ({ ...prev, emergencyContact: e.target.value }))}
              placeholder="Emergency contact"
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              value={form.profileImageUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, profileImageUrl: e.target.value }))}
              placeholder="Profile image URL"
              className="md:col-span-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              value={form.languagePreference}
              onChange={(e) => setForm((prev) => ({ ...prev, languagePreference: e.target.value }))}
              placeholder="Language preference (en-US)"
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              value={form.timezone}
              onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
              placeholder="Timezone (UTC)"
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
              placeholder="Current password"
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              placeholder="New password"
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />

            <div className="md:col-span-2 grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <FiBell /> Notification Preferences
              </p>
              <label className="text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.notificationPreferences.email}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      notificationPreferences: { ...prev.notificationPreferences, email: e.target.checked },
                    }))
                  }
                  className="mr-2"
                />
                Email notifications
              </label>
              <label className="text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.notificationPreferences.sms}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      notificationPreferences: { ...prev.notificationPreferences, sms: e.target.checked },
                    }))
                  }
                  className="mr-2"
                />
                SMS notifications
              </label>
              <label className="text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.notificationPreferences.push}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      notificationPreferences: { ...prev.notificationPreferences, push: e.target.checked },
                    }))
                  }
                  className="mr-2"
                />
                Push notifications
              </label>
            </div>

            <div className="md:col-span-2 flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <FiMoon /> Dark mode preference
              </p>
              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                  setForm((prev) => ({
                    ...prev,
                    uiPreferences: { ...prev.uiPreferences, darkMode: !prev.uiPreferences.darkMode },
                  }));
                }}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Toggle ({theme})
              </button>
            </div>

            <button
              disabled={saving}
              className="md:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              <FiSave /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-slate-900"
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Activity Timeline</h3>
          <ul className="mt-4 space-y-3">
            {activity.map((item) => (
              <li key={item._id} className="relative rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <span className="absolute -left-2 top-4 h-3 w-3 rounded-full bg-cyan-500" />
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <FiClock size={12} /> {formatRelative(item.createdAt)}
                </p>
              </li>
            ))}
            {!activity.length && <p className="text-sm text-slate-500 dark:text-slate-400">No recent activity.</p>}
          </ul>
          <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <FiGlobe /> Language: {form.languagePreference}
            </p>
            <p className="mt-1 inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <FiShield /> Theme mode: {theme}
            </p>
            <p className="mt-1 inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <FiUser /> Profile sync: Active
            </p>
          </div>
        </motion.section>
      </div>

      {success && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">{success}</p>}
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">{error}</p>}
    </div>
  );
}

export default MyProfilePage;
