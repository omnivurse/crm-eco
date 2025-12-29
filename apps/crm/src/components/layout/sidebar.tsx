'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@crm-eco/ui';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  UserPlus,
  Ticket,
  HeartPulse,
  Building2,
} from 'lucide-react';

const navSections = [
  {
    title: null,
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'People',
    items: [
      { name: 'Members', href: '/members', icon: Users },
      { name: 'Advisors', href: '/advisors', icon: UserCheck },
      { name: 'Leads', href: '/leads', icon: UserPlus },
    ],
  },
  {
    title: 'Service',
    items: [
      { name: 'Tickets', href: '/tickets', icon: Ticket },
    ],
  },
  {
    title: 'Needs',
    items: [
      { name: 'Need Requests', href: '/needs', icon: HeartPulse },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-slate-200">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-sm">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg text-slate-900 tracking-tight">CRM-ECO</span>
            <span className="text-[10px] text-slate-500 -mt-0.5 tracking-wide">HEALTHSHARE</span>
          </div>
        </Link>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navSections.map((section, sectionIdx) => (
          <div key={sectionIdx} className={cn(sectionIdx > 0 && 'mt-6')}>
            {section.title && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    )}
                  >
                    <item.icon className={cn('w-5 h-5', isActive ? 'text-white' : 'text-slate-400')} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      
      {/* Footer */}
      <div className="p-4 border-t border-slate-200">
        <div className="px-3 py-2.5 bg-slate-50 rounded-lg">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Platform</p>
          <p className="text-sm font-semibold text-slate-700">Phase 0 · v0.1.0</p>
        </div>
      </div>
    </aside>
  );
}
