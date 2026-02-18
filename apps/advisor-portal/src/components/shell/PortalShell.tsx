'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { cn } from '@crm-eco/ui';
import {
    LayoutDashboard,
    Users,
    MessageSquare,
    BookOpen,
    Users2,
    Presentation,
    LogOut,
    Menu,
    X,
    ChevronRight,
    ShieldCheck,
} from 'lucide-react';

import type { Profile as ProfileRow, Advisor } from '@crm-eco/lib/types';

/** Profile with joined advisor relation */
type ProfileWithAdvisor = Pick<ProfileRow, 'id' | 'full_name' | 'email' | 'avatar_url' | 'advisor_role'> & {
    advisors?: Pick<Advisor, 'first_name' | 'last_name' | 'agency_name'> | null;
};

interface PortalShellProps {
    profile: ProfileWithAdvisor;
    children: React.ReactNode;
}

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Contacts', href: '/contacts', icon: Users },
    { name: 'Engagement', href: '/engagement', icon: MessageSquare },
    { name: 'Training', href: '/training', icon: BookOpen },
    { name: 'Team', href: '/team', icon: Users2 },
    { name: 'Presentations', href: '/presentations', icon: Presentation },
];

export function PortalShell({ profile, children }: PortalShellProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const advisorName = profile.advisors
        ? `${profile.advisors.first_name} ${profile.advisors.last_name}`
        : profile.full_name || 'Advisor';

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-200 lg:translate-x-0',
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                {/* Logo */}
                <div className="h-16 flex items-center gap-3 px-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="w-10 h-10 bg-gradient-to-br from-advisor-500 to-advisor-600 rounded-lg flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-gray-900 dark:text-white">Advisor Portal</h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {profile.advisors?.agency_name || 'Agency'}
                        </p>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="ml-auto lg:hidden p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                    isActive
                                        ? 'bg-advisor-50 text-advisor-700 dark:bg-advisor-900/20 dark:text-advisor-400'
                                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/50'
                                )}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.name}
                                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                            </Link>
                        );
                    })}
                </nav>

                {/* User section */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-advisor-100 dark:bg-advisor-900/30 flex items-center justify-center">
                            <span className="text-advisor-700 dark:text-advisor-400 font-medium text-sm">
                                {advisorName.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {advisorName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                {profile.advisor_role}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <div className="lg:pl-64">
                {/* Mobile header */}
                <header className="sticky top-0 z-30 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 lg:hidden">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <h1 className="ml-3 font-semibold text-gray-900 dark:text-white">Advisor Portal</h1>
                </header>

                {/* Page content */}
                <main className="p-3 sm:p-4 lg:p-6 xl:p-8 2xl:p-10">
                    {children}
                </main>
            </div>
        </div>
    );
}
