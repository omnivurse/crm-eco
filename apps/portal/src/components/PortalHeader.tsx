'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Heart, User, LogOut, Menu, X, ChevronDown, FileText, Users, Settings, CreditCard, LifeBuoy } from 'lucide-react';
import { Button, AppSwitcher, cn } from '@crm-eco/ui';
import { useState, useEffect } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';

const navItems = [
  { label: 'Dashboard', href: '/' },
  { label: 'Coverage', href: '/coverage' },
  { label: 'Billing', href: '/billing' },
  { label: 'Needs', href: '/needs' },
  { label: 'Support', href: '/support' },
];

export function PortalHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [memberName, setMemberName] = useState<string>('');
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        // Get member name
        const { data: profile } = await supabase
          .from('profiles')
          .select('member_id')
          .eq('user_id', user.id)
          .single() as { data: { member_id: string } | null };

        if (profile?.member_id) {
          const { data: member } = await supabase
            .from('members')
            .select('first_name, last_name')
            .eq('id', profile.member_id)
            .single() as { data: { first_name: string; last_name: string } | null };

          if (member) {
            setMemberName(`${member.first_name} ${member.last_name}`);
          }
        }
      }
    };
    
    fetchUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Left side - App Switcher + Logo */}
          <div className="flex items-center gap-3">
            {user && <AppSwitcher currentApp="portal" />}
            {user && <div className="h-6 w-px bg-slate-200 hidden sm:block" />}
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#047474] to-[#069B9A] flex items-center justify-center shadow-md">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <span className="font-bold text-[#003560]">WealthShare</span>
                <span className="text-xs text-[#E9B61F] font-semibold ml-2 tracking-wide">Member Portal</span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/' && pathname.startsWith(item.href));
              
              return (
                <Link 
                  key={item.href}
                  href={item.href} 
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-[#e1f3f3] text-[#047474]'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-[#003560]'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Menu */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2.5 hover:bg-slate-50 rounded-xl py-2 px-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#047474] to-[#069B9A] flex items-center justify-center text-white font-semibold text-sm ring-2 ring-[#047474]/20">
                      {memberName ? getInitials(memberName) : <User className="w-4 h-4" />}
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-semibold text-[#003560] block">{memberName || 'Account'}</span>
                      <span className="text-xs text-[#047474]">Member</span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-xl shadow-lg border-slate-200">
                  <DropdownMenuLabel className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-[#003560]">{memberName}</span>
                      <span className="text-xs text-slate-500">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/profile')} className="px-4 py-2.5 cursor-pointer hover:bg-slate-50">
                    <User className="mr-3 h-4 w-4 text-[#047474]" />
                    <span className="font-medium">My Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/dependents')} className="px-4 py-2.5 cursor-pointer hover:bg-slate-50">
                    <Users className="mr-3 h-4 w-4 text-[#047474]" />
                    <span className="font-medium">Dependents</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/documents')} className="px-4 py-2.5 cursor-pointer hover:bg-slate-50">
                    <FileText className="mr-3 h-4 w-4 text-[#047474]" />
                    <span className="font-medium">Documents</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/settings')} className="px-4 py-2.5 cursor-pointer hover:bg-slate-50">
                    <Settings className="mr-3 h-4 w-4 text-[#047474]" />
                    <span className="font-medium">Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="px-4 py-2.5 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                    <LogOut className="mr-3 h-4 w-4" />
                    <span className="font-medium">Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-[#003560] hover:bg-slate-100">Sign In</Button>
                </Link>
                <Link href="/enroll">
                  <Button size="sm" className="bg-[#047474] hover:bg-[#069B9A] text-white rounded-lg shadow-md">Enroll Now</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="md:hidden hover:bg-slate-100 rounded-lg"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-200">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/' && pathname.startsWith(item.href));
                
                return (
                  <Link 
                    key={item.href}
                    href={item.href} 
                    className={cn(
                      'px-4 py-2.5 text-sm font-medium rounded-lg',
                      isActive
                        ? 'bg-[#e1f3f3] text-[#047474]'
                        : 'text-slate-600 hover:bg-slate-100'
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
              
              <hr className="my-2 border-slate-200" />
              
              <Link 
                href="/profile" 
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-3"
                onClick={() => setMobileMenuOpen(false)}
              >
                <User className="w-4 h-4 text-[#047474]" />
                My Profile
              </Link>
              <Link 
                href="/dependents" 
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-3"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Users className="w-4 h-4 text-[#047474]" />
                Dependents
              </Link>
              <Link 
                href="/documents" 
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-3"
                onClick={() => setMobileMenuOpen(false)}
              >
                <FileText className="w-4 h-4 text-[#047474]" />
                Documents
              </Link>
              <Link 
                href="/settings" 
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-3"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Settings className="w-4 h-4 text-[#047474]" />
                Settings
              </Link>
              
              <hr className="my-2 border-slate-200" />
              
              {user ? (
                <button 
                  onClick={handleSignOut}
                  className="px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg text-left flex items-center gap-3"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              ) : (
                <>
                  <Link 
                    href="/login" 
                    className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link 
                    href="/enroll" 
                    className="px-4 py-2.5 text-sm font-medium bg-[#047474] text-white hover:bg-[#069B9A] rounded-lg text-center"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Enroll Now
                  </Link>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
