'use client';

import { 
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  AppSwitcher,
  Badge,
} from '@crm-eco/ui';
import { Bell, User, LogOut, Settings, ChevronDown, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

interface AdminTopNavProps {
  profile: {
    fullName: string;
    email: string;
    avatarUrl?: string | null;
    role: string;
  };
}

const roleColors: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  admin: 'bg-[#e1f3f3] text-[#047474]',
  manager: 'bg-[#e0f1ea] text-[#027343]',
  user: 'bg-slate-100 text-slate-700',
};

export function AdminTopNav({ profile }: AdminTopNavProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const initials = profile.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm">
      {/* Left side - App Switcher + Title */}
      <div className="flex items-center gap-4">
        <AppSwitcher currentApp="admin" />
        <div className="h-6 w-px bg-slate-200 hidden sm:block" />
        <div className="hidden sm:flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#047474]" />
          <span className="text-sm font-semibold text-[#003560]">System Administration</span>
        </div>
      </div>

      {/* Right side - actions and user menu */}
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
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#047474] to-[#069B9A] flex items-center justify-center text-sm font-semibold text-white ring-2 ring-[#047474]/20">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.fullName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-semibold text-[#003560]">{profile.fullName}</p>
                <p className="text-xs text-[#047474] capitalize font-medium">{profile.role}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-xl shadow-lg border-slate-200">
            <DropdownMenuLabel className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-[#003560]">{profile.fullName}</p>
                <Badge className={`${roleColors[profile.role] || roleColors.user} font-semibold`} variant="secondary">
                  {profile.role}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">{profile.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')} className="px-4 py-2.5 cursor-pointer hover:bg-slate-50">
              <Settings className="h-4 w-4 mr-3 text-[#047474]" />
              <span className="font-medium">Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/profile')} className="px-4 py-2.5 cursor-pointer hover:bg-slate-50">
              <User className="h-4 w-4 mr-3 text-[#047474]" />
              <span className="font-medium">Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="px-4 py-2.5 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
              <LogOut className="h-4 w-4 mr-3" />
              <span className="font-medium">Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
