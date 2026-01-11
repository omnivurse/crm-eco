'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
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
  Command, 
  Bell, 
  LogOut, 
  User, 
  Settings, 
  HelpCircle,
  Sparkles,
  Plus,
  ChevronDown,
} from 'lucide-react';
import type { CrmProfile } from '@/lib/crm/types';

interface CrmHeaderProps {
  profile: CrmProfile;
  onOpenCommandPalette?: () => void;
}

export function CrmHeader({ profile, onOpenCommandPalette }: CrmHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/crm/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
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
        return 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border border-amber-500/30';
      case 'crm_manager':
        return 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-400 border border-teal-500/30';
      case 'crm_agent':
        return 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-400 border border-emerald-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border border-slate-500/30';
    }
  };

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case 'crm_admin':
        return 'Admin';
      case 'crm_manager':
        return 'Manager';
      case 'crm_agent':
        return 'Agent';
      case 'crm_viewer':
        return 'Viewer';
      default:
        return 'User';
    }
  };

  return (
    <header className="h-16 flex items-center justify-between px-6 glass border-b border-white/5">
      {/* Left side - Search */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <form onSubmit={handleSearch} className="relative flex-1">
          <div className={`
            relative flex items-center transition-all duration-300
            ${searchFocused ? 'scale-[1.02]' : 'scale-100'}
          `}>
            <Search className={`
              absolute left-4 w-4 h-4 transition-colors duration-200
              ${searchFocused ? 'text-teal-400' : 'text-slate-500'}
            `} />
            <Input
              type="search"
              placeholder="Search contacts, leads, deals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className={`
                pl-11 pr-20 h-11 rounded-xl border transition-all duration-200
                bg-slate-900/50 text-white placeholder:text-slate-500
                ${searchFocused 
                  ? 'border-teal-500/50 ring-2 ring-teal-500/20 bg-slate-900' 
                  : 'border-white/10 hover:border-white/20'
                }
              `}
            />
            <div className="absolute right-3 flex items-center gap-1">
              <kbd className="hidden sm:inline-flex h-6 select-none items-center gap-1 rounded-md border border-white/10 bg-slate-800 px-2 font-mono text-[10px] font-medium text-slate-400">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
          </div>
        </form>

        {/* Command Palette Button */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex h-10 w-10 rounded-xl bg-slate-900/50 border border-white/10 text-slate-400 hover:text-white hover:border-teal-500/30 hover:bg-slate-800 transition-all duration-200"
          onClick={onOpenCommandPalette}
          title="Command Palette (⌘K)"
        >
          <Command className="w-4 h-4" />
        </Button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Quick Create */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-9 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-medium transition-all duration-200 glow-sm hover:glow-md">
              <Plus className="w-4 h-4 mr-1.5" />
              Create
              <ChevronDown className="w-3 h-3 ml-1.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 glass border-white/10">
            <DropdownMenuItem className="text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer">
              New Contact
            </DropdownMenuItem>
            <DropdownMenuItem className="text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer">
              New Lead
            </DropdownMenuItem>
            <DropdownMenuItem className="text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer">
              New Deal
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem className="text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer">
              <Sparkles className="w-4 h-4 mr-2 text-teal-400" />
              Quick Import
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-10 w-10 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="flex items-center gap-3 h-10 px-2 rounded-xl hover:bg-white/5 transition-all duration-200"
            >
              <div className="relative">
                <Avatar className="w-8 h-8 border-2 border-teal-500/50">
                  <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name} />
                  <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-500 text-white text-xs font-semibold">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                {/* Online indicator */}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" />
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-sm font-medium text-white leading-none">{profile.full_name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{profile.email}</p>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-500 hidden lg:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 glass border-white/10">
            <DropdownMenuLabel className="pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 border-2 border-teal-500/50">
                  <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-500 text-white font-semibold">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{profile.full_name}</p>
                  <p className="text-xs text-slate-400 truncate">{profile.email}</p>
                </div>
              </div>
              <div className="mt-3">
                <span className={`inline-flex items-center text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider ${getRoleBadgeStyle(profile.crm_role)}`}>
                  <Sparkles className="w-3 h-3 mr-1" />
                  {getRoleLabel(profile.crm_role)}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem className="text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer py-2.5">
              <User className="w-4 h-4 mr-3" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => router.push('/crm/settings')}
              className="text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer py-2.5"
            >
              <Settings className="w-4 h-4 mr-3" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem className="text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer py-2.5">
              <HelpCircle className="w-4 h-4 mr-3" />
              Help & Support
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem 
              onClick={handleSignOut} 
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer py-2.5"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
