function AppButton({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  disabled = false,
  ...props
}) {
  const variantClass =
    variant === 'danger'
      ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white hover:from-rose-400 hover:to-pink-400'
      : variant === 'secondary'
      ? 'border border-blue-200 bg-gradient-to-r from-white to-sky-50 text-slate-700 hover:from-blue-50 hover:to-cyan-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'
      : variant === 'ghost'
      ? 'border border-sky-200 bg-gradient-to-r from-sky-50/90 to-cyan-50 text-sky-700 hover:from-sky-100 hover:to-cyan-100 dark:border-cyan-900 dark:bg-cyan-900/25 dark:text-cyan-200 dark:hover:bg-cyan-900/40'
      : 'bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-[0_12px_24px_rgba(79,70,229,0.28)] hover:from-indigo-500 hover:to-cyan-400';

  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default AppButton;
