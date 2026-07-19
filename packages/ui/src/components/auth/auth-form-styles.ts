/** Shared Tailwind class strings for Ethereal Glass auth forms */

export const authForm = {
  title:
    'text-3xl font-bold tracking-[-0.03em] text-white font-heading',
  titleAccent:
    'bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent',
  subtitle: 'mt-2 text-[0.95rem] leading-relaxed text-white/50',
  label: 'text-white/70 text-sm font-medium block',
  link: 'text-sm text-cyan-400/90 hover:text-cyan-300 transition-colors duration-500',
  input:
    'relative w-full pl-12 h-14 bg-white/[0.04] border border-white/10 text-white placeholder:text-white/30 focus:border-cyan-400/50 focus:ring-[3px] focus:ring-cyan-400/15 rounded-2xl transition-all duration-500 outline-none',
  inputIcon:
    'absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/35 group-focus-within:text-cyan-400 transition-colors duration-500 z-10',
  inputGlow:
    'absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500',
  error:
    'p-3.5 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-2xl',
  checkboxOn: 'bg-cyan-500 border-cyan-500 shadow-[0_0_12px_2px_rgba(6,182,212,0.28)]',
  checkboxOff: 'border-white/20 bg-transparent hover:border-white/35',
  checkboxLabel: 'text-sm text-white/45 cursor-pointer select-none',
  submitBtn:
    'relative w-full h-14 text-base font-semibold bg-white text-[#050505] border-0 rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_12px_40px_rgba(255,255,255,0.12)] active:scale-[0.985]',
  submitShimmer:
    'absolute inset-0 bg-gradient-to-r from-white/0 via-black/[0.04] to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000',
  dividerLine: 'w-full border-t border-white/10',
  dividerText:
    'bg-[var(--auth-panel,#0a0a0a)] px-4 text-white/35 text-[10px] font-semibold uppercase tracking-[0.18em]',
  footer: 'text-white/30 text-xs text-center',
  secondaryBtn:
    'w-full h-14 border border-white/12 bg-white/[0.03] text-white/80 hover:bg-white/[0.06] hover:text-white hover:border-white/20 rounded-full transition-all duration-500 font-semibold',
} as const;
