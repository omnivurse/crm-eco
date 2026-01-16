'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Bell,
  Search,
  User,
  LogOut,
  Settings,
  ChevronDown,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { Input } from '@crm-eco/ui/components/input';
import { toast } from 'sonner';

interface AgentTopNavProps {
  agent?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    enrollment_code?: string | null;
    primary_color?: string;
  };
}

export function AgentTopNav({ agent }: AgentTopNavProps) {
  const router = useRouter();
  const supabase = createClient();
  const [copied, setCopied] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/signin');
  };

  const enrollmentLink = agent?.enrollment_code 
    ? `${window.location.origin}/enroll/${agent.enrollment_code}`
    : null;

  const copyEnrollmentLink = async () => {
    if (enrollmentLink) {
      await navigator.clipboard.writeText(enrollmentLink);
      setCopied(true);
      toast.success('Enrollment link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const primaryColor = agent?.primary_color || '#1e40af';

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6">
      {/* Search */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search members, enrollments..."
            className="pl-10 bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        {/* Enrollment Link Quick Copy */}
        {enrollmentLink && (
          <Button
            variant="outline"
            size="sm"
            onClick={copyEnrollmentLink}
            className="gap-2 hidden lg:flex"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Copy Enrollment Link
          </Button>
        )}

        {/* Preview Enrollment Page */}
        {enrollmentLink && (
          <Link href={enrollmentLink} target="_blank">
            <Button variant="ghost" size="sm" className="gap-2 hidden md:flex">
              <ExternalLink className="h-4 w-4" />
              Preview
            </Button>
          </Link>
        )}

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-slate-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                style={{ backgroundColor: primaryColor }}
              >
                {agent?.first_name?.charAt(0) || 'A'}
              </div>
              <span className="hidden sm:inline text-sm font-medium text-slate-700">
                {agent?.first_name} {agent?.last_name}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-slate-900">
                {agent?.first_name} {agent?.last_name}
              </p>
              <p className="text-xs text-slate-500">{agent?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <Link href="/agent/profile">
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
            </Link>
            <Link href="/agent/settings">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
