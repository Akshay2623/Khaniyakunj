import { motion } from 'framer-motion';
import { FiCheckCircle, FiLock, FiZap } from 'react-icons/fi';
import BrandLogo from './BrandLogo.jsx';

function AuthSplitLayout({ children, heading = 'Secure access for your society teams.' }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_14%,rgba(59,130,246,0.28),transparent_34%),radial-gradient(circle_at_88%_78%,rgba(20,184,166,0.24),transparent_36%),linear-gradient(145deg,#eaf1ff_0%,#e2fbff_42%,#f4ecff_100%)]">
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.08)_1px,transparent_1px)] [background-size:36px_36px]" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-indigo-400/30 blur-3xl"
        animate={{ x: [0, 18, 0], y: [0, -10, 0], scale: [1, 1.07, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-12 bottom-8 h-72 w-72 rounded-full bg-cyan-300/35 blur-3xl"
        animate={{ x: [0, -16, 0], y: [0, 12, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative mx-auto grid min-h-screen max-w-7xl items-stretch px-4 py-6 lg:grid-cols-2 lg:px-8 lg:py-10">
        <section className="hidden rounded-[28px] border border-white/45 bg-gradient-to-br from-indigo-700/90 via-cyan-700/85 to-teal-700/85 p-8 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)] backdrop-blur md:flex md:flex-col lg:mr-8">
          <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }}>
            <BrandLogo tone="light" size="lg" />
          </motion.div>
          <h1 className="mt-7 font-display text-4xl font-semibold leading-tight">
            Smart. Secure. Modern Society Operations.
          </h1>
          <p className="mt-3 max-w-md text-sm text-cyan-50/95">{heading}</p>

          <div className="mt-8 space-y-3 text-sm">
            <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2">
              <FiLock size={15} />
              Role-based secure access for Admin, Committee, Resident, Guard.
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2">
              <FiZap size={15} />
              Real-time notices, alerts, and approvals with live updates.
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2">
              <FiCheckCircle size={15} />
              One connected workspace for gate, residents, and operations.
            </div>
          </div>

          <div className="mt-auto rounded-2xl border border-white/25 bg-white/10 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-100">Trusted Access Layer</p>
            <p className="mt-2 text-sm text-cyan-50/95">
              Enterprise-style authentication, clean role separation, and secure user lifecycle control.
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center py-4 lg:py-0">{children}</section>
      </div>
    </div>
  );
}

export default AuthSplitLayout;
