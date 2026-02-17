'use client';

import { useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@crm-eco/ui/lib/utils';

interface VirtualizedListProps<T> {
  /** Array of items to render */
  items: T[];
  /** Render function for each item */
  renderItem: (item: T, index: number) => ReactNode;
  /** Estimated height of each row in pixels */
  estimatedItemHeight?: number;
  /** Number of items to render outside the visible area */
  overscan?: number;
  /** Minimum number of items before virtualization kicks in */
  virtualizationThreshold?: number;
  /** Maximum height of the container */
  maxHeight?: number | string;
  /** Additional class names for the container */
  className?: string;
  /** Key extractor function */
  getItemKey?: (item: T, index: number) => string | number;
  /** Empty state component */
  emptyState?: ReactNode;
}

/**
 * A performant virtualized list component for rendering large datasets.
 * Only renders items that are visible in the viewport plus a configurable overscan.
 *
 * @example
 * ```tsx
 * <VirtualizedList
 *   items={activities}
 *   renderItem={(activity) => <ActivityRow activity={activity} />}
 *   estimatedItemHeight={56}
 *   maxHeight={600}
 *   getItemKey={(item) => item.id}
 * />
 * ```
 */
export function VirtualizedList<T>({
  items,
  renderItem,
  estimatedItemHeight = 56,
  overscan = 5,
  virtualizationThreshold = 50,
  maxHeight = 600,
  className,
  getItemKey,
  emptyState,
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  const shouldVirtualize = items.length > virtualizationThreshold;

  // eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-virtual returns mutable virtualizer by design
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => estimatedItemHeight,
    overscan,
    enabled: shouldVirtualize,
  });

  // Empty state
  if (items.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  // Non-virtualized rendering for small lists
  if (!shouldVirtualize) {
    return (
      <div className={cn('overflow-auto', className)} style={{ maxHeight }}>
        {items.map((item, index) => (
          <div key={getItemKey ? getItemKey(item, index) : index}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  // Virtualized rendering for large lists
  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto', className)}
      style={{ maxHeight }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={getItemKey ? getItemKey(item, virtualRow.index) : virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VirtualizedList;
