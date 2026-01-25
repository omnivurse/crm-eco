import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  path: string;
}

export function Breadcrumbs() {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  const breadcrumbs: BreadcrumbItem[] = [];

  const routeLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    tickets: 'Tickets',
    new: 'New',
    workspace: 'Workspace',
    kb: 'Knowledge Base',
    catalog: 'Service Catalog',
    problems: 'Problems',
    changes: 'Changes',
    requests: 'Requests',
    analytics: 'Analytics',
    admin: 'Administration',
    users: 'Users',
    workflows: 'Workflows',
    settings: 'Settings',
    'sla-insights': 'SLA Insights',
    audit: 'Audit Logs',
    'staff-logs': 'Staff Logs',
    chat: 'Chat Management',
    collaboration: 'Collaboration',
    reports: 'Reports',
    services: 'Services',
    sla: 'SLA Policies',
    integrations: 'Integrations',
    roles: 'Roles',
    health: 'System Health',
    flows: 'Flows',
    calendar: 'Calendar',
  };

  // Only add home if we're not on the dashboard
  if (location.pathname !== '/dashboard') {
    breadcrumbs.push({ label: 'Home', path: '/dashboard' });
  }

  let currentPath = '';
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const label = routeLabels[segment] || `#${segment.substring(0, 8)}`;
    if (index < pathSegments.length - 1 || pathSegments.length === 1) {
      breadcrumbs.push({ label, path: currentPath });
    }
  });

  if (breadcrumbs.length === 1) return null;

  return (
    <nav className="flex items-center gap-2 text-sm mb-4">
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.path} className="flex items-center gap-2">
          {index > 0 && (
            <ChevronRight size={16} className="text-neutral-400" />
          )}
          {index === 0 ? (
            <Link
              to={crumb.path}
              className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 flex items-center gap-1"
            >
              <Home size={16} />
            </Link>
          ) : index === breadcrumbs.length - 1 ? (
            <span className="text-neutral-900 dark:text-white font-medium">
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
