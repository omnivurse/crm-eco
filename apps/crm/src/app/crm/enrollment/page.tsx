import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ClipboardCheck,
  User,
  Users,
  FileText,
  Heart,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Plus,
  Search,
  Filter,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import { getCurrentProfile } from '@/lib/crm/queries';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

// Enrollment status configuration
const ENROLLMENT_STATUSES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft: { label: 'Draft', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' },
  in_progress: { label: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  submitted: { label: 'Submitted', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  approved: { label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  cancelled: { label: 'Cancelled', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' },
};

interface Enrollment {
  id: string;
  enrollment_number: string;
  status: string;
  household_size: number;
  effective_date: string | null;
  created_at: string;
  primary_member?: {
    id: string;
    title: string;
    email: string | null;
    data: Record<string, unknown>;
  } | null;
  plan?: {
    id: string;
    name: string;
    product_line: string | null;
  } | null;
  advisor?: {
    id: string;
    full_name: string | null;
  } | null;
}

function EnrollmentCard({ enrollment }: { enrollment: Enrollment }) {
  const status = ENROLLMENT_STATUSES[enrollment.status] || ENROLLMENT_STATUSES.draft;
  const memberName = enrollment.primary_member?.title || 'Unknown';
  const memberEmail = enrollment.primary_member?.email || enrollment.primary_member?.data?.email as string || '';
  const planName = enrollment.plan?.name || 'No plan selected';

  return (
    <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-white/10 hover:border-teal-500/30 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-white font-semibold">
            {memberName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h4 className="text-slate-900 dark:text-white font-medium group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
              {memberName}
            </h4>
            <p className="text-slate-600 dark:text-slate-400 text-sm">{memberEmail}</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${status.bg} ${status.color} ${status.border}`}>
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-slate-500 dark:text-slate-500 text-xs mb-0.5">Plan</p>
          <p className="text-slate-900 dark:text-white text-sm">{planName}</p>
        </div>
        <div>
          <p className="text-slate-500 dark:text-slate-500 text-xs mb-0.5">Household Size</p>
          <p className="text-slate-900 dark:text-white text-sm">{enrollment.household_size} member{enrollment.household_size !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-white/5">
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(enrollment.created_at).toLocaleDateString()}
          </span>
          <span className="font-mono text-xs">{enrollment.enrollment_number}</span>
        </div>
        <Link href={`/crm/enrollment/${enrollment.id}`}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-500/10"
          >
            Review
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function WizardStep({
  number,
  title,
  description,
  active
}: {
  number: number;
  title: string;
  description: string;
  active: boolean;
}) {
  return (
    <div className={`flex items-start gap-4 p-4 rounded-xl transition-all ${
      active ? 'glass border border-teal-500/30 bg-teal-50 dark:bg-teal-500/5' : 'opacity-60'
    }`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
        active
          ? 'bg-gradient-to-br from-teal-500 to-emerald-500 text-white'
          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
      }`}>
        {number}
      </div>
      <div>
        <h4 className={`font-medium ${active ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{title}</h4>
        <p className="text-slate-500 dark:text-slate-500 text-sm">{description}</p>
      </div>
    </div>
  );
}

async function EnrollmentContent() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/crm-login');
  }

  const supabase = await createServerSupabaseClient();

  // Fetch enrollments with related data
  const { data: enrollments, error } = await supabase
    .from('enrollments')
    .select(`
      id,
      enrollment_number,
      status,
      household_size,
      effective_date,
      created_at,
      primary_member:crm_records!enrollments_primary_member_id_fkey(id, title, email, data),
      plan:plans!enrollments_selected_plan_id_fkey(id, name, product_line),
      advisor:profiles!enrollments_advisor_id_fkey(id, full_name)
    `)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching enrollments:', error);
  }

  const enrollmentList = (enrollments || []) as unknown as Enrollment[];

  // Count enrollments by status
  const { data: statusCounts } = await supabase
    .from('enrollments')
    .select('status')
    .eq('organization_id', profile.organization_id);

  const counts = {
    draft: 0,
    in_progress: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  };

  (statusCounts || []).forEach((e: { status: string }) => {
    if (e.status in counts) {
      counts[e.status as keyof typeof counts]++;
    }
  });

  // Count active memberships
  const { count: activeMemberCount } = await supabase
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id)
    .eq('status', 'active');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-teal-500/20 to-emerald-500/20">
              <ClipboardCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
            <span className="text-teal-600 dark:text-teal-400 text-sm font-medium">Health Sharing</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Enrollment Management</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-0.5">
            Process and manage member enrollments
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-white/20"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Link href="/crm/enrollment?new=true">
            <Button
              className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white glow-sm hover:glow-md"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Enrollment
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{counts.submitted}</p>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Pending Review</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{counts.in_progress}</p>
              <p className="text-slate-600 dark:text-slate-400 text-sm">In Progress</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{counts.approved}</p>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Approved</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10">
              <Heart className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{activeMemberCount || 0}</p>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Active Members</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enrollment Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Enrollments</h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search enrollments..."
                className="pl-10 h-9 rounded-lg bg-white dark:bg-slate-900/50 border-slate-300 dark:border-white/10 text-sm"
              />
            </div>
          </div>

          <div className="space-y-4">
            {enrollmentList.map((enrollment) => (
              <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
            ))}

            {enrollmentList.length === 0 && (
              <div className="glass-card rounded-xl p-12 border border-slate-200 dark:border-white/10 text-center">
                <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800/50 w-fit mx-auto mb-4">
                  <ClipboardCheck className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                </div>
                <p className="text-slate-900 dark:text-white font-medium mb-1">No enrollments yet</p>
                <p className="text-slate-500 dark:text-slate-500 text-sm mb-4">New enrollment applications will appear here.</p>
                <Link href="/crm/enrollment?new=true">
                  <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Start First Enrollment
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Enrollment Wizard Overview */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Enrollment Process</h2>

          <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10 space-y-3">
            <WizardStep
              number={1}
              title="Personal Information"
              description="Basic contact and demographic details"
              active={true}
            />
            <WizardStep
              number={2}
              title="Coverage Selection"
              description="Choose product and coverage options"
              active={false}
            />
            <WizardStep
              number={3}
              title="Family Members"
              description="Add spouse and dependents"
              active={false}
            />
            <WizardStep
              number={4}
              title="Documents"
              description="Upload required documentation"
              active={false}
            />
            <WizardStep
              number={5}
              title="Payment Setup"
              description="Configure payment method"
              active={false}
            />
            <WizardStep
              number={6}
              title="Review & Submit"
              description="Verify and complete enrollment"
              active={false}
            />
          </div>

          {/* Quick Actions */}
          <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
            <h3 className="text-slate-900 dark:text-white font-medium mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Link href="/members">
                <Button
                  variant="outline"
                  className="w-full justify-start border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                >
                  <Users className="w-4 h-4 mr-2" />
                  View All Members
                </Button>
              </Link>
              <Link href="/crm/documents">
                <Button
                  variant="outline"
                  className="w-full justify-start border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Pending Documents
                </Button>
              </Link>
              <Link href="/crm/approvals">
                <Button
                  variant="outline"
                  className="w-full justify-start border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Review Exceptions
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EnrollmentPage() {
  return (
    <Suspense fallback={<EnrollmentSkeleton />}>
      <EnrollmentContent />
    </Suspense>
  );
}

function EnrollmentSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse" />
          <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse" />
          <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-24 bg-slate-200 dark:bg-slate-800/50 rounded-lg animate-pulse" />
          <div className="h-10 w-36 bg-slate-200 dark:bg-slate-800/50 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-white/5 animate-pulse" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-slate-100 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-white/5 animate-pulse" />
          ))}
        </div>
        <div className="h-[500px] bg-slate-100 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-white/5 animate-pulse" />
      </div>
    </div>
  );
}
