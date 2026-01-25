'use client';

import Link from 'next/link';
import Image from 'next/image';
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
  Shield,
  Sparkles,
  Building2,
  Terminal,
} from 'lucide-react';
import { useTerminal } from '@/components/terminal';

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
  { label: 'Vendors', href: '/vendors', icon: <Building2 className="h-5 w-5" /> },
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
  const { toggle: toggleTerminal } = useTerminal();

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

          <div className="h-16 flex items-center px-4 border-b border-white/10">
            <Link href="/dashboard" className="flex items-center group">
              <Image
                src="/logo-pif-full.png"
                alt="Pay It Forward HealthShare"
                width={180}
                height={48}
                className="object-contain max-h-10 w-auto"
                priority
              />
            </Link>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const hasChildren = item.children && item.children.length > 0;
            
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-[#047474] text-white shadow-lg shadow-teal-900/20'
                      : 'text-white/70 hover:bg-[#002848] hover:text-white'
                  )}
                >
                  <span className={cn(
                    'transition-colors',
                    isActive ? 'text-white' : 'text-white/50'
                  )}>
                    {item.icon}
                  </span>
                  {item.label}
                  {isActive && !hasChildren && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#E9B61F]" />
                  )}
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
                            'block px-3 py-1.5 rounded-md text-sm transition-all duration-200',
                            isChildActive
                              ? 'text-white bg-[#047474]/50'
                              : 'text-white/50 hover:text-white hover:bg-[#002848]'
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

        {/* Command Center Button */}
        <div className="px-3 pb-2">
          <button
            onClick={toggleTerminal}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-cyan-400 hover:bg-cyan-900/30 hover:text-cyan-300"
            title="Command Center (Ctrl+K)"
          >
            <Terminal className="w-5 h-5" />
            <span>Command Center</span>
            <kbd className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded">^K</kbd>
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="px-3 py-3 bg-[#002848] rounded-xl border border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-[#E9B61F]" />
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">System</p>
            </div>
            <p className="text-sm font-bold text-white">Admin <span className="text-[#069B9A]">· v1.0.0</span></p>
          </div>
        </div>
      </div>
    </aside>
  );
}
