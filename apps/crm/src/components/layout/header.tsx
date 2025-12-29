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
} from '@crm-eco/ui';
import { LogOut, Settings, User, ChevronDown } from 'lucide-react';

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
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  advisor: 'bg-green-100 text-green-700',
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
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{getPageTitle()}</h1>
      </div>
      
      {/* User Menu */}
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-3 h-auto py-2 px-3 hover:bg-slate-50">
              <Avatar className="h-9 w-9">
                <AvatarImage src={profile.avatarUrl || undefined} alt={profile.fullName} />
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white text-sm">
                  {getInitials(profile.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-slate-900">{profile.fullName}</p>
                <p className="text-xs text-slate-500 capitalize">{profile.role}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium leading-none">{profile.fullName}</p>
                  <Badge className={roleColors[profile.role] || roleColors.staff} variant="secondary">
                    {profile.role}
                  </Badge>
                </div>
                <p className="text-xs leading-none text-muted-foreground">{profile.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>My Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
