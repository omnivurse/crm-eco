'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Bell,
  MagnifyingGlass,
  User,
  SignOut,
  Gear,
  CaretDown,
  ArrowSquareOut,
  Copy,
  Check,
  List,
  X,
} from '@phosphor-icons/react';
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
  mobileMenuOpen?: boolean;
  onMobileMenuToggle?: () => void;
}

export function AgentTopNav({ agent, mobileMenuOpen, onMobileMenuToggle }: AgentTopNavProps) {
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

  const primaryColor = agent?.primary_color || '#0b6d85';

  return (
    <header className="mx-3 mt-3 flex h-14 items-center justify-between rounded-full border border-[rgba(11,109,133,0.08)] bg-white/80 px-3 shadow-[var(--mp-shadow-soft)] backdrop-blur-xl sm:px-4 lg:mx-0 lg:mr-3 lg:mt-3 lg:px-6">
      <div className="flex max-w-md flex-1 items-center gap-2 lg:gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 flex-shrink-0 rounded-full text-slate-600 hover:bg-[rgba(11,109,133,0.06)] hover:text-[var(--mp-teal)] lg:hidden"
          onClick={onMobileMenuToggle}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? (
            <X weight="light" className="h-5 w-5" />
          ) : (
            <List weight="light" className="h-5 w-5" />
          )}
        </Button>

        <div className="relative hidden w-full sm:block">
          <MagnifyingGlass
            weight="light"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <Input
            placeholder="Search members, enrollments..."
            className="rounded-full border-[rgba(11,109,133,0.1)] bg-[var(--mp-mist)] pl-10 focus-visible:ring-[var(--mp-teal)]"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 lg:gap-2">
        {enrollmentLink && (
          <Button
            variant="outline"
            size="sm"
            onClick={copyEnrollmentLink}
            className="hidden gap-2 rounded-full border-[rgba(11,109,133,0.15)] text-[var(--mp-teal)] hover:bg-[rgba(11,109,133,0.06)] lg:flex"
          >
            {copied ? (
              <Check weight="light" className="h-4 w-4 text-green-500" />
            ) : (
              <Copy weight="light" className="h-4 w-4" />
            )}
            Copy Enrollment Link
          </Button>
        )}

        {enrollmentLink && (
          <Link href={enrollmentLink} target="_blank">
            <Button
              variant="ghost"
              size="sm"
              className="hidden gap-2 rounded-full text-slate-600 hover:bg-[rgba(11,109,133,0.06)] hover:text-[var(--mp-teal)] md:flex"
            >
              <ArrowSquareOut weight="light" className="h-4 w-4" />
              Preview
            </Button>
          </Link>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full text-slate-600 hover:bg-[rgba(11,109,133,0.06)] hover:text-[var(--mp-teal)]"
        >
          <Bell weight="light" className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 rounded-full hover:bg-[rgba(11,109,133,0.06)]">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {agent?.first_name?.charAt(0) || 'A'}
              </div>
              <span className="hidden text-sm font-medium text-slate-700 sm:inline">
                {agent?.first_name} {agent?.last_name}
              </span>
              <CaretDown weight="light" className="h-4 w-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl border-[rgba(11,109,133,0.08)] shadow-[var(--mp-shadow-soft)]">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-[var(--mp-ink)]">
                {agent?.first_name} {agent?.last_name}
              </p>
              <p className="text-xs text-slate-500">{agent?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <Link href="/agent/profile">
              <DropdownMenuItem>
                <User weight="light" className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
            </Link>
            <Link href="/agent/settings">
              <DropdownMenuItem>
                <Gear weight="light" className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
              <SignOut weight="light" className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
