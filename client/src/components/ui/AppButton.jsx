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
      ? 'bg-gradient-to-r from-rose-600 to-orange-500 text-white hover:from-rose-500 hover:to-orange-400'
      : variant === 'secondary'
      ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'
      : variant === 'ghost'
      ? 'border border-cyan-200 bg-cyan-50/70 text-cyan-700 hover:bg-cyan-100 dark:border-cyan-900 dark:bg-cyan-900/25 dark:text-cyan-200 dark:hover:bg-cyan-900/40'
      : 'bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 text-white hover:from-indigo-500 hover:to-cyan-400';

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
