'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { User, LogOut, Menu, X, ChevronDown, FileText, Users, Settings } from 'lucide-react';
import { Button, cn } from '@crm-eco/ui';
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

// MANAGE-ONLY PORTAL: enrollment is NOT self-serve here — prospects enroll via the
// public enrollment software on the website. "Enroll Now" points off-site to that
// URL (env-configurable, external absolute), so it uses a plain <a> not next/link.
const ENROLLMENT_URL =
  process.env.NEXT_PUBLIC_ENROLLMENT_URL || 'https://www.doublehelixhub.com/enroll';

const navItems = [
  { label: 'Dashboard', href: '/' },
  { label: 'Coverage', href: '/coverage' },
  { label: 'Services', href: '/services' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Billing', href: '/billing' },
  { label: 'Needs', href: '/needs' },
  { label: 'Support', href: '/support' },
];

const AUTH_ROUTE_PREFIXES = [
  '/signin',
  '/signup',
  '/login',
  '/reset-password',
  '/update-password',
  '/access-denied',
];

export function PortalHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [memberName, setMemberName] = useState<string>('');
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const isAuthRoute = AUTH_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

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
    
    queueMicrotask(() => fetchUser());
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.assign('/signin');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isAuthRoute) {
    return null;
  }

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
      <div className="mx-auto w-full max-w-[1536px] px-3 sm:px-4 lg:px-6 xl:px-8 2xl:px-10">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Logo */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="Double Helix Hub"
                width={180}
                height={48}
                className="h-10 w-auto object-contain"
                priority
              />
              <span className="hidden sm:inline text-xs text-[#E9B61F] font-semibold tracking-wide">Member Portal</span>
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
                      ? 'bg-cyan-500/10 text-cyan-600'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-dhh-ink'
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
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-semibold text-sm ring-2 ring-cyan-500/20">
                      {memberName ? getInitials(memberName) : <User className="w-4 h-4" />}
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-semibold text-dhh-ink block">{memberName || 'Account'}</span>
                      <span className="text-xs text-cyan-600">Member</span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-xl shadow-lg border-slate-200">
                  <DropdownMenuLabel className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-dhh-ink">{memberName}</span>
                      <span className="text-xs text-slate-500">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/profile')} className="px-4 py-2.5 cursor-pointer hover:bg-slate-50">
                    <User className="mr-3 h-4 w-4 text-cyan-600" />
                    <span className="font-medium">My Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/dependents')} className="px-4 py-2.5 cursor-pointer hover:bg-slate-50">
                    <Users className="mr-3 h-4 w-4 text-cyan-600" />
                    <span className="font-medium">Dependents</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/documents')} className="px-4 py-2.5 cursor-pointer hover:bg-slate-50">
                    <FileText className="mr-3 h-4 w-4 text-cyan-600" />
                    <span className="font-medium">Documents</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/settings')} className="px-4 py-2.5 cursor-pointer hover:bg-slate-50">
                    <Settings className="mr-3 h-4 w-4 text-cyan-600" />
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
                <Link href="/signin">
                  <Button variant="ghost" size="sm" className="text-dhh-ink hover:bg-slate-100">Sign In</Button>
                </Link>
                <a href={ENROLLMENT_URL}>
                  <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-lg shadow-md">Enroll Now</Button>
                </a>
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
                        ? 'bg-cyan-500/10 text-cyan-600'
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
                <User className="w-4 h-4 text-cyan-600" />
                My Profile
              </Link>
              <Link 
                href="/dependents" 
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-3"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Users className="w-4 h-4 text-cyan-600" />
                Dependents
              </Link>
              <Link 
                href="/documents" 
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-3"
                onClick={() => setMobileMenuOpen(false)}
              >
                <FileText className="w-4 h-4 text-cyan-600" />
                Documents
              </Link>
              <Link 
                href="/settings" 
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-3"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Settings className="w-4 h-4 text-cyan-600" />
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
                    href="/signin" 
                    className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <a
                    href={ENROLLMENT_URL}
                    className="px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 rounded-lg text-center"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Enroll Now
                  </a>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
