/** Shared Tailwind class strings for dark auth forms (CRM landing palette) */

export const authForm = {
  title: 'text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent',
  subtitle: 'mt-2 text-slate-400',
  label: 'text-slate-300 text-sm font-medium block',
  link: 'text-sm text-cyan-400 hover:text-cyan-300 transition-colors',
  input:
    'relative w-full pl-12 h-14 bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 rounded-xl transition-all outline-none',
  inputIcon: 'absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors z-10',
  inputGlow:
    'absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity',
  error: 'p-3 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl',
  checkboxOn: 'bg-cyan-500 border-cyan-500 shadow-[0_0_10px_2px_rgba(6,182,212,0.3)]',
  checkboxOff: 'border-slate-600 bg-transparent hover:border-slate-500',
  checkboxLabel: 'text-sm text-slate-400 cursor-pointer select-none',
  submitBtn:
    'relative w-full h-14 text-base font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white border-0 rounded-xl transition-all overflow-hidden group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(6,182,212,0.25)] hover:shadow-[0_8px_30px_rgba(6,182,212,0.35)]',
  submitShimmer:
    'absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000',
  dividerLine: 'w-full border-t border-slate-700',
  dividerText: 'bg-[var(--auth-panel,#0a1628)] px-4 text-slate-500 text-xs uppercase tracking-widest',
  footer: 'text-slate-500 text-xs text-center',
} as const;
