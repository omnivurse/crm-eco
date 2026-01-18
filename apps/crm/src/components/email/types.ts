// Email Editor Types and Constants

export interface MergeField {
  key: string;
  label: string;
  category: MergeFieldCategory;
  example: string;
}

export type MergeFieldCategory = 'contact' | 'company' | 'deal' | 'owner' | 'system';

export const MERGE_FIELD_CATEGORIES: Record<MergeFieldCategory, string> = {
  contact: 'Contact',
  company: 'Company',
  deal: 'Deal',
  owner: 'Owner',
  system: 'System',
};

export const MERGE_FIELDS: MergeField[] = [
  // Contact fields
  { key: 'contact.first_name', label: 'First Name', category: 'contact', example: 'John' },
  { key: 'contact.last_name', label: 'Last Name', category: 'contact', example: 'Smith' },
  { key: 'contact.full_name', label: 'Full Name', category: 'contact', example: 'John Smith' },
  { key: 'contact.email', label: 'Email', category: 'contact', example: 'john@example.com' },
  { key: 'contact.phone', label: 'Phone', category: 'contact', example: '(555) 123-4567' },
  { key: 'contact.title', label: 'Title', category: 'contact', example: 'Sales Manager' },
  { key: 'contact.company', label: 'Company Name', category: 'contact', example: 'Acme Corp' },

  // Company fields
  { key: 'company.name', label: 'Company Name', category: 'company', example: 'Acme Corporation' },
  { key: 'company.industry', label: 'Industry', category: 'company', example: 'Technology' },
  { key: 'company.website', label: 'Website', category: 'company', example: 'www.acme.com' },
  { key: 'company.address', label: 'Address', category: 'company', example: '123 Main St' },
  { key: 'company.city', label: 'City', category: 'company', example: 'San Francisco' },
  { key: 'company.state', label: 'State', category: 'company', example: 'CA' },
  { key: 'company.zip', label: 'ZIP Code', category: 'company', example: '94102' },

  // Deal fields
  { key: 'deal.name', label: 'Deal Name', category: 'deal', example: 'Enterprise License' },
  { key: 'deal.amount', label: 'Amount', category: 'deal', example: '$50,000' },
  { key: 'deal.stage', label: 'Stage', category: 'deal', example: 'Negotiation' },
  { key: 'deal.close_date', label: 'Close Date', category: 'deal', example: 'March 15, 2026' },
  { key: 'deal.probability', label: 'Probability', category: 'deal', example: '75%' },

  // Owner fields
  { key: 'owner.name', label: 'Owner Name', category: 'owner', example: 'Jane Doe' },
  { key: 'owner.email', label: 'Owner Email', category: 'owner', example: 'jane@company.com' },
  { key: 'owner.phone', label: 'Owner Phone', category: 'owner', example: '(555) 987-6543' },
  { key: 'owner.title', label: 'Owner Title', category: 'owner', example: 'Account Executive' },

  // System fields
  { key: 'system.today', label: 'Today\'s Date', category: 'system', example: 'January 18, 2026' },
  { key: 'system.current_year', label: 'Current Year', category: 'system', example: '2026' },
  { key: 'system.unsubscribe_link', label: 'Unsubscribe Link', category: 'system', example: '[Unsubscribe]' },
  { key: 'system.view_in_browser_link', label: 'View in Browser', category: 'system', example: '[View in Browser]' },
];

export const getMergeFieldsByCategory = (category: MergeFieldCategory): MergeField[] => {
  return MERGE_FIELDS.filter(field => field.category === category);
};

export const getMergeFieldByKey = (key: string): MergeField | undefined => {
  return MERGE_FIELDS.find(field => field.key === key);
};

export const replaceMergeFields = (
  content: string,
  data: Record<string, string | undefined>
): string => {
  let result = content;
  MERGE_FIELDS.forEach(field => {
    const regex = new RegExp(`\\{\\{\\s*${field.key.replace('.', '\\.')}\\s*\\}\\}`, 'g');
    const value = data[field.key] || field.example;
    result = result.replace(regex, value);
  });
  return result;
};

// Font sizes for the editor
export const FONT_SIZES = [
  { label: 'Small', value: '12px' },
  { label: 'Normal', value: '14px' },
  { label: 'Medium', value: '16px' },
  { label: 'Large', value: '18px' },
  { label: 'Extra Large', value: '24px' },
];

// Color presets for the editor
export const COLOR_PRESETS = [
  '#000000', '#374151', '#6B7280', '#9CA3AF',
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899',
];

// Heading levels
export const HEADING_LEVELS = [
  { label: 'Heading 1', value: 1 },
  { label: 'Heading 2', value: 2 },
  { label: 'Heading 3', value: 3 },
  { label: 'Paragraph', value: 0 },
];
