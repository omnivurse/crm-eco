/**
 * CRM Auto-Seed Functions
 * Ensures default modules exist for an organization
 */

import { createClient } from '@supabase/supabase-js';

// Create admin client for seeding (bypasses RLS)
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for auto-seeding');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}

// Default modules configuration
const DEFAULT_MODULES = [
  { key: 'contacts', name: 'Contact', name_plural: 'Contacts', icon: 'user', description: 'Manage all your contacts and customers', display_order: 1 },
  { key: 'leads', name: 'Lead', name_plural: 'Leads', icon: 'user-plus', description: 'Track and nurture potential customers', display_order: 2 },
  { key: 'deals', name: 'Member', name_plural: 'Members', icon: 'users', description: 'Manage member applications and lifecycle', display_order: 3 },
  { key: 'accounts', name: 'Account', name_plural: 'Accounts', icon: 'building', description: 'Manage organizations and companies', display_order: 4 },
  { key: 'prospects', name: 'Prospect', name_plural: 'Prospects', icon: 'target', description: 'Manage potential customers and sales opportunities', display_order: 5 },
];

// Default fields for each module
const DEFAULT_FIELDS: Record<string, Array<{ key: string; label: string; type: string; required?: boolean; is_system?: boolean; is_title_field?: boolean; display_order: number; section: string; options?: string[] }>> = {
  contacts: [
    { key: 'first_name', label: 'First Name', type: 'text', required: true, is_system: true, is_title_field: true, display_order: 1, section: 'main' },
    { key: 'last_name', label: 'Last Name', type: 'text', required: true, is_system: true, is_title_field: true, display_order: 2, section: 'main' },
    { key: 'email', label: 'Email', type: 'email', required: true, is_system: true, display_order: 3, section: 'main' },
    { key: 'phone', label: 'Phone', type: 'phone', is_system: true, display_order: 4, section: 'main' },
    { key: 'contact_status', label: 'Status', type: 'select', is_system: true, display_order: 5, section: 'main', options: ['Active', 'Inactive', 'Pending', 'In Process', 'Cancelled', 'Terminated', 'Deceased', 'Prospect', 'Lost', 'Declined', 'Abandoned'] },
    { key: 'mailing_city', label: 'City', type: 'text', display_order: 10, section: 'address' },
    { key: 'mailing_state', label: 'State', type: 'text', display_order: 11, section: 'address' },
    { key: 'county', label: 'County', type: 'text', display_order: 12, section: 'address' },
    { key: 'agency', label: 'Agency', type: 'text', display_order: 17, section: 'relationships' },
    { key: 'partners', label: 'Partners', type: 'textarea', display_order: 18, section: 'relationships' },
    { key: 'support_team', label: 'Support Team', type: 'text', display_order: 19, section: 'relationships' },
  ],
  leads: [
    { key: 'first_name', label: 'First Name', type: 'text', required: true, is_system: true, is_title_field: true, display_order: 1, section: 'main' },
    { key: 'last_name', label: 'Last Name', type: 'text', required: true, is_system: true, is_title_field: true, display_order: 2, section: 'main' },
    { key: 'email', label: 'Email', type: 'email', is_system: true, display_order: 3, section: 'main' },
    { key: 'phone', label: 'Phone', type: 'phone', is_system: true, display_order: 4, section: 'main' },
    { key: 'lead_status', label: 'Lead Status', type: 'select', is_system: true, display_order: 5, section: 'main', options: ['New', 'Attempted', 'Contacted', 'Qualified', 'Future Prospect', 'In Process', 'Pending', 'Converted', 'Unqualified', 'Lost'] },
    { key: 'lead_source', label: 'Lead Source', type: 'select', display_order: 6, section: 'main', options: ['Member Referral', 'Non-Member Referral', 'Website', 'Social Media', 'Email Campaign', 'Event', 'Other'] },
    { key: 'company', label: 'Company', type: 'text', display_order: 7, section: 'main' },
    { key: 'agency', label: 'Agency', type: 'text', display_order: 8, section: 'relationships' },
    { key: 'partners', label: 'Partners', type: 'textarea', display_order: 9, section: 'relationships' },
    { key: 'support_team', label: 'Support Team', type: 'text', display_order: 10, section: 'relationships' },
    { key: 'county', label: 'County', type: 'text', display_order: 16, section: 'address' },
  ],
  deals: [
    { key: 'member_name', label: 'Member Name', type: 'text', required: true, is_system: true, is_title_field: true, display_order: 1, section: 'main' },
    { key: 'email', label: 'Email', type: 'email', is_system: true, display_order: 2, section: 'main' },
    { key: 'phone', label: 'Phone', type: 'phone', is_system: true, display_order: 3, section: 'main' },
    { key: 'stage', label: 'Stage', type: 'select', required: true, is_system: true, display_order: 4, section: 'main', options: ['Application', 'Under Review', 'Approved', 'Active', 'Terminated'] },
    { key: 'enrollment_date', label: 'Enrollment Date', type: 'date', is_system: true, display_order: 5, section: 'main' },
    { key: 'plan', label: 'Plan', type: 'text', display_order: 6, section: 'main' },
    { key: 'notes', label: 'Notes', type: 'textarea', display_order: 7, section: 'main' },
  ],
  accounts: [
    { key: 'account_name', label: 'Account Name', type: 'text', required: true, is_system: true, is_title_field: true, display_order: 1, section: 'main' },
    { key: 'website', label: 'Website', type: 'url', display_order: 2, section: 'main' },
    { key: 'phone', label: 'Phone', type: 'phone', is_system: true, display_order: 3, section: 'main' },
    { key: 'industry', label: 'Industry', type: 'select', display_order: 4, section: 'main', options: ['Healthcare', 'Technology', 'Financial Services', 'Retail', 'Other'] },
    { key: 'employees', label: 'Employees', type: 'number', display_order: 5, section: 'main' },
    { key: 'billing_city', label: 'Billing City', type: 'text', display_order: 10, section: 'address' },
    { key: 'billing_state', label: 'Billing State', type: 'text', display_order: 11, section: 'address' },
  ],
  prospects: [
    { key: 'first_name', label: 'First Name', type: 'text', required: true, is_system: true, is_title_field: true, display_order: 1, section: 'main' },
    { key: 'last_name', label: 'Last Name', type: 'text', required: true, is_system: true, is_title_field: true, display_order: 2, section: 'main' },
    { key: 'email', label: 'Email', type: 'email', required: true, is_system: true, display_order: 3, section: 'main' },
    { key: 'phone', label: 'Phone', type: 'phone', is_system: true, display_order: 4, section: 'main' },
    { key: 'prospect_status', label: 'Prospect Status', type: 'select', is_system: true, display_order: 5, section: 'main', options: ['New', 'In Process', 'Qualified', 'Closed Won', 'Closed Lost'] },
    { key: 'carrier', label: 'Carrier', type: 'text', display_order: 6, section: 'main' },
    { key: 'mailing_city', label: 'City', type: 'text', display_order: 10, section: 'address' },
    { key: 'mailing_state', label: 'State', type: 'text', display_order: 11, section: 'address' },
    { key: 'county', label: 'County', type: 'text', display_order: 12, section: 'address' },
  ],
};

/**
 * Check if an organization has CRM modules set up
 */
export async function hasModules(orgId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from('crm_modules')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    if (error) throw error;
    return (count || 0) > 0;
  } catch (error) {
    console.error('Error checking modules:', error);
    return false;
  }
}

/**
 * Seed default CRM modules for an organization
 */
export async function seedDefaultModules(orgId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();

    // Check if modules already exist
    const exists = await hasModules(orgId);
    if (exists) {
      return { success: true };
    }

    // Create modules
    for (const moduleConfig of DEFAULT_MODULES) {
      // Insert module
      const { data: module, error: moduleError } = await supabase
        .from('crm_modules')
        .insert({
          org_id: orgId,
          key: moduleConfig.key,
          name: moduleConfig.name,
          name_plural: moduleConfig.name_plural,
          icon: moduleConfig.icon,
          description: moduleConfig.description,
          is_system: true,
          is_enabled: true,
          display_order: moduleConfig.display_order,
        })
        .select()
        .single();

      if (moduleError) {
        console.error(`Error creating module ${moduleConfig.key}:`, moduleError);
        continue;
      }

      // Insert fields for this module
      const fields = DEFAULT_FIELDS[moduleConfig.key] || [];
      for (const fieldConfig of fields) {
        const { error: fieldError } = await supabase
          .from('crm_fields')
          .insert({
            org_id: orgId,
            module_id: module.id,
            key: fieldConfig.key,
            label: fieldConfig.label,
            type: fieldConfig.type,
            required: fieldConfig.required || false,
            is_system: fieldConfig.is_system || false,
            is_title_field: fieldConfig.is_title_field || false,
            display_order: fieldConfig.display_order,
            section: fieldConfig.section,
            options: fieldConfig.options ? JSON.stringify(fieldConfig.options) : '[]',
          });

        if (fieldError) {
          console.error(`Error creating field ${fieldConfig.key}:`, fieldError);
        }
      }

      // Create default layout
      const { error: layoutError } = await supabase
        .from('crm_layouts')
        .insert({
          org_id: orgId,
          module_id: module.id,
          name: 'Default Layout',
          is_default: true,
          config: {
            sections: [
              { key: 'main', label: 'General Information', columns: 2, collapsed: false },
              { key: 'address', label: 'Address', columns: 2, collapsed: false },
            ],
          },
        });

      if (layoutError) {
        console.error(`Error creating layout for ${moduleConfig.key}:`, layoutError);
      }

      // Create default view
      const viewColumns = fields.slice(0, 6).map(f => f.key);
      const { error: viewError } = await supabase
        .from('crm_views')
        .insert({
          org_id: orgId,
          module_id: module.id,
          name: `All ${moduleConfig.name_plural}`,
          is_default: true,
          is_shared: true,
          columns: viewColumns,
          sort: [{ field: 'created_at', direction: 'desc' }],
        });

      if (viewError) {
        console.error(`Error creating view for ${moduleConfig.key}:`, viewError);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error seeding modules:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Server action to ensure modules exist
 */
export async function ensureDefaultModules(orgId: string): Promise<boolean> {
  const exists = await hasModules(orgId);
  if (exists) return true;
  
  const result = await seedDefaultModules(orgId);
  return result.success;
}
