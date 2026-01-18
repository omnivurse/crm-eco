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
  Settings,
  ClipboardCheck,
  FilePlus,
  Sparkles,
} from 'lucide-react';
import type { UserRole } from '@/lib/auth';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[]; // If undefined, visible to all roles
}

interface NavSection {
  title: string | null;
  items: NavItem[];
}

const navSections: NavSection[] = [
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
      { name: 'Advisors', href: '/advisors', icon: UserCheck, roles: ['owner', 'admin', 'staff'] },
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
  {
    title: 'Enrollment',
    items: [
      { name: 'Enrollments', href: '/enrollments', icon: ClipboardCheck },
      { name: 'New Enrollment', href: '/enrollments/new', icon: FilePlus, roles: ['owner', 'admin', 'advisor'] },
    ],
  },
  {
    title: 'Operations',
    items: [
      { name: 'Vendors', href: '/vendors', icon: Building2, roles: ['owner', 'admin', 'staff'] },
    ],
  },
  {
    title: 'Admin',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings, roles: ['owner', 'admin'] },
    ],
  },
];

interface SidebarProps {
  role: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  // Filter sections and items based on role
  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        // If no roles specified, visible to all
        if (!item.roles) return true;
        // Check if current role is in the allowed roles
        return item.roles.includes(role);
      }),
    }))
    .filter((section) => section.items.length > 0); // Remove empty sections

  return (
    <aside className="w-64 bg-[#003560] text-white flex flex-col relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#003560] via-[#003560] to-[#002848] pointer-events-none" />
      
      {/* Content wrapper */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Logo with gradient accent stripe */}
        <div className="relative">
          {/* Gradient top stripe */}
          <div className="h-1 bg-gradient-to-r from-[#047474] via-[#069B9A] to-[#027343]" />
          
          <div className="h-16 flex items-center px-5 border-b border-white/10">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-[#047474] to-[#069B9A] rounded-xl flex items-center justify-center shadow-lg shadow-teal-900/30 group-hover:shadow-teal-800/40 transition-shadow">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg text-white tracking-tight">CRM-ECO</span>
                <span className="text-[10px] text-[#E9B61F] font-semibold tracking-widest uppercase">HealthShare</span>
              </div>
            </Link>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin">
          {filteredSections.map((section, sectionIdx) => (
            <div key={sectionIdx} className={cn(sectionIdx > 0 && 'mt-6')}>
              {section.title && (
                <h3 className="px-3 mb-2 text-[11px] font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-4 h-px bg-white/20" />
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
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-[#047474] text-white shadow-lg shadow-teal-900/20'
                          : 'text-white/70 hover:bg-[#002848] hover:text-white'
                      )}
                    >
                      <item.icon className={cn(
                        'w-5 h-5 transition-colors',
                        isActive ? 'text-white' : 'text-white/50'
                      )} />
                      {item.name}
                      {isActive && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#E9B61F]" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        
        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="px-3 py-3 bg-[#002848] rounded-xl border border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-[#E9B61F]" />
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Platform</p>
            </div>
            <p className="text-sm font-bold text-white">Phase 1 <span className="text-[#069B9A]">· v1.0.0</span></p>
          </div>
        </div>
      </div>
    </aside>
  );
}
