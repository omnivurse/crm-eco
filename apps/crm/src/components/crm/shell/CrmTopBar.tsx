'use client';

import { useState, useEffect, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { cn } from '@crm-eco/ui/lib/utils';
import { BrandLogo } from '@crm-eco/ui/components/brand-logo';
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
  LogOut,
  User,
  Settings,
  HelpCircle,
  Sparkles,
  ChevronDown,
  Menu,
  X,
  BookOpen,
  MessageCircle,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { ThemeToggle } from './ThemeToggle';
import { SplitCreateButton } from './SplitCreateButton';
import { ConnectivityModeToggle } from '@/components/crm/offline/ConnectivityModeToggle';
import { PendingChangesPill } from '@/components/crm/offline/PendingChangesPill';
import { clearOfflineState } from '@/lib/offline/reset';
import { openCrmCommandPalette } from '@/lib/crm/command-palette-bus';
import type { CrmModule, CrmProfile } from '@/lib/crm/types';

function openCommandPalette(onOpenCommandPalette?: () => void) {
  if (onOpenCommandPalette) onOpenCommandPalette();
  else openCrmCommandPalette();
}

// Lazy load heavy components - only loaded when user interacts
const NotificationsPanel = dynamic(
  () => import('../NotificationsPanel').then((mod) => mod.NotificationsPanel),
  { ssr: false }
);
const QuickCreateDrawer = dynamic(
  () => import('@/components/zoho/QuickCreateDrawer').then((mod) => mod.QuickCreateDrawer),
  { ssr: false }
);

interface CrmTopBarProps {
  modules: CrmModule[];
  profile: CrmProfile;
  onOpenCommandPalette?: () => void;
  mobileMenuOpen?: boolean;
  onMobileMenuToggle?: () => void;
}

export const CrmTopBar = memo(function CrmTopBar({
  modules,
  profile,
  onOpenCommandPalette,
  mobileMenuOpen,
  onMobileMenuToggle,
}: CrmTopBarProps) {
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const router = useRouter();

  // ⌘K / Ctrl+K — global command palette (search, navigate, workflows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openCommandPalette(onOpenCommandPalette);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenCommandPalette]);

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout', email: profile.email }),
      });
    } catch (err) {
      console.error('Failed to log logout:', err);
    }
    try {
      await clearOfflineState();
    } catch (err) {
      console.error('Failed to clear offline state on sign-out:', err);
    }
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
    <header className="relative z-40 h-12 flex items-center px-3 sm:px-4 lg:px-5 xl:px-6 glass border-b border-slate-200/80 dark:border-white/5 shrink-0">
      {/* Mobile Menu Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden h-8 w-8 mr-2 rounded-md text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        onClick={onMobileMenuToggle}
        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Left Section: Logo */}
      <Link prefetch={false} href="/crm" className="flex items-center gap-2 group flex-shrink-0">
        <BrandLogo variant="full" size="sm" priority />
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right Section: Search + Actions */}
      <div className="flex items-center gap-1 lg:gap-2">
        {/* Search Button — opens global search overlay */}
        <button
          onClick={() => openCommandPalette(onOpenCommandPalette)}
          className="hidden sm:flex items-center gap-2 h-8 px-2.5 rounded-md border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-[13px] min-w-[160px] lg:min-w-[220px]"
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Search or start a workflow…</span>
          <kbd className="ml-auto hidden lg:inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded px-1.5 py-0.5">
            ⌘K
          </kbd>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden h-8 w-8 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
          onClick={() => openCommandPalette(onOpenCommandPalette)}
          title="Search (⌘K)"
        >
          <Search className="w-4 h-4" />
        </Button>

        {/* Split Create Button - hidden on mobile */}
        <div className="hidden sm:block">
          <SplitCreateButton />
        </div>

        {/* Theme Toggle - hidden on the narrowest mobile widths.
            (`xs` is not a defined breakpoint, so the old `xs:block` never
            applied and the toggle was hidden at every width.) */}
        <div className="hidden sm:block">
          <ThemeToggle variant="icon" />
        </div>

        {/* The connectivity/offline simulator is a dev-only testing aid —
            don't ship it in production builds. */}
        {process.env.NODE_ENV !== 'production' && (
          <ConnectivityModeToggle className="hidden sm:flex" />
        )}

        {/* Pending changes pill — auto-hides when the mutation queue
            is empty, so it only appears when the user actually has
            offline/retrying work to review. */}
        <PendingChangesPill />

        {/* Notifications */}
        <NotificationsPanel />

        {/* Settings Gear - hidden on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:flex h-8 w-8 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
          onClick={() => router.push('/crm/settings')}
        >
          <Settings className="w-4 h-4" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-1.5 h-8 px-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/10"
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
            <DropdownMenuItem
              onClick={() => router.push('/crm/profile')}
              className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer py-2"
            >
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
            <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
            <DropdownMenuItem
              onClick={() => router.push('/crm/features')}
              className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer py-2"
            >
              <Sparkles className="w-4 h-4 mr-3" />
              Features
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push('/crm/learn')}
              className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer py-2"
            >
              <BookOpen className="w-4 h-4 mr-3" />
              Learn
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push('/crm/learn/getting-started')}
              className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer py-2"
            >
              <HelpCircle className="w-4 h-4 mr-3" />
              Help
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => window.open('mailto:support@doublehelixhub.com', '_self')}
              className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer py-2"
            >
              <MessageCircle className="w-4 h-4 mr-3" />
              Support
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

      {/* Quick Create Drawer */}
      <QuickCreateDrawer open={quickCreateOpen} onOpenChange={setQuickCreateOpen} />
    </header>
  );
});
