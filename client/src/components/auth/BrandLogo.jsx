function BrandLogo({ compact = false, className = '', variant = 'full', tone = 'dark', size = 'md' }) {
  const isLight = tone === 'light';
  const iconSize = size === 'sm' ? 'h-10 w-10' : size === 'lg' ? 'h-14 w-14' : 'h-12 w-12';
  const titleClass = isLight ? 'text-white' : 'text-slate-900';
  const eyebrowClass = isLight ? 'text-blue-100' : 'text-blue-700';
  const showText = variant !== 'icon';
  const ringClass = isLight ? 'border-white/20 bg-white/10' : 'border-blue-200 bg-white';
  const signalClass = isLight ? 'bg-emerald-300 border-white/80' : 'bg-emerald-400 border-white';

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className={`relative inline-flex ${iconSize} items-center justify-center rounded-2xl border ${ringClass} shadow-[0_10px_24px_rgba(37,99,235,0.26)]`}>
        <svg viewBox="0 0 64 64" className="h-[86%] w-[86%]" aria-hidden="true">
          <defs>
            <linearGradient id="societyosMarkBgV2" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#1D4ED8" />
              <stop offset="0.55" stopColor="#2563EB" />
              <stop offset="1" stopColor="#0EA5E9" />
            </linearGradient>
            <linearGradient id="societyosTowerV2" x1="14" y1="20" x2="44" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#EAF5FF" />
              <stop offset="1" stopColor="#C7E7FF" />
            </linearGradient>
          </defs>
          <rect x="6" y="6" width="52" height="52" rx="16" fill="url(#societyosMarkBgV2)" />
          <circle cx="20" cy="18" r="2.2" fill="#E0F2FE" />
          <circle cx="44" cy="18" r="2.2" fill="#E0F2FE" />
          <circle cx="32" cy="12.5" r="2.2" fill="#E0F2FE" />
          <path d="M20 18h24M32 12.5v5.5" stroke="#D8EEFF" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="14" y="30" width="10" height="14" rx="2.2" fill="url(#societyosTowerV2)" />
          <rect x="27" y="24" width="10" height="20" rx="2.2" fill="url(#societyosTowerV2)" />
          <rect x="40" y="33" width="10" height="11" rx="2.2" fill="url(#societyosTowerV2)" />
          <rect x="30.5" y="35" width="3" height="9" rx="1" fill="#1D4ED8" opacity="0.7" />
          <path d="M14 47h36" stroke="#D8EEFF" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 ${signalClass}`} />
      </div>
      {showText ? (
        <div className={compact ? 'hidden sm:block' : ''}>
          <p className={`font-display text-[11px] font-semibold uppercase tracking-[0.22em] ${eyebrowClass}`}>SocietyOS</p>
          <p className={`font-display text-base font-semibold ${titleClass}`}>Society Management</p>
        </div>
      ) : null}
    </div>
  );
}

export default BrandLogo;
