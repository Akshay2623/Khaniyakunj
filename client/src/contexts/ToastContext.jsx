import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi';

const ToastContext = createContext(null);

function ToastItem({ toast, onClose }) {
  const Icon =
    toast.type === 'error' ? FiAlertCircle : toast.type === 'success' ? FiCheckCircle : FiInfo;
  const toneClass =
    toast.type === 'error'
      ? 'border-rose-300 bg-gradient-to-r from-rose-50 to-white text-rose-700 dark:border-rose-800 dark:from-rose-900/30 dark:to-slate-900 dark:text-rose-200'
      : toast.type === 'success'
      ? 'border-emerald-300 bg-gradient-to-r from-emerald-50 to-white text-emerald-700 dark:border-emerald-800 dark:from-emerald-900/30 dark:to-slate-900 dark:text-emerald-200'
      : 'border-cyan-200 bg-gradient-to-r from-cyan-50 to-white text-slate-700 dark:border-slate-700 dark:from-cyan-900/25 dark:to-slate-900 dark:text-slate-100';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`pointer-events-auto rounded-2xl border px-3 py-2 text-sm shadow-xl backdrop-blur-sm ${toneClass}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-base">
          <Icon />
        </span>
        <p className="flex-1 font-semibold">{toast.message}</p>
        <button
          onClick={() => onClose(toast.id)}
          className="rounded-lg bg-white/70 p-1 text-xs opacity-80 hover:opacity-100 dark:bg-slate-700"
          aria-label="Close notification"
        >
          <FiX size={14} />
        </button>
      </div>
    </motion.div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 2600) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => dismissToast(id), duration);
    }
  }, [dismissToast]);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);
  const canUseDom = typeof document !== 'undefined';
  const toastViewport = (
    <div className="pointer-events-none fixed right-4 top-4 z-[2000] flex w-[380px] max-w-[calc(100vw-1.5rem)] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={dismissToast} />
        ))}
      </AnimatePresence>
    </div>
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {canUseDom ? createPortal(toastViewport, document.body) : toastViewport}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return context;
}
