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
  Heart,
  Sparkles,
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

  return (
    <aside className="w-64 bg-[#003560] text-white flex flex-col min-h-screen relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#003560] via-[#003560] to-[#002848] pointer-events-none" />
      
      {/* Content wrapper */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Logo with gradient accent stripe */}
        <div className="relative">
          {/* Gradient top stripe */}
          <div className="h-1 bg-gradient-to-r from-[#047474] via-[#069B9A] to-[#027343]" />
          
          <div className="h-16 flex items-center px-5 border-b border-white/10">
            <Link href="/agent" className="flex items-center gap-3 group">
              {agent?.logo_url ? (
                <img 
                  src={agent.logo_url} 
                  alt={agent.company_name || 'Agent'} 
                  className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-[#047474] to-[#069B9A] rounded-xl flex items-center justify-center shadow-lg shadow-teal-900/30 group-hover:shadow-teal-800/40 transition-shadow">
                  <Heart className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-bold text-lg text-white tracking-tight truncate max-w-[140px]">
                  {agent?.company_name || 'Agent Portal'}
                </span>
                <span className="text-[10px] text-[#E9B61F] font-semibold tracking-widest uppercase">Portal</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/agent' && pathname.startsWith(`${item.href}/`));
            
            return (
              <Link
                key={item.href}
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
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#E9B61F]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Navigation */}
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            
            return (
              <Link
                key={item.href}
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
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#E9B61F]" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Agent Info Footer */}
        {agent && (
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 px-3 py-3 bg-[#002848] rounded-xl border border-white/5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#047474] to-[#069B9A] flex items-center justify-center text-white font-semibold shadow-lg">
                {agent.first_name.charAt(0)}{agent.last_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {agent.first_name} {agent.last_name}
                </p>
                <p className="text-xs text-[#069B9A] font-medium">
                  ID: {agent.id}
                </p>
              </div>
              <Sparkles className="w-4 h-4 text-[#E9B61F]" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
