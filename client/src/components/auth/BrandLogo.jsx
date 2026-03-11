import { FiShield } from 'react-icons/fi';

function BrandLogo({ compact = false, className = '', variant = 'full', tone = 'dark', size = 'md' }) {
  const isLight = tone === 'light';
  const iconSize = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-12 w-12' : 'h-11 w-11';
  const titleClass = isLight ? 'text-white' : 'text-slate-900';
  const eyebrowClass = isLight ? 'text-cyan-100' : 'text-indigo-700';
  const showText = variant !== 'icon';

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className={`relative inline-flex ${iconSize} items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-cyan-500 to-teal-400 text-white shadow-[0_10px_24px_rgba(79,70,229,0.35)]`}>
        <FiShield size={20} />
        <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400" />
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
