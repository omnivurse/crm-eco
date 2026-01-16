'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import { Avatar, AvatarFallback, AvatarImage } from '@crm-eco/ui/components/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  Search,
  Bell,
  LogOut,
  User,
  Settings,
  HelpCircle,
  Sparkles,
  Plus,
  ChevronDown,
  Heart,
  Command,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { ModuleTabs } from './ModuleTabs';
import { NotificationsPanel } from '../NotificationsPanel';
import { GlobalSearchOverlay } from '@/components/zoho/GlobalSearchOverlay';
import { QuickCreateDrawer } from '@/components/zoho/QuickCreateDrawer';
import type { CrmModule, CrmProfile } from '@/lib/crm/types';

interface CrmTopBarProps {
  modules: CrmModule[];
  profile: CrmProfile;
  organizationName?: string;
  onOpenCommandPalette?: () => void;
}

export function CrmTopBar({ 
  modules, 
  profile, 
  organizationName,
  onOpenCommandPalette 
}: CrmTopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/crm-login');
    router.refresh();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeStyle = (role: string | null) => {
    switch (role) {
      case 'crm_admin':
        return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30';
      case 'crm_manager':
        return 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30';
      case 'crm_agent':
        return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30';
      default:
        return 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-500/30';
    }
  };

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case 'crm_admin': return 'Admin';
      case 'crm_manager': return 'Manager';
      case 'crm_agent': return 'Agent';
      case 'crm_viewer': return 'Viewer';
      default: return 'User';
    }
  };

  return (
    <header className="h-14 flex items-center justify-between px-4 glass border-b border-slate-200 dark:border-white/5">
      {/* Left Section: Brand + Module Tabs */}
      <div className="flex items-center gap-4">
        {/* Brand */}
        <Link href="/crm" className="flex items-center gap-2.5 mr-2 group">
          <div className="relative flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden gradient-primary p-[1px] group-hover:shadow-lg transition-all duration-300">
            <div className="w-full h-full rounded-[6px] bg-white dark:bg-slate-900 flex items-center justify-center">
              <Heart className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
          </div>
          <div className="hidden md:block">
            <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
              {organizationName || 'Pay It Forward'}
            </h1>
          </div>
        </Link>

        {/* Module Tabs */}
        <ModuleTabs modules={modules} />
      </div>

      {/* Right Section: Search + Actions */}
      <div className="flex items-center gap-2">
        {/* Visible Search Button - Opens GlobalSearchOverlay */}
        <button
          onClick={() => setSearchOpen(true)}
          className={cn(
            'hidden md:flex items-center gap-2 px-3 h-9 rounded-lg border text-sm transition-all cursor-pointer',
            'bg-white dark:bg-slate-900/50 text-slate-500 dark:text-slate-400',
            'border-slate-200 dark:border-white/10',
            'hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400'
          )}
        >
          <Search className="w-4 h-4" />
          <span className="hidden lg:inline">Search records...</span>
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-1.5 font-mono text-[10px] text-slate-400 ml-4">
            ⌘K
          </kbd>
        </button>

        {/* Search - Mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="w-4 h-4" />
        </Button>

        {/* Quick Create Button */}
        <Button 
          size="sm"
          onClick={() => setQuickCreateOpen(true)}
          className="h-9 px-3 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-medium shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          <span className="hidden sm:inline">Create</span>
        </Button>

        {/* Theme Toggle */}
        <ThemeToggle variant="icon" />

        {/* Notifications */}
        <NotificationsPanel />

        {/* Settings Gear */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
          onClick={() => router.push('/crm/settings')}
        >
          <Settings className="w-4 h-4" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="flex items-center gap-2 h-9 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <Avatar className="w-7 h-7 border border-teal-500/50">
                <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name} />
                <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-500 text-white text-xs font-semibold">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
            <DropdownMenuLabel className="pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 border-2 border-teal-500/50">
                  <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-500 text-white font-semibold">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{profile.full_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{profile.email}</p>
                </div>
              </div>
              <div className="mt-3">
                <span className={cn('inline-flex items-center text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider', getRoleBadgeStyle(profile.crm_role))}>
                  <Sparkles className="w-3 h-3 mr-1" />
                  {getRoleLabel(profile.crm_role)}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
            <DropdownMenuItem className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer py-2">
              <User className="w-4 h-4 mr-3" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => router.push('/crm/settings')}
              className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer py-2"
            >
              <Settings className="w-4 h-4 mr-3" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer py-2">
              <HelpCircle className="w-4 h-4 mr-3" />
              Help & Support
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
            <DropdownMenuItem 
              onClick={handleSignOut} 
              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer py-2"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Global Search Overlay */}
      <GlobalSearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Quick Create Drawer */}
      <QuickCreateDrawer open={quickCreateOpen} onOpenChange={setQuickCreateOpen} />
    </header>
  );
}
