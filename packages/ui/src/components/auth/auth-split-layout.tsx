import type { AuthVariant } from './auth-gradient-mesh';

interface AuthSplitLayoutProps {
  hero: React.ReactNode;
  children: React.ReactNode;
  variant?: AuthVariant;
}

/** Split auth layout — Ethereal Glass hero left, bezel form panel right */
export function AuthSplitLayout({ hero, children, variant = 'default' }: AuthSplitLayoutProps) {
  const panelAccent =
    variant === 'admin'
      ? 'before:from-emerald-400/20'
      : variant === 'crm'
        ? 'before:from-cyan-400/20'
        : 'before:from-cyan-400/15';

  return (
    <div className="flex min-h-screen flex-row bg-[var(--auth-bg,#050505)]">
      <div className="relative hidden bg-[var(--auth-bg,#050505)] lg:flex lg:w-[55%] xl:w-[58%]">
        {hero}
      </div>

      <div
        className={`relative w-full lg:w-[45%] xl:w-[42%] flex items-center justify-center px-6 py-10 sm:p-10 bg-[var(--auth-panel,#0a0a0a)] pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] border-l border-white/[0.06] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-32 before:bg-gradient-to-b ${panelAccent} before:to-transparent`}
      >
        <div className="relative z-10 w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
