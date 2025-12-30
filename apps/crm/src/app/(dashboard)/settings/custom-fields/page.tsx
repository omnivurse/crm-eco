import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getRoleQueryContext } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crm-eco/ui';
import { Layers } from 'lucide-react';
import type { Database } from '@crm-eco/lib/types';
import { CustomFieldsManager } from '@/components/settings/custom-fields-manager';

type CustomFieldDefinition = Database['public']['Tables']['custom_field_definitions']['Row'];

async function getCustomFieldDefinitions(): Promise<CustomFieldDefinition[]> {
  const supabase = await createServerSupabaseClient();
  const context = await getRoleQueryContext();
  
  if (!context) return [];
  
  // Only owner/admin can access settings
  if (!context.isAdmin) {
    redirect('/dashboard');
  }

  const { data, error } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('organization_id', context.organizationId)
    .order('entity_type')
    .order('order_index');
  
  if (error) return [];
  return data as CustomFieldDefinition[];
}

export default async function CustomFieldsSettingsPage() {
  const context = await getRoleQueryContext();
  const definitions = await getCustomFieldDefinitions();
  
  if (!context) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Layers className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Custom Fields</CardTitle>
              <CardDescription>
                Define custom fields to capture additional information for each entity type
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CustomFieldsManager 
            definitions={definitions} 
            organizationId={context.organizationId}
          />
        </CardContent>
      </Card>
    </div>
  );
}

