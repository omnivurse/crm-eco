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
import { Search, Command, Bell, LogOut, User, Settings, HelpCircle } from 'lucide-react';
import type { CrmProfile } from '@/lib/crm/types';

interface CrmHeaderProps {
  profile: CrmProfile;
  onOpenCommandPalette?: () => void;
}

export function CrmHeader({ profile, onOpenCommandPalette }: CrmHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
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
      // Navigate to search results
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
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

  const getRoleBadgeColor = (role: string | null) => {
    switch (role) {
      case 'crm_admin':
        return 'bg-brand-gold-500 text-brand-navy-900';
      case 'crm_manager':
        return 'bg-brand-teal-500 text-white';
      case 'crm_agent':
        return 'bg-brand-emerald-500 text-white';
      default:
        return 'bg-gray-400 text-white';
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
    <header className="h-16 border-b bg-white flex items-center justify-between px-6">
      {/* Search */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-20 h-10 bg-muted/50 border-0 focus-visible:bg-white focus-visible:ring-1"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </form>
        <Button
          variant="outline"
          size="icon"
          className="hidden md:flex"
          onClick={onOpenCommandPalette}
          title="Command Palette (⌘K)"
        >
          <Command className="w-4 h-4" />
        </Button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-brand-teal-500 rounded-full" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-3 h-10 px-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name} />
                <AvatarFallback className="bg-brand-teal-500 text-white text-xs">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium leading-none">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground">{profile.email}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex items-center gap-2">
                <span>My Account</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${getRoleBadgeColor(profile.crm_role)}`}>
                  {getRoleLabel(profile.crm_role)}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="w-4 h-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem>
              <HelpCircle className="w-4 h-4 mr-2" />
              Help & Support
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
