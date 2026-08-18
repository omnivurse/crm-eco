/**
 * The class map every auth form spreads onto its own markup.
 *
 * Nine files across four apps consume these strings, so the KEYS and the
 * shape are frozen — only the values changed. They now name real CSS classes
 * defined in packages/ui/src/styles/auth.css instead of Tailwind literals.
 *
 * Why that mattered: the CRM and Admin consoles remap Tailwind's `cyan` and
 * `teal` scales onto Muted Spruce (see `consoleColors` in
 * packages/ui/tailwind.preset.ts), so `text-cyan-700` on a sign-in page
 * painted #204e57, not the brand cyan. Auth literally could not match the
 * landings while it was written in Tailwind colour utilities. Every value
 * below resolves through the `--auth-*` tokens, which derive from `--lp-*`.
 *
 * Utilities appended at a call site still win: `@tailwind utilities` is
 * emitted after this file's `@import` in every app's globals.css, so
 * `${authForm.input} pr-12` behaves exactly as it did.
 */

export const authForm = {
  title: 'auth-title',
  titleAccent: 'auth-title-accent',
  subtitle: 'auth-subtitle',
  label: 'auth-label',
  link: 'auth-link',
  input: 'auth-field',
  inputIcon: 'auth-field-icon',
  inputGlow: 'auth-field-glow',
  error: 'auth-alert',
  checkboxOn: 'auth-checkbox-on',
  checkboxOff: 'auth-checkbox-off',
  checkboxLabel: 'auth-checkbox-label',
  submitBtn: 'auth-btn-primary',
  submitShimmer: 'auth-btn-shimmer',
  dividerLine: 'auth-divider-line',
  dividerText: 'auth-divider-text',
  footer: 'auth-footer',
  secondaryBtn: 'auth-btn-secondary',

  /* --- added --- */
  /** Mono eyebrow above a form title (e.g. "CRM CORE"). */
  eyebrow: 'auth-eyebrow',
  /** 44px trailing control inside a field (show/hide password). */
  fieldAffix: 'auth-field-affix',
  /** Emphasis inside body copy that must stay readable in both themes. */
  strong: 'auth-strong',
} as const;
