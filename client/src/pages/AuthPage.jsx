import { motion } from 'framer-motion';
import { useState } from 'react';
import { FiEye, FiEyeOff, FiLock, FiMail } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import AuthSplitLayout from '../components/auth/AuthSplitLayout.jsx';
import BrandLogo from '../components/auth/BrandLogo.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function AuthPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = form.email.trim() && form.password.trim();

  function onChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    try {
      setLoading(true);
      setError('');
      const payload = await login(form.email.trim(), form.password);
      const role = String(payload?.user?.role || payload?.admin?.role || '').toLowerCase();
      if (['admin', 'super_admin', 'committee', 'tenant', 'resident', 'owner'].includes(role)) {
        navigate('/app/dashboard', { replace: true });
      } else if (role === 'guard') {
        navigate('/app/visitor-management', { replace: true });
      } else {
        navigate('/app', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  function openForgotModal() {
    setForgotOpen(true);
    setForgotEmail(form.email.trim());
    setForgotError('');
    setForgotSuccess('');
  }

  function closeForgotModal() {
    setForgotOpen(false);
    setForgotLoading(false);
    setForgotError('');
    setForgotSuccess('');
  }

  async function onForgotSubmit(event) {
    event.preventDefault();
    const value = forgotEmail.trim();

    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setForgotError('Please enter a valid email address.');
      return;
    }

    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to send reset link.');
      }
      setForgotSuccess(payload?.message || 'Reset link sent to your email.');
    } catch (err) {
      setForgotError(err.message || 'Failed to send reset link.');
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <AuthSplitLayout heading="One place to manage residents, gate operations, notices, payments, and day-to-day community workflows.">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="relative w-full max-w-xl rounded-[26px] border border-white/70 bg-white/75 p-6 shadow-[0_28px_70px_rgba(15,23,42,0.18)] backdrop-blur-2xl md:p-8"
      >
        <BrandLogo compact className="mb-4" />
        <h1 className="font-display text-3xl font-semibold text-slate-900 md:text-[2rem]">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-600 md:text-[15px]">Sign in to continue to your society dashboard.</p>

        <form className="mt-7 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-slate-700">
              Email Address
            </label>
            <div className="group relative">
              <FiMail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-indigo-600" />
              <input
                id="email"
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-10 py-3 text-sm text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.16)]"
                placeholder="name@example.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-semibold text-slate-700">
              Password
            </label>
            <div className="group relative">
              <FiLock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-indigo-600" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={onChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-10 py-3 pr-12 text-sm text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.16)]"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={openForgotModal}
              className="text-sm font-medium text-indigo-600 transition hover:text-indigo-800 hover:underline"
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="group relative inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(79,70,229,0.35)] active:translate-y-0 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                Signing in...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-500">New users are created by admin only.</p>

        {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
      </motion.div>

      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4"
          onClick={closeForgotModal}
          role="presentation"
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/70 bg-white/95 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.3)] backdrop-blur-xl"
          >
            <BrandLogo compact className="mb-3" />
            <h2 className="font-display text-2xl font-semibold text-slate-900">Forgot Password</h2>
            <p className="mt-2 text-sm text-slate-600">Enter your registered email to receive a reset link.</p>

            <form className="mt-5 space-y-4" onSubmit={onForgotSubmit}>
              <div className="group relative">
                <FiMail className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-cyan-700" />
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(event) => setForgotEmail(event.target.value)}
                  placeholder="Email Address"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm text-slate-900 outline-none transition duration-200 focus:border-cyan-400 focus:shadow-[0_0_0_4px_rgba(34,211,238,0.15)]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeForgotModal}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {forgotLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </div>
            </form>

            {forgotError && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{forgotError}</p>}
            {forgotSuccess && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{forgotSuccess}</p>}
          </motion.div>
        </div>
      )}
    </AuthSplitLayout>
  );
}

export default AuthPage;
