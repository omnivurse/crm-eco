/** Shared Tailwind class strings for Ethereal Glass auth forms (light + dark) */

export const authForm = {
  title:
    'text-3xl font-bold tracking-[-0.03em] text-[var(--auth-text)] font-heading',
  titleAccent:
    'bg-gradient-to-r from-cyan-600 to-emerald-600 dark:from-cyan-300 dark:to-emerald-300 bg-clip-text text-transparent',
  subtitle: 'mt-2 text-[0.95rem] leading-relaxed text-[var(--auth-muted)]',
  label: 'text-[var(--auth-muted)] text-sm font-medium block',
  link: 'text-sm text-cyan-700 hover:text-cyan-800 dark:text-cyan-400/90 dark:hover:text-cyan-300 transition-colors duration-500',
  input:
    'relative w-full pl-12 h-14 bg-[var(--auth-input-bg)] border border-[var(--auth-hairline)] text-[var(--auth-text)] placeholder:text-[var(--auth-muted)]/60 focus:border-cyan-500/50 dark:focus:border-cyan-400/50 focus:ring-[3px] focus:ring-cyan-500/15 dark:focus:ring-cyan-400/15 rounded-2xl transition-all duration-500 outline-none',
  inputIcon:
    'absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--auth-muted)] group-focus-within:text-cyan-600 dark:group-focus-within:text-cyan-400 transition-colors duration-500 z-10',
  inputGlow:
    'absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500',
  error:
    'p-3.5 text-sm text-red-700 dark:text-red-300 bg-red-500/10 border border-red-500/20 rounded-2xl',
  checkboxOn: 'bg-cyan-500 border-cyan-500 shadow-[0_0_12px_2px_rgba(6,182,212,0.28)]',
  checkboxOff:
    'border-[var(--auth-hairline)] bg-transparent hover:border-[var(--auth-muted)]',
  checkboxLabel: 'text-sm text-[var(--auth-muted)] cursor-pointer select-none',
  submitBtn:
    'relative w-full h-14 text-base font-semibold bg-[var(--auth-btn-bg)] text-[var(--auth-btn-fg)] border-0 rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-95 active:scale-[0.985]',
  submitShimmer:
    'absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent dark:via-black/[0.04] translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000',
  dividerLine: 'w-full border-t border-[var(--auth-hairline)]',
  dividerText:
    'bg-[var(--auth-panel)] px-4 text-[var(--auth-muted)] text-[10px] font-semibold uppercase tracking-[0.18em]',
  footer: 'text-[var(--auth-muted)] text-xs text-center',
  secondaryBtn:
    'w-full h-14 border border-[var(--auth-hairline)] bg-[var(--auth-input-bg)] text-[var(--auth-text)] hover:opacity-90 rounded-full transition-all duration-500 font-semibold',
} as const;
