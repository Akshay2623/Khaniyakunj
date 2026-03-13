const configuredApiUrl = String(import.meta.env.VITE_API_URL || '')
  .trim()
  .replace(/\/+$/, '');

const inferredApiUrl =
  import.meta.env.DEV
    ? 'http://localhost:5000'
    : typeof window !== 'undefined'
    ? window.location.origin
    : '';

export const API_BASE_URL = configuredApiUrl || inferredApiUrl;

