'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@crm-eco/ui';
import {
  LayoutDashboard,
  Users,
  UserCog,
  Package,
  FileText,
  Settings,
  CreditCard,
  BarChart3,
  Layers,
  Link as LinkIcon,
  Mail,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: { label: string; href: string }[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'Members', href: '/members', icon: <Users className="h-5 w-5" /> },
  { label: 'Agents', href: '/agents', icon: <UserCog className="h-5 w-5" /> },
  { label: 'Products', href: '/products', icon: <Package className="h-5 w-5" /> },
  { label: 'Enrollments', href: '/enrollments', icon: <FileText className="h-5 w-5" /> },
  { 
    label: 'Enrollment Links', 
    href: '/enrollment-links', 
    icon: <LinkIcon className="h-5 w-5" />,
    children: [
      { label: 'Landing Pages', href: '/enrollment-links' },
      { label: 'Agent Links', href: '/enrollment-links/agents' },
    ],
  },
  { label: 'Commissions', href: '/commissions', icon: <Layers className="h-5 w-5" /> },
  { label: 'Billing', href: '/billing', icon: <CreditCard className="h-5 w-5" /> },
  { 
    label: 'Communications', 
    href: '/communications', 
    icon: <Mail className="h-5 w-5" />,
    children: [
      { label: 'Dashboard', href: '/communications' },
      { label: 'Templates', href: '/communications/templates' },
      { label: 'History', href: '/communications/history' },
      { label: 'Compose', href: '/communications/compose' },
    ],
  },
  { label: 'Reports', href: '/reports', icon: <BarChart3 className="h-5 w-5" /> },
  { label: 'Settings', href: '/settings', icon: <Settings className="h-5 w-5" /> },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col">
      {/* Logo / Brand */}
      <div className="h-16 flex items-center px-6 border-b border-slate-700">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-lg">
            A
          </div>
          <span className="font-semibold text-lg">Admin Portal</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const hasChildren = item.children && item.children.length > 0;
          
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                {item.icon}
                {item.label}
              </Link>
              
              {/* Child items */}
              {hasChildren && isActive && (
                <div className="ml-8 mt-1 space-y-1">
                  {item.children!.map((child) => {
                    const isChildActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'block px-3 py-1.5 rounded-md text-sm transition-colors',
                          isChildActive
                            ? 'text-white bg-blue-500/50'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        )}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <p className="text-xs text-slate-400 text-center">
          Health Insurance Enrollment
        </p>
      </div>
    </aside>
  );
}
