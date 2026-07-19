import { ArrowRight, Bell, BookOpen, Buildings, Calendar, CaretRight, ChartBar, ChartPie, ChatCircle, CheckCircle, ClipboardText, Clock, CreditCard, CurrencyDollar, EnvelopeSimple, File, FileText, GearSix, GraduationCap, Heart, Lightbulb, Lightning, Link as LinkIcon, ListChecks, Lock, MagnifyingGlass, Package, PlayCircle, Pulse, QrCode, Question, Receipt, Scroll, ShieldCheck, Sparkle, Stack, TerminalWindow, TrendUp, UserCircleGear, UserPlus, Users, Wallet } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
  href?: string;
  isNew?: boolean;
}

function FeatureCard({ icon, title, description, features, href, isNew }: FeatureCardProps) {
  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200 p-6 hover:border-[#0891b2]/50 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-[#0891b2]/10 to-[#059669]/10 text-[#0891b2]">
          {icon}
        </div>
        {isNew && (
          <Badge className="bg-emerald-100 text-emerald-700">NEW</Badge>
        )}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 mb-4">{description}</p>
      <ul className="space-y-2 mb-4">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-2 text-sm text-slate-600">
            <CheckCircle weight="light" className="w-4 h-4 text-[#0891b2] flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>
      {href && (
        <Button variant="ghost" size="sm" className="gap-1 text-[#0891b2] hover:text-[#0e7490] p-0" asChild>
          <Link href={href}>
            Explore <CaretRight weight="light" className="w-4 h-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}

interface FeatureSectionProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  gradient?: string;
}

function FeatureSection({ title, subtitle, children, gradient = 'from-[#0891b2] to-[#059669]' }: FeatureSectionProps) {
  return (
    <section className="py-12">
      <div className="text-center mb-10">
        <h2 className={`text-3xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent mb-3`}>
          {title}
        </h2>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
          {subtitle}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {children}
      </div>
    </section>
  );
}

export default function FeaturesPage() {
  return (
    <div className="w-full">
      {/* Hero Section */}
      <div className="text-center py-12 px-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#0891b2]/10 to-[#059669]/10 border border-[#0891b2]/20 mb-6">
          <Sparkle weight="light" className="w-4 h-4 text-[#0891b2]" />
          <span className="text-sm font-medium text-[#0891b2]">
            Admin Portal Feature Suite
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
          Everything You Need to{' '}
          <span className="bg-gradient-to-r from-[#0891b2] to-[#059669] bg-clip-text text-transparent">
            Manage Your Organization
          </span>
        </h1>
        <p className="text-xl text-slate-500 max-w-3xl mx-auto mb-8">
          A comprehensive administration platform built for health sharing organizations.
          Manage members, agents, enrollments, billing, commissions, and communications — all from one powerful dashboard.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" className="gap-2 bg-gradient-to-r from-[#0891b2] to-[#059669] hover:from-[#0e7490] hover:to-[#047857]" asChild>
            <Link href="/dashboard">
              Go to Dashboard <ArrowRight weight="light" className="w-4 h-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="gap-2" asChild>
            <Link href="/learn">
              <GraduationCap weight="light" className="w-4 h-4" /> Learning Center
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {[
          { label: 'Core Modules', value: '12+' },
          { label: 'Total Features', value: '60+' },
          { label: 'MagnifyingGlass Commands', value: '30+' },
          { label: 'Learn Articles', value: '25+' },
        ].map((stat, index) => (
          <div key={index} className="text-center p-6 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
            <div className="text-3xl font-bold bg-gradient-to-r from-[#0891b2] to-[#059669] bg-clip-text text-transparent">
              {stat.value}
            </div>
            <div className="text-sm text-slate-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Member Management */}
      <FeatureSection
        title="Member Management"
        subtitle="Comprehensive member profiles, dependent tracking, and household management"
      >
        <FeatureCard
          icon={<Users weight="light" className="w-6 h-6" />}
          title="Member Profiles"
          description="Complete member database with rich profiles and contact information"
          features={[
            'Full member profiles with custom fields',
            'Contact history & activity timeline',
            'Status tracking (active, inactive, pending)',
            'Quick search & advanced filtering',
          ]}
          href="/members"
        />
        <FeatureCard
          icon={<Heart weight="light" className="w-6 h-6" />}
          title="Dependent Management"
          description="Track household members and coverage dependents"
          features={[
            'Spouse and child dependents',
            'Coverage role assignments',
            'Enrollment linkage per dependent',
            'Household grouping',
          ]}
          href="/members"
        />
        <FeatureCard
          icon={<UserPlus weight="light" className="w-6 h-6" />}
          title="Member Import & Export"
          description="Bulk import and export member data efficiently"
          features={[
            'CSV import with field mapping',
            'Duplicate detection',
            'Bulk status updates',
            'Data export to CSV/Excel',
          ]}
          href="/members/import"
        />
      </FeatureSection>

      {/* Agent/Advisor Management */}
      <FeatureSection
        title="Agent & Advisor Management"
        subtitle="Manage your sales force with licensing, branding, and performance tracking"
        gradient="from-blue-500 to-indigo-500"
      >
        <FeatureCard
          icon={<UserCircleGear weight="light" className="w-6 h-6" />}
          title="Agent Profiles"
          description="Comprehensive advisor profiles with licensing and compliance data"
          features={[
            'License number tracking',
            'Commission tier assignments',
            'Agent status management',
            'Contact & territory info',
          ]}
          href="/agents"
        />
        <FeatureCard
          icon={<Sparkle weight="light" className="w-6 h-6" />}
          title="Agent Branding"
          description="Custom branding for agent enrollment pages and materials"
          features={[
            'Custom landing pages',
            'Agent-branded URLs',
            'Logo & color customization',
            'QR code generation',
          ]}
          href="/enrollment-links"
          isNew
        />
        <FeatureCard
          icon={<TrendUp weight="light" className="w-6 h-6" />}
          title="Performance Tracking"
          description="Monitor agent enrollment and revenue performance"
          features={[
            'Enrollment metrics per agent',
            'Commission earnings reports',
            'Active member counts',
            'Conversion analytics',
          ]}
          href="/reports"
        />
      </FeatureSection>

      {/* Enrollment Management */}
      <FeatureSection
        title="Enrollment Management"
        subtitle="Streamline the enrollment lifecycle from application to activation"
        gradient="from-emerald-500 to-green-500"
      >
        <FeatureCard
          icon={<ClipboardText weight="light" className="w-6 h-6" />}
          title="Enrollment Workflows"
          description="End-to-end enrollment processing with status tracking"
          features={[
            'Application submission & review',
            'Status tracking (pending, active, terminated)',
            'Effective date management',
            'Enrollment code generation',
          ]}
          href="/enrollments"
        />
        <FeatureCard
          icon={<File weight="light" className="w-6 h-6" />}
          title="Approval Process"
          description="Multi-step approval workflows for enrollment review"
          features={[
            'Submitted/approved/rejected workflows',
            'Approval by staff member tracking',
            'Rejection reason logging',
            'Audit trail for all changes',
          ]}
          href="/enrollments"
        />
        <FeatureCard
          icon={<LinkIcon weight="light" className="w-6 h-6" />}
          title="Enrollment Links & QR Codes"
          description="Agent-branded enrollment landing pages with QR generation"
          features={[
            'Custom landing page builder',
            'QR code generation for agents',
            'Click & enrollment analytics',
            'Shareable enrollment URLs',
          ]}
          href="/enrollment-links"
          isNew
        />
      </FeatureSection>

      {/* Product/Plan Management */}
      <FeatureSection
        title="Product & Plan Management"
        subtitle="Configure health sharing plans with flexible pricing and coverage options"
        gradient="from-purple-500 to-pink-500"
      >
        <FeatureCard
          icon={<Package weight="light" className="w-6 h-6" />}
          title="Plan Configuration"
          description="Create and manage health sharing plan offerings"
          features={[
            'Plan name, type, and carrier setup',
            'Coverage tier configuration',
            'Effective date management',
            'Plan status controls',
          ]}
          href="/products"
        />
        <FeatureCard
          icon={<CurrencyDollar weight="light" className="w-6 h-6" />}
          title="Pricing Matrix"
          description="Flexible pricing by age bands and household tiers"
          features={[
            'Age-band pricing rules',
            'Household tier pricing (member-only, family, etc.)',
            'Effective date versioning',
            'Historical rate tracking',
          ]}
          href="/products"
        />
        <FeatureCard
          icon={<Buildings weight="light" className="w-6 h-6" />}
          title="Vendor Assignment"
          description="Assign plans to vendor/carrier organizations"
          features={[
            'Vendor-plan relationship mapping',
            'Multi-vendor support',
            'Plan feature management',
            'Coverage detail configuration',
          ]}
          href="/vendors"
        />
      </FeatureSection>

      {/* Billing & Payments */}
      <FeatureSection
        title="Billing & Payments"
        subtitle="Integrated payment processing with Authorize.Net for seamless billing"
        gradient="from-amber-500 to-orange-500"
      >
        <FeatureCard
          icon={<CreditCard weight="light" className="w-6 h-6" />}
          title="Payment Processing"
          description="Authorize.Net integration for credit card and ACH payments"
          features={[
            'Credit card processing',
            'ACH/eCheck support',
            'Stored payment profiles',
            'PCI-compliant tokenization',
          ]}
          href="/billing"
          isNew
        />
        <FeatureCard
          icon={<Receipt weight="light" className="w-6 h-6" />}
          title="Invoicing"
          description="Automated invoice generation and tracking"
          features={[
            'Auto-generated invoice numbers',
            'Payment status tracking',
            'Amount due/paid reconciliation',
            'Invoice history & search',
          ]}
          href="/invoices"
        />
        <FeatureCard
          icon={<Calendar weight="light" className="w-6 h-6" />}
          title="Billing Schedules"
          description="Recurring billing automation for member contributions"
          features={[
            'Monthly billing cycles',
            'Failed payment retry logic',
            'Payment reminder notifications',
            'Billing schedule management',
          ]}
          href="/billing"
        />
      </FeatureSection>

      {/* Commission Engine */}
      <FeatureSection
        title="Commission Engine"
        subtitle="Multi-tier commission tracking and payout processing for agents"
        gradient="from-rose-500 to-red-500"
      >
        <FeatureCard
          icon={<Stack weight="light" className="w-6 h-6" />}
          title="Commission Tiers"
          description="Configurable multi-tier commission structures"
          features={[
            'Tier-based commission rates',
            'Override commission support',
            'Minimum enrollment thresholds',
            'Rate effective dating',
          ]}
          href="/commissions/tiers"
          isNew
        />
        <FeatureCard
          icon={<Wallet weight="light" className="w-6 h-6" />}
          title="Transaction Tracking"
          description="Track every commission transaction with full audit trail"
          features={[
            'Per-enrollment commission calculation',
            'Transaction status tracking',
            'Advisor earnings summaries',
            'Commission history search',
          ]}
          href="/commissions/transactions"
        />
        <FeatureCard
          icon={<CreditCard weight="light" className="w-6 h-6" />}
          title="Payout Processing"
          description="Process agent commission payouts efficiently"
          features={[
            'Batch payout processing',
            'Payment method management',
            'Payout history & reports',
            'Pending payout dashboard',
          ]}
          href="/commissions/payouts"
        />
      </FeatureSection>

      {/* Communications */}
      <FeatureSection
        title="Communications"
        subtitle="Email templates, notifications, and member communications powered by Resend"
        gradient="from-cyan-500 to-blue-500"
      >
        <FeatureCard
          icon={<EnvelopeSimple weight="light" className="w-6 h-6" />}
          title="Email Templates"
          description="Create and manage reusable email templates"
          features={[
            'Pre-built template library',
            'Custom HTML templates',
            'Merge field personalization',
            'Template categories & search',
          ]}
          href="/communications/templates"
          isNew
        />
        <FeatureCard
          icon={<ChatCircle weight="light" className="w-6 h-6" />}
          title="Email Sending"
          description="Send targeted emails via Resend integration"
          features={[
            'Single & bulk email sending',
            'Delivery status tracking',
            'Open & bounce monitoring',
            'Sent email history',
          ]}
          href="/communications/compose"
        />
        <FeatureCard
          icon={<Bell weight="light" className="w-6 h-6" />}
          title="Notification Preferences"
          description="Configure member and system notification settings"
          features={[
            'Per-member notification preferences',
            'Email frequency controls',
            'System alert configuration',
            'Opt-out management',
          ]}
          href="/communications"
        />
      </FeatureSection>

      {/* Vendor Management */}
      <FeatureSection
        title="Vendor Management"
        subtitle="Centralize vendor/carrier relationships and plan assignments"
        gradient="from-violet-500 to-purple-500"
      >
        <FeatureCard
          icon={<Buildings weight="light" className="w-6 h-6" />}
          title="Vendor Profiles"
          description="Complete vendor database with contact and contract info"
          features={[
            'Vendor name & contact details',
            'Vendor type classification',
            'Status management',
            'Plan assignment tracking',
          ]}
          href="/vendors"
        />
        <FeatureCard
          icon={<FileText weight="light" className="w-6 h-6" />}
          title="Vendor Plans"
          description="Map products and plans to vendor organizations"
          features={[
            'Plan-vendor relationship management',
            'Multi-plan vendor support',
            'Coverage detail linking',
            'Vendor performance metrics',
          ]}
          href="/vendors"
        />
        <FeatureCard
          icon={<QrCode weight="light" className="w-6 h-6" />}
          title="Vendor Operations"
          description="Operational tools for vendor data management"
          features={[
            'Vendor-specific dashboards',
            'Eligibility file processing',
            'Age-up/age-out reports',
            'Vendor sync operations',
          ]}
          href="/ops"
        />
      </FeatureSection>

      {/* Analytics & Reporting */}
      <FeatureSection
        title="Analytics & Reporting"
        subtitle="Data-driven insights for better organizational decisions"
        gradient="from-indigo-500 to-blue-500"
      >
        <FeatureCard
          icon={<ChartBar weight="light" className="w-6 h-6" />}
          title="Dashboard Analytics"
          description="Real-time metrics and KPIs on your admin dashboard"
          features={[
            'Total member & agent counts',
            'Active enrollment metrics',
            'Trend analysis (month-over-month)',
            'Commission revenue tracking',
          ]}
          href="/dashboard"
        />
        <FeatureCard
          icon={<ChartPie weight="light" className="w-6 h-6" />}
          title="Member Pulse Analysis"
          description="Understand enrollment trends and member retention"
          features={[
            'New enrollments per month',
            'Inactive member tracking',
            'Net growth calculations',
            'Retention rate analysis',
          ]}
          href="/dashboard"
        />
        <FeatureCard
          icon={<Pulse weight="light" className="w-6 h-6" />}
          title="Future Enrollments"
          description="Forecast upcoming enrollment activations"
          features={[
            'Upcoming activation calendar',
            'Enrollment pipeline view',
            'Days-until-start tracking',
            'Monthly projection summary',
          ]}
          href="/dashboard"
        />
      </FeatureSection>

      {/* Administration */}
      <FeatureSection
        title="Administration & Security"
        subtitle="Enterprise-grade tools for system management and compliance"
        gradient="from-slate-600 to-slate-800"
      >
        <FeatureCard
          icon={<Scroll weight="light" className="w-6 h-6" />}
          title="Audit Logs"
          description="Complete activity audit trail for compliance"
          features={[
            'Who-changed-what tracking',
            'Entity-level change history',
            'Actor attribution',
            'Searchable audit history',
          ]}
          href="/settings/audit-logs"
        />
        <FeatureCard
          icon={<ShieldCheck weight="light" className="w-6 h-6" />}
          title="Security & Access Control"
          description="Role-based access with middleware enforcement"
          features={[
            'Role-based access (owner, admin, staff)',
            'Middleware route protection',
            'API-level role validation',
            'Row-level security (RLS)',
          ]}
          href="/settings/security"
        />
        <FeatureCard
          icon={<Lightning weight="light" className="w-6 h-6" />}
          title="Automations"
          description="Automated workflows for operational tasks"
          features={[
            'Eligibility automation rules',
            'Billing schedule automation',
            'Notification triggers',
            'Enrollment status automation',
          ]}
          href="/settings/automations"
        />
        <FeatureCard
          icon={<GearSix weight="light" className="w-6 h-6" />}
          title="System GearSix"
          description="Configure your admin portal to match your needs"
          features={[
            'Organization settings',
            'Branding defaults',
            'System toggles',
            'Rate version management',
          ]}
          href="/settings"
        />
        <FeatureCard
          icon={<Lock weight="light" className="w-6 h-6" />}
          title="Data Security"
          description="HIPAA-ready data protection and encryption"
          features={[
            'Encrypted data at rest',
            'Secure API endpoints',
            'Session management',
            'Access logging',
          ]}
        />
        <FeatureCard
          icon={<Clock weight="light" className="w-6 h-6" />}
          title="Operations Center"
          description="Monitor jobs, scheduler, and system health"
          features={[
            'Job execution history',
            'Scheduled task management',
            'Eligibility file processing',
            'System health monitoring',
          ]}
          href="/ops"
        />
      </FeatureSection>

      {/* Command Center & Learning */}
      <FeatureSection
        title="Productivity & Learning"
        subtitle="Power tools for productivity and resources for learning the platform"
        gradient="from-teal-500 to-emerald-500"
      >
        <FeatureCard
          icon={<TerminalWindow weight="light" className="w-6 h-6" />}
          title="Command Center"
          description="Keyboard-driven terminal for power users with real-time search"
          features={[
            'Global search across all entities',
            'Quick navigation commands',
            'Real-time Supabase queries',
            'Smart autocomplete (Ctrl+K)',
          ]}
          isNew
        />
        <FeatureCard
          icon={<MagnifyingGlass weight="light" className="w-6 h-6" />}
          title="Global MagnifyingGlass"
          description="Find any record instantly across the entire system"
          features={[
            'Member, agent, vendor search',
            'Product & enrollment search',
            'Invoice & commission lookup',
            'Email & communication search',
          ]}
        />
        <FeatureCard
          icon={<BookOpen weight="light" className="w-6 h-6" />}
          title="Learning Center"
          description="Comprehensive guides and documentation for staff"
          features={[
            'Getting started guides',
            'Module-specific tutorials',
            'FAQ & troubleshooting',
            'Release changelog',
          ]}
          href="/learn"
        />
        <FeatureCard
          icon={<PlayCircle weight="light" className="w-6 h-6" />}
          title="Step-by-Step Guides"
          description="Detailed walkthroughs for every feature"
          features={[
            'Member management guides',
            'Enrollment processing tutorials',
            'Billing & commission guides',
            'Command Center reference',
          ]}
          href="/learn/getting-started"
        />
        <FeatureCard
          icon={<Lightbulb weight="light" className="w-6 h-6" />}
          title="Quick Tips"
          description="Contextual tips and best practices throughout the portal"
          features={[
            'Inline help tooltips',
            'Best practice recommendations',
            'Keyboard shortcut reference',
            'Pro tips for power users',
          ]}
          href="/learn/faq"
        />
        <FeatureCard
          icon={<ListChecks weight="light" className="w-6 h-6" />}
          title="FAQ & Changelog"
          description="Answers to common questions and release updates"
          features={[
            'Categorized FAQ sections',
            'Version release notes',
            'Feature announcements',
            'Known issues & fixes',
          ]}
          href="/learn/changelog"
        />
      </FeatureSection>

      {/* CTA Section */}
      <div className="py-12 text-center">
        <div className="w-full bg-primary rounded-3xl p-12 text-primary-foreground">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-lg text-primary-foreground/80 mb-8">
            Explore the full power of the Admin Portal and manage your organization more efficiently than ever.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" variant="secondary" className="gap-2" asChild>
              <Link href="/dashboard">
                Go to Dashboard <ArrowRight weight="light" className="w-4 h-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="gap-2 bg-transparent border-white text-white hover:bg-white/10" asChild>
              <Link href="/learn/getting-started">
                <BookOpen weight="light" className="w-4 h-4" /> Getting Started Guide
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
