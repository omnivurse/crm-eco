interface AuthSplitLayoutProps {
  hero: React.ReactNode;
  children: React.ReactNode;
}

/** Standard split auth layout — dark hero left, form panel right */
export function AuthSplitLayout({ hero, children }: AuthSplitLayoutProps) {
  return (
    <div className="min-h-screen flex flex-row bg-[var(--auth-bg,#030712)]">
      <div className="hidden lg:flex lg:w-[55%] xl:w-[58%] relative bg-[var(--auth-bg,#030712)]">
        {hero}
      </div>

      <div className="w-full lg:w-[45%] xl:w-[42%] flex items-center justify-center p-8 bg-[var(--auth-panel,#0a1628)]">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
