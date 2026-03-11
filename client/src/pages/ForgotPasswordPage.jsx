import { motion } from 'framer-motion';
import { useState } from 'react';
import { FiArrowLeft, FiMail } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import AuthSplitLayout from '../components/auth/AuthSplitLayout.jsx';
import BrandLogo from '../components/auth/BrandLogo.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function onSubmit(event) {
    event.preventDefault();
    const value = email.trim();
    if (!value) {
      setError('Email is required.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

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

      setSuccess(payload?.message || 'Reset link sent to your email.');
    } catch (err) {
      setError(err.message || 'Failed to send reset link.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout heading="Reset access quickly and securely with a time-bound email link.">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md rounded-[24px] border border-white/70 bg-white/80 p-6 shadow-[0_28px_70px_rgba(15,23,42,0.16)] backdrop-blur-2xl"
      >
        <BrandLogo compact className="mb-3" />
        <h1 className="font-display mt-2 text-3xl font-semibold text-slate-900">Forgot password</h1>
        <p className="mt-2 text-sm text-slate-600">Enter your registered email to receive a secure reset link.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-slate-700">Email Address</label>
            <div className="group relative">
            <FiMail className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-cyan-700" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-10 py-3 text-sm text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.16)]"
              placeholder="name@example.com"
              required
            />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                Sending...
              </>
            ) : (
              'Send Reset Link'
            )}
          </button>
        </form>

        <Link
          to="/auth"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          <FiArrowLeft className="h-4 w-4" />
          Back to login
        </Link>

        {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50/90 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        {success && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm font-medium text-emerald-700">{success}</p>}
      </motion.div>
    </AuthSplitLayout>
  );
}

export default ForgotPasswordPage;
