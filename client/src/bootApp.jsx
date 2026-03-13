import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('UI crash caught by AppErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', padding: 16 }}>
          <div style={{ maxWidth: 720, width: '100%', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 12, padding: 16 }}>
            <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Frontend runtime error</h2>
            <p style={{ marginTop: 8, color: '#334155', fontSize: 14 }}>
              App crashed while rendering. Please share this message:
            </p>
            <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', color: '#991b1b', fontSize: 12 }}>
              {String(this.state.error?.message || this.state.error || 'Unknown error')}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function startApp(rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <AppErrorBoundary>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </AppErrorBoundary>
    </StrictMode>
  );
}

