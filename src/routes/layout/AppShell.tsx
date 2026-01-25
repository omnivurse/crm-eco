import { Link, useLocation } from 'react-router-dom';
import { Logo } from '../../components/ui/Logo';
import { SupportContact } from '../../components/ui/SupportContact';
import { useAuth } from '../../providers/AuthProvider';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Ticket,
  BookOpen,
  Users,
  Settings,
  BarChart,
  LogOut,
  Menu,
  X,
  FileText,
  MessageSquare,
  GitBranch,
  Package,
  AlertTriangle,
  Activity,
  Briefcase,
  ArrowLeftRight,
  Calendar,
  Terminal,
} from 'lucide-react';
import { useState } from 'react';
import { CommandPalette } from '../../components/ui/CommandPalette';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { TerminalWindow, useTerminal } from '../../components/terminal';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toggle: toggleTerminal } = useTerminal();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isStaff = profile?.role && ['staff', 'agent', 'admin', 'super_admin'].includes(profile.role);

  const isDeskMode = location.pathname.startsWith('/desk');

  console.log('AppShell Debug:', {
    profile,
    role: profile?.role,
    isAdmin,
    isStaff,
    isDeskMode
  });

  const consoleNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, show: true },
    { name: 'My Work', href: '/desk', icon: Briefcase, show: isStaff },
    { name: 'Tickets', href: '/tickets', icon: Ticket, show: true },
    { name: 'Service Catalog', href: '/catalog', icon: Package, show: true },
    { name: 'Knowledge Base', href: '/kb', icon: BookOpen, show: true },
    { name: 'Problems', href: '/problems', icon: AlertTriangle, show: isStaff },
    { name: 'Collaboration', href: '/collaboration', icon: GitBranch, show: isStaff },
    { name: 'Reports', href: '/reports', icon: BarChart, show: isStaff },
  ];

  const deskNavigation = [
    { name: 'Overview', href: '/desk', icon: LayoutDashboard, show: true },
    { name: 'Tasks', href: '/desk/tasks', icon: Ticket, show: true },
    { name: 'Projects', href: '/desk/projects', icon: Package, show: true },
    { name: 'Notes', href: '/desk/notes', icon: FileText, show: true },
    { name: 'Daily Logs', href: '/desk/logs', icon: BookOpen, show: true },
    { name: 'Files', href: '/desk/files', icon: FileText, show: true },
    { name: 'Assignments', href: '/desk/assignments', icon: AlertTriangle, show: true },
    { name: 'Password Vault', href: '/desk/vault', icon: Briefcase, show: true },
  ];

  const navigation = isDeskMode ? deskNavigation : consoleNavigation;

  console.log('Navigation items:', {
    total: navigation.length,
    filtered: navigation.filter(item => item.show).length,
    items: navigation.map(item => ({ name: item.name, show: item.show }))
  });

  const adminNavigation = [
    { name: 'Admin', href: '/admin', icon: Settings },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Workflows', href: '/admin/workflows', icon: GitBranch },
    { name: 'Chat Management', href: '/admin/chat', icon: MessageSquare },
    { name: 'Staff Logs', href: '/admin/staff-logs', icon: FileText },
    { name: 'Daily Logs', href: '/admin/daily-logs', icon: Calendar, requiredRole: 'super_admin' },
    { name: 'SLA Insights', href: '/admin/sla-insights', icon: BarChart },
    { name: 'System Health', href: '/admin/health', icon: Activity },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen app-background">
      <CommandPalette />
      <TerminalWindow />
      <div className="lg:hidden">
        <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3">
          <Logo size="small" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
        <div className="h-14"></div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 enterprise-nav z-40 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between mb-2">
              <Logo size="medium" />
              <div className="hidden lg:block">
                <ThemeToggle />
              </div>
            </div>
            {profile && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                {profile.full_name || profile.email}
              </p>
            )}
            <Link
              to={isDeskMode ? '/dashboard' : '/desk'}
              className="btn-enterprise-primary w-full mt-3 gap-2"
            >
              <ArrowLeftRight size={16} />
              {isDeskMode ? 'Support Console' : 'My Work'}
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navigation
              .filter((item) => item.show)
              .map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`enterprise-nav-item ${
                      isActive ? 'active' : ''
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}

            {isAdmin && (
              <>
                <div className="pt-4 pb-2 px-3">
                  <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Administration
                  </h3>
                </div>
                {adminNavigation.filter((item: any) => {
                  if (!item.requiredRole) return true;
                  return profile?.role === item.requiredRole;
                }).map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`enterprise-nav-item ${
                        isActive ? 'active' : ''
                      }`}
                    >
                      <Icon size={20} />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </>
            )}
          </nav>

          <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 space-y-3">
            <div className="px-2">
              <SupportContact variant="minimal" showEmail={false} />
            </div>
            <button
              onClick={toggleTerminal}
              className="btn-enterprise-ghost w-full justify-start gap-3 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20"
              title="Command Center (Ctrl+K)"
            >
              <Terminal size={20} />
              <span>Command Center</span>
              <kbd className="ml-auto text-xs bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 rounded">^K</kbd>
            </button>
            <button
              onClick={handleSignOut}
              className="btn-enterprise-ghost w-full justify-start gap-3"
            >
              <LogOut size={20} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="lg:pl-64">
        <div className="w-full">
          <div className="px-6 py-6">
            <Breadcrumbs />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
