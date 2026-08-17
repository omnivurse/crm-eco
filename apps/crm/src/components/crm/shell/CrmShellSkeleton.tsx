export function CrmShellSkeleton() {
  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      <div className="h-[var(--crm-topbar-h,52px)] shrink-0 border-b border-border bg-card" />
      <div className="h-10 shrink-0 border-b border-border bg-muted/40" />
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-56 shrink-0 border-r border-border bg-card lg:block" />
        <div className="min-w-0 flex-1 space-y-3 p-4">
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}
