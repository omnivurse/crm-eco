import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getRoleQueryContext } from '@/lib/auth';
import { OrganizationSettingsForm } from '@/components/settings/organization-settings-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crm-eco/ui';
import { Building2 } from 'lucide-react';
import type { Database } from '@crm-eco/lib/types';

type Organization = Database['public']['Tables']['organizations']['Row'];

async function getOrganization(): Promise<Organization | null> {
  const supabase = await createServerSupabaseClient();
  const context = await getRoleQueryContext();
  
  if (!context) return null;
  
  // Only owner/admin can access settings
  if (!context.isAdmin) {
    redirect('/dashboard');
  }

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', context.organizationId)
    .single();
  
  if (error || !data) return null;
  return data as Organization;
}

export default async function OrganizationSettingsPage() {
  const organization = await getOrganization();
  
  if (!organization) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-slate-500">
            <p>Unable to load organization settings.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Organization Profile</CardTitle>
              <CardDescription>
                Manage your organization&apos;s basic information
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <OrganizationSettingsForm organization={organization} />
        </CardContent>
      </Card>
    </div>
  );
}

