'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@crm-eco/ui';

interface BreadcrumbItem {
  label: string;
  href: string;
}

// Map of path segments to human-readable labels
const pathLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  members: 'Members',
  agents: 'Agents',
  products: 'Products',
  enrollments: 'Enrollments',
  billing: 'Billing',
  reports: 'Reports',
  settings: 'Settings',
  new: 'New',
  edit: 'Edit',
};

// Function to format UUIDs or IDs for display
function formatId(segment: string): string {
  // Check if it looks like a UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    return `#${segment.substring(0, 8)}...`;
  }
  // Check if it's a numeric ID
  if (/^\d+$/.test(segment)) {
    return `#${segment}`;
  }
  return segment;
}

export function Breadcrumbs() {
  const pathname = usePathname();

  // Skip rendering if we're on the dashboard root
  if (pathname === '/dashboard' || pathname === '/') {
    return null;
  }

  // Split the pathname into segments
  const segments = pathname.split('/').filter(Boolean);

  // Build breadcrumb items
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', href: '/dashboard' },
  ];

  let currentPath = '';
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    // Get the label from our map, or format the segment
    let label = pathLabels[segment];
    if (!label) {
      // Check if this might be an ID (preceded by a known entity type)
      const previousSegment = segments[i - 1];
      if (previousSegment && ['members', 'agents', 'products', 'enrollments'].includes(previousSegment)) {
        label = formatId(segment);
      } else {
        // Capitalize the segment
        label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
      }
    }

    breadcrumbs.push({
      label,
      href: currentPath,
    });
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center space-x-1 text-sm text-muted-foreground">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const isFirst = index === 0;

          return (
            <li key={crumb.href} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 mx-1 flex-shrink-0" />
              )}
              {isLast ? (
                <span
                  className={cn(
                    'font-medium text-foreground',
                    isFirst && 'flex items-center gap-1'
                  )}
                  aria-current="page"
                >
                  {isFirst && <Home className="h-4 w-4" />}
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className={cn(
                    'hover:text-foreground transition-colors',
                    isFirst && 'flex items-center gap-1'
                  )}
                >
                  {isFirst && <Home className="h-4 w-4" />}
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
