import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser, getMemberMemberships } from '@crm-eco/lib';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { 
  Shield, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Calendar,
  DollarSign,
  Users,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';

export default async function CoveragePage() {
  const supabase = await createServerSupabaseClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const context = await getMemberForUser(supabase, user.id);
  if (!context) redirect('/enroll');

  const { member } = context;

  // Get memberships with plan details
  const memberships = member.organization_id
    ? await getMemberMemberships(supabase, member.id, member.organization_id)
    : [];

  // Get active membership
  const activeMembership = memberships.find(
    (m: any) => m.status === 'active'
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'pending': return <Clock className="h-5 w-5 text-amber-500" />;
      default: return <AlertCircle className="h-5 w-5 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'inactive': return 'bg-slate-100 text-slate-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  // Sample benefits - in real app, fetch from plan
  const benefits = [
    { name: 'Preventive Care', description: 'Annual checkups, screenings, vaccinations', included: true },
    { name: 'Primary Care Visits', description: 'Doctor visits for illness or injury', included: true },
    { name: 'Specialist Visits', description: 'Referrals to specialists', included: true },
    { name: 'Emergency Care', description: 'Emergency room visits', included: true },
    { name: 'Prescription Drugs', description: 'Generic and brand medications', included: true },
    { name: 'Mental Health', description: 'Counseling and therapy sessions', included: true },
    { name: 'Lab & Imaging', description: 'Blood tests, X-rays, MRIs', included: true },
    { name: 'Hospital Stays', description: 'Inpatient care coverage', included: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Coverage</h1>
        <p className="text-slate-500">View your health sharing membership details</p>
      </div>

      {activeMembership ? (
        <>
          {/* Active Plan Card */}
          <Card className="border-2 border-green-200 bg-green-50/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(activeMembership.status)}
                  <div>
                    <CardTitle className="text-xl">
                      {activeMembership.plans?.name || 'Health Sharing Plan'}
                    </CardTitle>
                    <CardDescription>
                      {activeMembership.plans?.description || 'Your active health sharing membership'}
                    </CardDescription>
                  </div>
                </div>
                <Badge className={getStatusColor(activeMembership.status)}>
                  {activeMembership.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Effective Date</p>
                    <p className="font-medium">
                      {activeMembership.effective_date 
                        ? new Date(activeMembership.effective_date).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Monthly Share</p>
                    <p className="font-medium">
                      ${activeMembership.plans?.monthly_share?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Coverage Type</p>
                    <p className="font-medium">
                      {activeMembership.coverage_type || 'Individual'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">IUA (Deductible)</p>
                    <p className="font-medium">
                      ${activeMembership.iua_amount?.toLocaleString() || '2,500'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Benefits */}
          <Card>
            <CardHeader>
              <CardTitle>What's Covered</CardTitle>
              <CardDescription>
                Your membership includes sharing for these medical needs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {benefits.map((benefit, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-50"
                  >
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-slate-900">{benefit.name}</p>
                      <p className="text-sm text-slate-500">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Important Information */}
          <Card>
            <CardHeader>
              <CardTitle>Important Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h4 className="font-medium text-blue-900 mb-2">Initial Unshared Amount (IUA)</h4>
                <p className="text-sm text-blue-700">
                  Your IUA is the amount you pay before the community begins sharing your eligible medical expenses. 
                  Once you've paid your IUA for the membership year, eligible expenses above that amount may be shared.
                </p>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                <h4 className="font-medium text-amber-900 mb-2">Pre-Existing Conditions</h4>
                <p className="text-sm text-amber-700">
                  Medical conditions that existed before your membership may have a waiting period before they become eligible for sharing. 
                  Review your membership guidelines for details.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <Shield className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Active Coverage</h2>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              You don't have an active health sharing membership. 
              Start an enrollment to get coverage.
            </p>
            <Link href="/enroll">
              <Button className="gap-2">
                Start Enrollment
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Other Memberships */}
      {memberships.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Membership History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {memberships
                .filter((m: any) => m.id !== activeMembership?.id)
                .map((membership: any) => (
                  <div 
                    key={membership.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(membership.status)}
                      <div>
                        <p className="font-medium">{membership.plans?.name || 'Health Sharing Plan'}</p>
                        <p className="text-sm text-slate-500">
                          {membership.effective_date 
                            ? new Date(membership.effective_date).toLocaleDateString()
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(membership.status)}>
                      {membership.status}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
