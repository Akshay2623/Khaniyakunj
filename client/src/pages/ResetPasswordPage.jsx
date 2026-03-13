import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiCheckCircle, FiEye, FiEyeOff, FiLock } from 'react-icons/fi';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthSplitLayout from '../components/auth/AuthSplitLayout.jsx';
import BrandLogo from '../components/auth/BrandLogo.jsx';
import { API_BASE_URL } from '../lib/apiBase.js';

const API_URL = API_BASE_URL;

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const normalizedNewPassword = form.newPassword.trim();
  const normalizedConfirmPassword = form.confirmPassword.trim();
  const passwordTooShort = normalizedNewPassword.length > 0 && normalizedNewPassword.length < 8;
  const hasUppercase = /[A-Z]/.test(normalizedNewPassword);
  const hasLowercase = /[a-z]/.test(normalizedNewPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(normalizedNewPassword);
  const weakPassword = normalizedNewPassword.length > 0 && (!hasUppercase || !hasLowercase || !hasSpecial);
  const mismatch = normalizedConfirmPassword.length > 0 && normalizedNewPassword !== normalizedConfirmPassword;
  const canSubmit =
    tokenValid &&
    normalizedNewPassword.length >= 8 &&
    hasUppercase &&
    hasLowercase &&
    hasSpecial &&
    normalizedNewPassword === normalizedConfirmPassword;

  useEffect(() => {
    let active = true;

    async function validateToken() {
      if (!token) {
        setValidating(false);
        setTokenValid(false);
        setError('Reset token is missing or invalid.');
        return;
      }

      try {
        setValidating(true);
        const response = await fetch(`${API_URL}/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || 'Reset token is invalid or expired.');
        }
        if (!active) return;
        setTokenValid(true);
      } catch (err) {
        if (!active) return;
        setTokenValid(false);
        setError(err.message || 'Reset token is invalid or expired.');
      } finally {
        if (active) setValidating(false);
      }
    }

    validateToken();
    return () => {
      active = false;
    };
  }, [token]);

  async function onSubmit(event) {
    event.preventDefault();
    if (!tokenValid) {
      setError('Reset token is invalid or expired.');
      return;
    }

    if (!canSubmit) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword: normalizedNewPassword,
          confirmPassword: normalizedConfirmPassword,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to reset password.');
      }

      setSuccess(payload?.message || 'Password reset successfully.');
      setTimeout(() => {
        navigate('/auth', { replace: true });
      }, 1500);
    } catch (err) {
      const message = String(err?.message || 'Failed to reset password.');
      if (message.toLowerCase().includes('include uppercase') || message.toLowerCase().includes('validation failed')) {
        setError('Password must include uppercase, lowercase, and special character.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout heading="Set a strong password to protect role-based access to your society workspace.">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md rounded-[24px] border border-white/70 bg-white/80 p-6 shadow-[0_28px_70px_rgba(15,23,42,0.16)] backdrop-blur-2xl"
      >
        <BrandLogo compact className="mb-3" />
        <h1 className="font-display mt-2 text-3xl font-semibold text-slate-900">Reset password</h1>
        <p className="mt-2 text-sm text-slate-600">Set a new password for your account.</p>

        {!tokenValid && !validating && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50/90 px-3 py-2 text-sm font-medium text-rose-700">
            Reset token is invalid or expired.
          </p>
        )}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="text-sm font-semibold text-slate-700">New Password</label>
            <div className="group relative">
            <FiLock className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-cyan-700" />
            <input
              id="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              value={form.newPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-10 py-3 pr-12 text-sm text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.16)]"
              placeholder="Enter new password"
              required
              disabled={!tokenValid || validating}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
            >
              {showNewPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700">Confirm Password</label>
            <div className="group relative">
            <FiLock className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-cyan-700" />
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-10 py-3 pr-12 text-sm text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.16)]"
              placeholder="Re-enter new password"
              required
              disabled={!tokenValid || validating}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirmPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
            </div>
          </div>

          {passwordTooShort && <p className="text-xs font-medium text-amber-700">Password must be at least 8 characters.</p>}
          {weakPassword && (
            <p className="text-xs font-medium text-amber-700">
              Password must include uppercase, lowercase, and special character.
            </p>
          )}
          {mismatch && <p className="text-xs font-medium text-rose-700">Passwords do not match.</p>}

          <button
            type="submit"
            disabled={!canSubmit || loading || validating}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {validating ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                Validating link...
              </>
            ) : loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                Resetting...
              </>
            ) : (
              'Reset Password'
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
        {success && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm font-medium text-emerald-700">
            <FiCheckCircle className="h-4 w-4" />
            {success} Redirecting to login...
          </p>
        )}
      </motion.div>
    </AuthSplitLayout>
  );
}

export default ResetPasswordPage;
