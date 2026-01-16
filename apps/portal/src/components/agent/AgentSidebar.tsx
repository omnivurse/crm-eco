'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@crm-eco/ui';
import {
  LayoutDashboard,
  Users,
  FileText,
  DollarSign,
  Network,
  User,
  Settings,
  Link as LinkIcon,
  BarChart3,
  LogOut,
  Heart,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/agent', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'My Members', href: '/agent/members', icon: <Users className="h-5 w-5" /> },
  { label: 'Enrollments', href: '/agent/enrollments', icon: <FileText className="h-5 w-5" /> },
  { label: 'Commissions', href: '/agent/commissions', icon: <DollarSign className="h-5 w-5" /> },
  { label: 'Enrollment Links', href: '/agent/links', icon: <LinkIcon className="h-5 w-5" /> },
  { label: 'Downline', href: '/agent/downline', icon: <Network className="h-5 w-5" /> },
  { label: 'Reports', href: '/agent/reports', icon: <BarChart3 className="h-5 w-5" /> },
];

const bottomNavItems: NavItem[] = [
  { label: 'Profile', href: '/agent/profile', icon: <User className="h-5 w-5" /> },
  { label: 'Settings', href: '/agent/settings', icon: <Settings className="h-5 w-5" /> },
];

interface AgentSidebarProps {
  agent?: {
    id: string;
    first_name: string;
    last_name: string;
    company_name?: string | null;
    logo_url?: string | null;
    primary_color?: string;
  };
}

export function AgentSidebar({ agent }: AgentSidebarProps) {
  const pathname = usePathname();

  const primaryColor = agent?.primary_color || '#1e40af';

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col min-h-screen">
      {/* Logo / Brand */}
      <div className="h-16 flex items-center px-6 border-b border-slate-700">
        <Link href="/agent" className="flex items-center gap-3">
          {agent?.logo_url ? (
            <img 
              src={agent.logo_url} 
              alt={agent.company_name || 'Agent'} 
              className="w-8 h-8 rounded-lg object-contain"
            />
          ) : (
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg"
              style={{ backgroundColor: primaryColor }}
            >
              <Heart className="w-4 h-4" />
            </div>
          )}
          <span className="font-semibold text-lg truncate">
            {agent?.company_name || 'Agent Portal'}
          </span>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/agent' && pathname.startsWith(`${item.href}/`));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
              style={isActive ? { backgroundColor: primaryColor } : undefined}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Navigation */}
      <div className="px-3 py-4 border-t border-slate-700 space-y-1">
        {bottomNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
              style={isActive ? { backgroundColor: primaryColor } : undefined}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Agent Info Footer */}
      {agent && (
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
              style={{ backgroundColor: primaryColor }}
            >
              {agent.first_name.charAt(0)}{agent.last_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {agent.first_name} {agent.last_name}
              </p>
              <p className="text-xs text-slate-400">
                Agent ID: {agent.id}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
