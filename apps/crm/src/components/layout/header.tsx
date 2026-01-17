'use client';

import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Badge,
  AppSwitcher,
} from '@crm-eco/ui';
import { LogOut, Settings, User, ChevronDown, Bell } from 'lucide-react';

interface HeaderProps {
  profile: {
    fullName: string;
    email: string;
    avatarUrl: string | null;
    role: string;
  };
}

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/members': 'Members',
  '/advisors': 'Advisors',
  '/leads': 'Leads',
  '/tickets': 'Tickets',
  '/needs': 'Need Requests',
};

const roleColors: Record<string, string> = {
  owner: 'bg-[#e0e7ec] text-[#003560]',
  admin: 'bg-[#e1f3f3] text-[#047474]',
  advisor: 'bg-[#e0f1ea] text-[#027343]',
  staff: 'bg-slate-100 text-slate-700',
};

export function Header({ profile }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPageTitle = () => {
    // Check exact match first
    if (pageTitles[pathname]) return pageTitles[pathname];

    // Check for partial matches (e.g., /members/123)
    for (const [path, title] of Object.entries(pageTitles)) {
      if (pathname.startsWith(path)) return title;
    }

    return 'Dashboard';
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm">
      {/* Left side - App Switcher + Page Title */}
      <div className="flex items-center gap-4">
        <AppSwitcher currentApp="crm" />
        <div className="h-6 w-px bg-slate-200 hidden sm:block" />
        <h1 className="text-xl font-bold text-[#003560] hidden sm:block">{getPageTitle()}</h1>
      </div>

      {/* Right side - Notifications + User Menu */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative hover:bg-slate-100 rounded-xl">
          <Bell className="h-5 w-5 text-slate-500" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-[#047474] rounded-full ring-2 ring-white" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-3 h-auto py-2 px-3 hover:bg-slate-50 rounded-xl">
              <Avatar className="h-9 w-9 ring-2 ring-[#047474]/20">
                <AvatarImage src={profile.avatarUrl || undefined} alt={profile.fullName} />
                <AvatarFallback className="bg-gradient-to-br from-[#047474] to-[#069B9A] text-white text-sm font-semibold">
                  {getInitials(profile.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-semibold text-[#003560]">{profile.fullName}</p>
                <p className="text-xs text-[#047474] capitalize font-medium">{profile.role}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 rounded-xl shadow-lg border-slate-200" align="end" forceMount>
            <DropdownMenuLabel className="font-normal px-4 py-3">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#003560]">{profile.fullName}</p>
                  <Badge className={`${roleColors[profile.role] || roleColors.staff} font-semibold`} variant="secondary">
                    {profile.role}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">{profile.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/profile')} className="cursor-pointer px-4 py-2.5 hover:bg-slate-50">
              <User className="mr-3 h-4 w-4 text-[#047474]" />
              <span className="font-medium">My Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')} className="cursor-pointer px-4 py-2.5 hover:bg-slate-50">
              <Settings className="mr-3 h-4 w-4 text-[#047474]" />
              <span className="font-medium">Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer px-4 py-2.5 text-red-600 focus:text-red-600 focus:bg-red-50">
              <LogOut className="mr-3 h-4 w-4" />
              <span className="font-medium">Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
