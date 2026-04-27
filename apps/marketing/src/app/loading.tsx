export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex items-center gap-3 text-helix-mist">
        <span className="h-2 w-2 animate-pulse-soft rounded-full bg-helix-cyan-300" />
        <span className="font-mono text-[11px] uppercase tracking-[0.22em]">
          Initialising helix…
        </span>
      </div>
    </div>
  );
}
