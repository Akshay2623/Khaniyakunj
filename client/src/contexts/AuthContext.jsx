import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'society_mgmt_token';

const AuthContext = createContext(null);

function normalizeClientRole(role) {
  const normalized = String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (normalized.includes('guard') || normalized.includes('security')) return 'guard';
  if (normalized.includes('committee')) return 'committee';
  return normalized;
}

function normalizeUserShape(user) {
  if (!user || typeof user !== 'object') return user;
  return { ...user, role: normalizeClientRole(user.role) };
}

function extractProfile(rawProfile) {
  if (!rawProfile || typeof rawProfile !== 'object') return { user: null, allowedModules: [] };
  const payload = rawProfile.data && typeof rawProfile.data === 'object' ? rawProfile.data : rawProfile;
  const userCandidate =
    payload.user ||
    payload.admin ||
    (payload.role ? payload : null);
  const allowed = payload.allowedModules || rawProfile.allowedModules || [];
  return {
    user: normalizeUserShape(userCandidate || null),
    allowedModules: Array.isArray(allowed) ? allowed : [],
  };
}

function resolveAllowedModules(userRole, modules = []) {
  const set = new Set(Array.isArray(modules) ? modules : []);
  const role = String(userRole || '').toLowerCase();
  if (['resident', 'tenant', 'owner'].includes(role)) {
    set.add('familyMembers');
  }
  if (['super_admin', 'admin', 'committee', 'resident', 'tenant', 'owner'].includes(role)) {
    set.add('marketplace');
  }
  // Polls are visible to every logged-in user. Admin-only actions are enforced by backend/UI.
  set.add('polls');
  return Array.from(set);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch {
      return '';
    }
  });
  const [admin, setAdmin] = useState(null);
  const [allowedModules, setAllowedModules] = useState([]);
  const [authChecked, setAuthChecked] = useState(false);

  function clearSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Ignore storage errors.
    }
    setToken('');
    setAdmin(null);
    setAllowedModules([]);
  }

  async function apiRequest(path, options = {}) {
    const { method = 'GET', body, headers = {}, auth = true, raw = false } = options;

    let response;
    try {
      response = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error('Unable to connect to server. Please check backend connection and try again.');
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Avoid hard logout on every unauthorized API response.
      // Some module endpoints can transiently return 401/403 and should show
      // an inline error instead of forcing redirect to login.
      const isProfileCheck = String(path || '').startsWith('/api/auth/me');
      if (response.status === 401 && auth && isProfileCheck) {
        clearSession();
      }
      const fieldErrors = payload?.data?.errors;
      const validationMessage = Array.isArray(fieldErrors) && fieldErrors.length
        ? fieldErrors.map((item) => `${item.field}: ${item.message}`).join(', ')
        : '';
      throw new Error(validationMessage || payload.message || 'Request failed.');
    }

    if (!raw && payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'success')) {
      if (Object.prototype.hasOwnProperty.call(payload, 'data')) {
        return payload.data;
      }
    }

    return payload;
  }

  async function bootstrapProfile() {
    if (!token) {
      setAuthChecked(true);
      return;
    }

    try {
      const profile = await apiRequest('/api/auth/me', { raw: true });
      const { user, allowedModules: modules } = extractProfile(profile);
      if (!user) {
        clearSession();
        return;
      }
      setAdmin(user);
      setAllowedModules(resolveAllowedModules(user?.role, modules));
    } catch {
      clearSession();
    } finally {
      setAuthChecked(true);
    }
  }

  useEffect(() => {
    bootstrapProfile();
  }, [token]);

  async function login(email, password) {
    const payload = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });

    const loginToken = payload.token;
    try {
      localStorage.setItem(TOKEN_KEY, loginToken);
    } catch {
      // Ignore storage errors and continue with in-memory token.
    }
    setToken(loginToken);

    try {
      const profileResponse = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${loginToken}`,
        },
      });
      const profilePayload = await profileResponse.json().catch(() => ({}));

      if (profileResponse.ok) {
        const { user, allowedModules: modules } = extractProfile(profilePayload);
        setAdmin(user);
        setAllowedModules(resolveAllowedModules(user?.role, modules));
      } else {
        const fallbackUser = normalizeUserShape(payload.user || payload.admin || null);
        setAdmin(fallbackUser);
        setAllowedModules(resolveAllowedModules(fallbackUser?.role, payload.allowedModules || []));
      }
    } catch {
      const fallbackUser = normalizeUserShape(payload.user || payload.admin || null);
      setAdmin(fallbackUser);
      setAllowedModules(resolveAllowedModules(fallbackUser?.role, payload.allowedModules || []));
    }

    return payload;
  }

  async function register(name, email, password, role = 'tenant', societyId = null) {
    const payload = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: { name, email, password, role, societyId },
    });
    return payload;
  }

  function logout() {
    clearSession();
  }

  const value = useMemo(
    () => ({
      token,
      admin,
      allowedModules,
      authChecked,
      login,
      register,
      logout,
      apiRequest,
    }),
    [token, admin, allowedModules, authChecked]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
