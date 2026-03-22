import { ArticleLayout, SectionCard } from '@/components/learn/LearnComponents';
import { Badge } from '@crm-eco/ui/components/badge';

interface Release {
  version: string;
  date: string;
  type: 'major' | 'minor' | 'patch';
  highlights: string[];
  details?: string[];
}

const RELEASES: Release[] = [
  {
    version: 'v1.7.0',
    date: 'March 2026',
    type: 'major',
    highlights: [
      'Searchable Advisor/Agent selection across all forms',
      'Full-name and family member search (spouse, children)',
      'Unsaved changes protection with sticky save bar',
      'Duplicate note prevention and cleanup',
    ],
    details: [
      'Searchable Advisor combobox replaces plain dropdowns in member forms, agent forms, and bulk assign',
      'Search now supports full name ("Anna Martin"), spouse name, and child/dependent name queries',
      'Edit forms show "Unsaved changes" warning with browser navigation protection',
      'Save button is now always visible (sticky at bottom of form)',
      'Notes textarea expanded and duplicate note prevention added (60-second window)',
      'One-time cleanup of existing duplicate notes across all records',
      'Contact Status field now consistently available on all contact, lead, and member records',
      'Original Start Date and Current Year Start Date fields added to records',
    ],
  },
  {
    version: 'v1.6.0',
    date: 'March 2026',
    type: 'major',
    highlights: [
      'Saved Views for member list filtering',
      'Bulk Assign Advisor for multiple members at once',
      'Market Type quick-filter pills (HealthShare / Insurance)',
      'Active filter chips with easy clear controls',
    ],
    details: [
      'Save current filter combinations as named views (e.g., "My HealthShare Clients")',
      'Load, rename, and delete saved views from the Saved Views dropdown',
      'Bulk assign: select multiple members via checkboxes, assign Advisor or clear assignment',
      'Market Type pills filter members by HealthShare or Traditional Insurance with one click',
      'Active filters display as removable chips below the filter bar',
      'Sidebar navigation restructured by workflow priority: Main, Products, Enrollment, Billing, etc.',
      'KPI dashboard cards showing member counts, tobacco users, needs review, and unassigned',
      'Group vs individual record classification with record_type field',
      'Tobacco user tracking with reliable counting (excludes group records)',
    ],
  },
  {
    version: 'v1.5.0',
    date: 'February 2026',
    type: 'major',
    highlights: [
      'Command Center v2.0 with real Supabase search',
      'Features page and Learning Center',
      'Footer navigation with Features, Learn, Help, Support links',
      'Resources section in sidebar navigation',
    ],
    details: [
      'Command Center now queries real data across members, agents, vendors, products, enrollments, invoices, commissions, and emails',
      'Smart multi-level autocomplete for search, new, open, and goto commands',
      'Comprehensive features showcase page listing all admin portal capabilities',
      'Learning Center with getting started guide, module tutorials, FAQ, and changelog',
      'Admin footer matching CRM footer pattern with quick navigation links',
    ],
  },
  {
    version: 'v1.4.0',
    date: 'January 2026',
    type: 'major',
    highlights: [
      'Admin Portal UX/UI Modernization',
      'Dashboard trend metrics and analytics',
      'Collapsible sidebar navigation',
      'Live system status indicators',
    ],
    details: [
      'Redesigned dashboard with stat cards, trend indicators, and pulse animations',
      'Future enrollments card showing upcoming activations',
      'Member activity analysis with retention rate tracking',
      'Collapsible navigation sections with localStorage persistence',
      'Live status indicator in top navigation bar',
      'Consistent PageHeader component across all pages',
    ],
  },
  {
    version: 'v1.3.0',
    date: 'January 2026',
    type: 'major',
    highlights: [
      'Communications module (Phase 5)',
      'Email templates with Resend integration',
      'Sent email tracking and history',
      'Notification preferences',
    ],
  },
  {
    version: 'v1.2.0',
    date: 'January 2026',
    type: 'major',
    highlights: [
      'Enrollment Links (Phase 4)',
      'Agent-branded landing pages',
      'QR code generation',
      'Click and enrollment analytics',
    ],
  },
  {
    version: 'v1.1.0',
    date: 'January 2026',
    type: 'major',
    highlights: [
      'Commission Engine (Phase 3)',
      'Multi-tier commission structures',
      'Transaction tracking and payout processing',
      'Advisor earnings dashboard',
    ],
  },
  {
    version: 'v1.0.0',
    date: 'January 2026',
    type: 'major',
    highlights: [
      'Initial Admin Portal release (Phase 1 & 2)',
      'Member, Agent, Product, Enrollment management',
      'Billing & Payments with Authorize.Net',
      'Role-based access control and audit logging',
    ],
    details: [
      'Full member profile management with dependent tracking',
      'Agent/advisor management with licensing and branding',
      'Product/plan configuration with pricing matrix',
      'Enrollment lifecycle management with approval workflows',
      'Billing integration with Authorize.Net for payment processing',
      'Invoice generation and tracking',
      'Vendor management',
      'Operations dashboard with eligibility and job monitoring',
      'Settings with security, automations, and audit logs',
      'Command Center terminal interface',
    ],
  },
];

const typeBadge = {
  major: { label: 'Major', className: 'bg-emerald-100 text-emerald-700' },
  minor: { label: 'Minor', className: 'bg-blue-100 text-blue-700' },
  patch: { label: 'Patch', className: 'bg-slate-100 text-slate-700' },
};

export default function ChangelogPage() {
  return (
    <ArticleLayout
      title="Changelog"
      description="Track new features, improvements, and fixes across Admin Portal releases."
    >
      <div className="space-y-6">
        {RELEASES.map((release) => (
          <SectionCard key={release.version} title="">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-slate-900">{release.version}</h2>
              <Badge className={typeBadge[release.type].className}>
                {typeBadge[release.type].label}
              </Badge>
              <span className="text-sm text-slate-500">{release.date}</span>
            </div>

            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">Highlights</h3>
              <ul className="list-disc pl-5 space-y-1.5">
                {release.highlights.map((h, i) => (
                  <li key={i} className="text-slate-700">{h}</li>
                ))}
              </ul>
            </div>

            {release.details && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">Details</h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  {release.details.map((d, i) => (
                    <li key={i} className="text-slate-600 text-sm">{d}</li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>
        ))}
      </div>
    </ArticleLayout>
  );
}
