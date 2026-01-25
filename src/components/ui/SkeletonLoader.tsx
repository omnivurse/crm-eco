export function SkeletonLoader() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-4"></div>
      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2 mb-4"></div>
      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-5/6"></div>
    </div>
  );
}

export function TicketListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 animate-pulse"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
            </div>
            <div className="h-6 w-20 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24"></div>
            <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-32"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 animate-pulse">
      <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3 mb-4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-full"></div>
        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-5/6"></div>
        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-4/6"></div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      <div className="border-b border-neutral-200 dark:border-neutral-700 p-4 animate-pulse">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded flex-1"></div>
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="border-b border-neutral-200 dark:border-neutral-700 p-4 animate-pulse"
        >
          <div className="flex gap-4">
            {Array.from({ length: cols }).map((_, colIndex) => (
              <div key={colIndex} className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded flex-1"></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
