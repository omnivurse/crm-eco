import Link from 'next/link';
import {
  Users,
  UserPlus,
  Building2,
  DollarSign,
  Mail,
  MessageSquare,
  Send,
  Repeat,
  FileText,
  FolderOpen,
  FileSignature,
  Globe,
  Upload,
  GitBranch,
  Link2,
  RefreshCcw,
  BarChart3,
  PieChart,
  TrendingUp,
  Target,
  Zap,
  Workflow,
  Bot,
  Star,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Activity,
  Inbox,
  Bell,
  Search,
  Command,
  Moon,
  Sun,
  Shield,
  Lock,
  Key,
  Webhook,
  Settings,
  Palette,
  Layout,
  Columns3,
  Database,
  Heart,
  ClipboardList,
  HeartHandshake,
  Wallet,
  Receipt,
  FileCheck,
  Package,
  BookOpen,
  GraduationCap,
  Video,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Phone,
  CreditCard,
  Cloud,
  PenTool,
  ShoppingCart,
  Layers,
  List,
  LayoutGrid,
  Clock,
  AlertTriangle,
  Play,
  History,
  FormInput,
  Gavel,
  FileCode,
  Timer,
  Swords,
  UserCog,
  Building,
  Network,
  ScrollText,
  Eye,
  RotateCcw,
  Megaphone,
  MessageCircle,
  Import,
  Filter,
  Bookmark,
  StickyNote,
  MousePointerClick,
  MailOpen,
  ClipboardCheck,
  Gauge,
  Trophy,
  Lightbulb,
  HelpCircle,
  PlayCircle,
  ListChecks,
  FileSpreadsheet,
  Combine,
  Mic,
  AudioWaveform,
  Terminal,
  Download,
  Table,
  FolderKanban,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
  href?: string;
  isNew?: boolean;
  isBeta?: boolean;
}

function FeatureCard({ icon, title, description, features, href, isNew, isBeta }: FeatureCardProps) {
  return (
    <div className="group relative bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 hover:border-teal-500/50 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500/10 to-emerald-500/10 text-teal-600 dark:text-teal-400">
          {icon}
        </div>
        <div className="flex gap-2">
          {isNew && (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
              NEW
            </Badge>
          )}
          {isBeta && (
            <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400">
              BETA
            </Badge>
          )}
        </div>
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{description}</p>
      <ul className="space-y-2 mb-4">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-teal-500 flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>
      {href && (
        <Link href={href}>
          <Button variant="ghost" size="sm" className="gap-1 text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 p-0">
            Explore <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
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

function FeatureSection({ title, subtitle, children, gradient = 'from-teal-500 to-emerald-500' }: FeatureSectionProps) {
  return (
    <section className="py-16">
      <div className="text-center mb-12">
        <h2 className={`text-3xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent mb-3`}>
          {title}
        </h2>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
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
    <div className="max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="text-center py-16 px-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-teal-500/10 to-emerald-500/10 border border-teal-500/20 mb-6">
          <Sparkles className="w-4 h-4 text-teal-500" />
          <span className="text-sm font-medium text-teal-600 dark:text-teal-400">
            Enterprise-Grade CRM Platform
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">
          Everything You Need to{' '}
          <span className="bg-gradient-to-r from-teal-500 to-emerald-500 bg-clip-text text-transparent">
            Grow Your Business
          </span>
        </h1>
        <p className="text-xl text-slate-500 dark:text-slate-400 max-w-3xl mx-auto mb-8">
          A comprehensive CRM solution built for health sharing organizations.
          Manage contacts, automate communications, track revenue, and streamline operations - all in one powerful platform.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/crm">
            <Button size="lg" className="gap-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400">
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/crm/learn">
            <Button size="lg" variant="outline" className="gap-2">
              <GraduationCap className="w-4 h-4" /> Learning Center
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
        {[
          { label: 'Core Modules', value: '15+' },
          { label: 'Total Features', value: '90+' },
          { label: 'Automation Tools', value: '12+' },
          { label: 'Integrations', value: '15+' },
        ].map((stat, index) => (
          <div key={index} className="text-center p-6 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="text-3xl font-bold bg-gradient-to-r from-teal-500 to-emerald-500 bg-clip-text text-transparent">
              {stat.value}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* CRM Core Features */}
      <FeatureSection
        title="CRM Core"
        subtitle="Powerful contact and relationship management at the heart of your business"
      >
        <FeatureCard
          icon={<Users className="w-6 h-6" />}
          title="Contact Management"
          description="Comprehensive contact database with rich profiles and relationship tracking"
          features={[
            'Unlimited contacts with custom fields',
            'Contact timeline & activity history',
            'Tags, segments, and smart lists',
            'Duplicate detection & merging',
          ]}
          href="/crm/modules/contacts"
        />
        <FeatureCard
          icon={<UserPlus className="w-6 h-6" />}
          title="Lead Management"
          description="Capture, qualify, and convert leads with intelligent pipeline management"
          features={[
            'Lead scoring and qualification',
            'Web-to-lead forms',
            'Lead source tracking',
            'Automated lead routing',
          ]}
          href="/crm/modules/leads"
        />
        <FeatureCard
          icon={<Building2 className="w-6 h-6" />}
          title="Account Management"
          description="Track organizations and their relationships with your business"
          features={[
            'Hierarchical account structures',
            'Account health scoring',
            'Key contact mapping',
            'Account activity feed',
          ]}
          href="/crm/accounts"
        />
        <FeatureCard
          icon={<DollarSign className="w-6 h-6" />}
          title="Deal Pipeline"
          description="Visual sales pipeline with drag-and-drop deal management"
          features={[
            'Customizable pipeline stages',
            'Deal forecasting',
            'Win/loss analysis',
            'Revenue projections',
          ]}
          href="/crm/pipeline"
        />
        <FeatureCard
          icon={<Swords className="w-6 h-6" />}
          title="Deal War Room"
          description="Real-time deal collaboration hub for strategic selling"
          features={[
            'Stakeholder management',
            'Activity tracking',
            'Team collaboration',
            'Deal intelligence',
          ]}
          href="/crm/modules/deals"
          isNew
        />
        <FeatureCard
          icon={<Activity className="w-6 h-6" />}
          title="Activity Tracking"
          description="Log and track all interactions with your contacts and accounts"
          features={[
            'Calls, emails, meetings, tasks',
            'Automatic activity logging',
            'Activity reminders',
            'Team activity feeds',
          ]}
          href="/crm/activities"
        />
        <FeatureCard
          icon={<Calendar className="w-6 h-6" />}
          title="Calendar"
          description="Full calendar integration with two-way sync"
          features={[
            'Google Calendar sync',
            'Outlook Calendar sync',
            'Event linking to records',
            'Meeting scheduling',
          ]}
          href="/crm/calendar"
        />
        <FeatureCard
          icon={<CalendarCheck className="w-6 h-6" />}
          title="Organizer"
          description="Personal activity organizer for daily productivity"
          features={[
            'Day, week, month views',
            'Task management',
            'Activity planning',
            'Priority management',
          ]}
          href="/crm/organizer"
        />
        <FeatureCard
          icon={<Upload className="w-6 h-6" />}
          title="Data Import"
          description="Seamlessly import your existing data from any source"
          features={[
            'CSV, Excel, and API imports',
            'Smart field mapping',
            'Duplicate handling rules',
            'Saved import templates',
          ]}
          href="/crm/import"
        />
      </FeatureSection>

      {/* Email & Communications */}
      <FeatureSection
        title="Email & Communications"
        subtitle="Enterprise-grade email marketing and communication tools"
        gradient="from-blue-500 to-indigo-500"
      >
        <FeatureCard
          icon={<Inbox className="w-6 h-6" />}
          title="Unified Inbox"
          description="All communications in one centralized location"
          features={[
            'Email integration',
            'SMS messages',
            'Call logs',
            'Conversation threading',
          ]}
          href="/crm/inbox"
        />
        <FeatureCard
          icon={<Send className="w-6 h-6" />}
          title="Email Campaigns"
          description="Create and send beautiful email campaigns at scale"
          features={[
            'Rich text editor (TipTap)',
            'A/B testing',
            'Scheduled sending',
            'Campaign analytics',
          ]}
          href="/crm/campaigns"
          isNew
        />
        <FeatureCard
          icon={<Repeat className="w-6 h-6" />}
          title="Email Sequences"
          description="Automated email drip campaigns for nurturing leads"
          features={[
            'Multi-step sequences',
            'Trigger-based automation',
            'Personalization tokens',
            'Performance tracking',
          ]}
          href="/crm/sequences"
        />
        <FeatureCard
          icon={<FileText className="w-6 h-6" />}
          title="Email Templates"
          description="Create reusable templates with rich text editing"
          features={[
            'TipTap rich text editor',
            'Merge field support',
            'Template categories',
            'Version history',
          ]}
          href="/crm/settings/templates"
        />
        <FeatureCard
          icon={<FolderOpen className="w-6 h-6" />}
          title="Asset Library"
          description="Centralized image and file management for emails"
          features={[
            'Drag-and-drop upload',
            'Folder organization',
            'Image optimization',
            'Public URL generation',
          ]}
          href="/crm/email/assets"
          isNew
        />
        <FeatureCard
          icon={<FileSignature className="w-6 h-6" />}
          title="Email Signatures"
          description="Professional email signatures for your team"
          features={[
            'Visual signature builder',
            'Logo and photo support',
            'Social media links',
            'Per-user signatures',
          ]}
          href="/crm/settings/signatures"
        />
        <FeatureCard
          icon={<Globe className="w-6 h-6" />}
          title="Email Domains"
          description="Configure and verify your sending domains"
          features={[
            'Domain verification',
            'SPF/DKIM/DMARC setup',
            'Sender address management',
            'Deliverability monitoring',
          ]}
          href="/crm/settings/email-domains"
        />
        <FeatureCard
          icon={<MailOpen className="w-6 h-6" />}
          title="Email Tracking"
          description="Track email opens, clicks, and engagement"
          features={[
            'Open rate tracking',
            'Click tracking',
            'Bounce monitoring',
            'Engagement scoring',
          ]}
          href="/crm/campaigns"
        />
        <FeatureCard
          icon={<MessageCircle className="w-6 h-6" />}
          title="Communications Hub"
          description="Central view of all communication activities"
          features={[
            'Multi-channel overview',
            'Performance metrics',
            'Quick compose',
            'Communication history',
          ]}
          href="/crm/communications"
        />
      </FeatureSection>

      {/* Vendor Management */}
      <FeatureSection
        title="Vendor Management"
        subtitle="Centralize vendor data, file processing, and change detection"
        gradient="from-purple-500 to-pink-500"
      >
        <FeatureCard
          icon={<Building2 className="w-6 h-6" />}
          title="Vendor Hub"
          description="Centralized dashboard for all vendor integrations"
          features={[
            'Vendor profiles & status',
            'Integration settings',
            'Sync configuration',
            'Activity monitoring',
          ]}
          href="/crm/vendors"
          isNew
        />
        <FeatureCard
          icon={<Upload className="w-6 h-6" />}
          title="File Upload & Processing"
          description="Upload and process vendor data files automatically"
          features={[
            'CSV, Excel, XML, JSON support',
            'Smart column mapping',
            'Validation rules',
            'Processing status tracking',
          ]}
          href="/crm/vendors/upload"
          isNew
        />
        <FeatureCard
          icon={<GitBranch className="w-6 h-6" />}
          title="Change Detection"
          description="Review and approve vendor data changes before applying"
          features={[
            'Automatic change detection',
            'Severity classification',
            'Bulk approve/reject',
            'Audit trail',
          ]}
          href="/crm/vendors/changes"
          isNew
        />
        <FeatureCard
          icon={<Link2 className="w-6 h-6" />}
          title="Connectors"
          description="Automated data sync with vendor systems"
          features={[
            'SFTP, API, Webhook support',
            'Scheduled syncs',
            'Error handling',
            'Run history',
          ]}
          href="/crm/vendors/connectors"
        />
        <FeatureCard
          icon={<RefreshCcw className="w-6 h-6" />}
          title="Processing Jobs"
          description="Monitor file processing status and history"
          features={[
            'Real-time progress',
            'Row-level status',
            'Error details',
            'Retry capabilities',
          ]}
          href="/crm/vendors/jobs"
        />
        <FeatureCard
          icon={<Database className="w-6 h-6" />}
          title="Data Normalization"
          description="Automatically normalize and validate vendor data"
          features={[
            'Field transformations',
            'Data validation rules',
            'Format standardization',
            'Matching algorithms',
          ]}
        />
      </FeatureSection>

      {/* Health Sharing */}
      <FeatureSection
        title="Health Sharing"
        subtitle="Purpose-built features for health sharing organizations"
        gradient="from-rose-500 to-red-500"
      >
        <FeatureCard
          icon={<ClipboardList className="w-6 h-6" />}
          title="Enrollment Management"
          description="Streamline member enrollment processes"
          features={[
            'Online enrollment forms',
            'Document collection',
            'Status tracking',
            'Automated notifications',
          ]}
          href="/crm/enrollment"
        />
        <FeatureCard
          icon={<HeartHandshake className="w-6 h-6" />}
          title="Needs Management"
          description="Track and manage member healthcare needs"
          features={[
            'Needs submission portal',
            'Review workflow',
            'Provider matching',
            'Payment tracking',
          ]}
          href="/crm/needs"
        />
        <FeatureCard
          icon={<Gauge className="w-6 h-6" />}
          title="Command Center"
          description="Centralized needs monitoring dashboard"
          features={[
            'Real-time status overview',
            'SLA tracking',
            'Urgency management',
            'Team workload view',
          ]}
          href="/crm/needs/command-center"
        />
        <FeatureCard
          icon={<CheckCircle2 className="w-6 h-6" />}
          title="Approval Workflows"
          description="Multi-step approval processes for needs and enrollments"
          features={[
            'Customizable workflows',
            'Role-based approvals',
            'Automatic escalation',
            'Approval history',
          ]}
          href="/crm/approvals"
        />
        <FeatureCard
          icon={<Wallet className="w-6 h-6" />}
          title="Commission Tracking"
          description="Track agent commissions and payments"
          features={[
            'Multi-tier commissions',
            'Override commissions',
            'Commission hierarchy',
            'Rate management',
          ]}
          href="/crm/commissions"
        />
        <FeatureCard
          icon={<Receipt className="w-6 h-6" />}
          title="Payment Processing"
          description="Handle member payments and billing"
          features={[
            'Credit card processing',
            'ACH payments',
            'Payment history',
            'Billing management',
          ]}
        />
        <FeatureCard
          icon={<Package className="w-6 h-6" />}
          title="Plan Management"
          description="Configure and manage health sharing plans"
          features={[
            'Plan configuration',
            'Pricing tiers',
            'Coverage details',
            'Plan comparison',
          ]}
          href="/crm/products"
        />
        <FeatureCard
          icon={<FileText className="w-6 h-6" />}
          title="Documents"
          description="Manage enrollment and member documents"
          features={[
            'Document upload',
            'Version control',
            'Access controls',
            'Document linking',
          ]}
          href="/crm/documents"
        />
        <FeatureCard
          icon={<Shield className="w-6 h-6" />}
          title="HIPAA Compliance"
          description="Built-in security for healthcare data"
          features={[
            'Data encryption',
            'Access logging',
            'Audit trail',
            'Secure storage',
          ]}
        />
      </FeatureSection>

      {/* Automation & Workflows */}
      <FeatureSection
        title="Automation & Workflows"
        subtitle="Work smarter with intelligent automation and workflow tools"
        gradient="from-amber-500 to-orange-500"
      >
        <FeatureCard
          icon={<Workflow className="w-6 h-6" />}
          title="Workflow Builder"
          description="Visual workflow builder with drag-and-drop interface"
          features={[
            'Visual workflow designer',
            'Trigger conditions',
            'Action sequences',
            'Workflow testing',
          ]}
          href="/crm/settings/automations/workflows"
        />
        <FeatureCard
          icon={<Zap className="w-6 h-6" />}
          title="Automation Rules"
          description="Event-driven automation for record updates"
          features={[
            'Event triggers',
            'Condition evaluation',
            'Field updates',
            'Email notifications',
          ]}
          href="/crm/settings/automations/rules"
        />
        <FeatureCard
          icon={<Play className="w-6 h-6" />}
          title="Macros"
          description="Bulk action macros for quick operations"
          features={[
            'Record field updates',
            'Bulk operations',
            'One-click execution',
            'Macro templates',
          ]}
          href="/crm/settings/automations/macros"
        />
        <FeatureCard
          icon={<Star className="w-6 h-6" />}
          title="Lead Scoring"
          description="Automatically score and prioritize leads"
          features={[
            'Scoring models',
            'Behavioral scoring',
            'Demographic scoring',
            'Score calculation',
          ]}
          href="/crm/settings/automations/scoring"
        />
        <FeatureCard
          icon={<Network className="w-6 h-6" />}
          title="Assignment Rules"
          description="Automatically assign leads and records to team members"
          features={[
            'Round-robin assignment',
            'Territory mapping',
            'Load balancing',
            'Criteria-based routing',
          ]}
          href="/crm/settings/automations/assignment"
        />
        <FeatureCard
          icon={<Timer className="w-6 h-6" />}
          title="Cadences"
          description="Multi-step engagement sequences across channels"
          features={[
            'Step sequencing',
            'Timing controls',
            'Multi-channel support',
            'Progress tracking',
          ]}
          href="/crm/settings/automations/cadences"
        />
        <FeatureCard
          icon={<Clock className="w-6 h-6" />}
          title="SLA Management"
          description="Service level agreement tracking and escalation"
          features={[
            'SLA rules',
            'Response time tracking',
            'Escalation management',
            'SLA reporting',
          ]}
          href="/crm/settings/automations/sla"
        />
        <FeatureCard
          icon={<Gavel className="w-6 h-6" />}
          title="Approval Processes"
          description="Define and enforce approval workflows"
          features={[
            'Custom approval processes',
            'Rule-based triggers',
            'Multi-step approvals',
            'Approval actions',
          ]}
          href="/crm/settings/automations/approvals"
        />
        <FeatureCard
          icon={<FormInput className="w-6 h-6" />}
          title="Webforms"
          description="Lead capture forms for your website"
          features={[
            'Form builder',
            'Field mapping',
            'Auto-record creation',
            'Public form links',
          ]}
          href="/crm/settings/automations/webforms"
        />
        <FeatureCard
          icon={<Bot className="w-6 h-6" />}
          title="Auto-Responses"
          description="Automated email and SMS responses"
          features={[
            'Trigger-based responses',
            'Template library',
            'Personalization',
            'Response tracking',
          ]}
          href="/crm/settings/automations/responses"
        />
        <FeatureCard
          icon={<BookOpen className="w-6 h-6" />}
          title="Playbooks"
          description="Guided sales processes for your team"
          features={[
            'Step-by-step guides',
            'Best practices',
            'Task templates',
            'Performance tracking',
          ]}
          href="/crm/playbooks"
          isNew
        />
        <FeatureCard
          icon={<History className="w-6 h-6" />}
          title="Automation Runs"
          description="Monitor and audit automation execution"
          features={[
            'Execution history',
            'Error tracking',
            'Retry capability',
            'Run statistics',
          ]}
          href="/crm/settings/automations/runs"
        />
      </FeatureSection>

      {/* Analytics & Reporting */}
      <FeatureSection
        title="Analytics & Reporting"
        subtitle="Data-driven insights to make better business decisions"
        gradient="from-cyan-500 to-blue-500"
      >
        <FeatureCard
          icon={<BarChart3 className="w-6 h-6" />}
          title="Reports & Templates"
          description="Comprehensive reporting with 20+ pre-built templates across 7 categories"
          features={[
            'Sales, Marketing, Team, Operations templates',
            'Finance & Productivity reports',
            'One-click template execution',
            'Save & schedule reports',
          ]}
          href="/crm/reports"
          isNew
        />
        <FeatureCard
          icon={<FolderKanban className="w-6 h-6" />}
          title="Saved Reports"
          description="Save, organize, and track your favorite reports"
          features={[
            'Personal report library',
            'Run history tracking',
            'Favorite reports',
            'Quick re-run capability',
          ]}
          href="/crm/reports/saved"
          isNew
        />
        <FeatureCard
          icon={<PieChart className="w-6 h-6" />}
          title="Dashboards"
          description="Visual dashboards for real-time insights"
          features={[
            'Drag-and-drop widgets',
            'Real-time data',
            'Custom date ranges',
            'Shareable dashboards',
          ]}
          href="/crm/analytics"
        />
        <FeatureCard
          icon={<TrendingUp className="w-6 h-6" />}
          title="Forecasting"
          description="Sales forecasting and revenue predictions"
          features={[
            'Pipeline forecasting',
            'Win probability',
            'Revenue projections',
            'Trend analysis',
          ]}
          href="/crm/forecasting"
        />
        <FeatureCard
          icon={<Target className="w-6 h-6" />}
          title="Goals & Targets"
          description="Set and track team and individual goals"
          features={[
            'Goal setting',
            'Progress tracking',
            'Team leaderboards',
            'Achievement badges',
          ]}
        />
        <FeatureCard
          icon={<Trophy className="w-6 h-6" />}
          title="Scorecards"
          description="Performance scorecards and KPI tracking"
          features={[
            'KPI definitions',
            'Team performance',
            'Goal management',
            'Achievement visualization',
          ]}
          href="/crm/settings/scorecards"
        />
        <FeatureCard
          icon={<Activity className="w-6 h-6" />}
          title="Activity Analytics"
          description="Track team productivity and engagement"
          features={[
            'Activity metrics',
            'Response times',
            'Engagement scores',
            'Performance trends',
          ]}
        />
        <FeatureCard
          icon={<Mail className="w-6 h-6" />}
          title="Email Analytics"
          description="Track email campaign performance"
          features={[
            'Open rates',
            'Click tracking',
            'Bounce rates',
            'Unsubscribe tracking',
          ]}
        />
        <FeatureCard
          icon={<FileSpreadsheet className="w-6 h-6" />}
          title="Sales Reports"
          description="Detailed sales performance reporting"
          features={[
            'Pipeline reports',
            'Revenue reports',
            'Activity reports',
            'Conversion reports',
          ]}
          href="/crm/reports/sales"
        />
        <FeatureCard
          icon={<Download className="w-6 h-6" />}
          title="Data Export"
          description="Export your data in multiple formats"
          features={[
            'CSV export for spreadsheets',
            'Excel (XLSX) support',
            'JSON for developers',
            'Bulk data downloads',
          ]}
          isNew
        />
        <FeatureCard
          icon={<Table className="w-6 h-6" />}
          title="Query Builder"
          description="Build custom queries with our visual query engine"
          features={[
            'Multi-source data access',
            'Dynamic filtering',
            'Aggregations & grouping',
            'Sort & pagination',
          ]}
          href="/crm/reports/new"
          isNew
        />
        <FeatureCard
          icon={<ScrollText className="w-6 h-6" />}
          title="Audit Trail"
          description="Complete audit logging for compliance"
          features={[
            'Change tracking',
            'User attribution',
            'Timestamp logging',
            'Action history',
          ]}
        />
      </FeatureSection>

      {/* Productivity */}
      <FeatureSection
        title="Productivity Tools"
        subtitle="Stay organized and efficient with powerful productivity features"
        gradient="from-green-500 to-teal-500"
      >
        <FeatureCard
          icon={<CalendarCheck className="w-6 h-6" />}
          title="Scheduling"
          description="Appointment scheduling and availability management"
          features={[
            'Public booking links',
            'Availability management',
            'Timezone handling',
            'Calendar integration',
          ]}
          href="/crm/scheduling"
        />
        <FeatureCard
          icon={<ClipboardCheck className="w-6 h-6" />}
          title="Task Management"
          description="Create, assign, and track tasks"
          features={[
            'Task creation',
            'Due dates & priorities',
            'Task assignment',
            'Completion tracking',
          ]}
          href="/crm/tasks"
        />
        <FeatureCard
          icon={<StickyNote className="w-6 h-6" />}
          title="Notes"
          description="Add notes and comments to any record"
          features={[
            'Note creation',
            'Rich text support',
            'Note history',
            'Record linking',
          ]}
        />
        <FeatureCard
          icon={<Bell className="w-6 h-6" />}
          title="Notifications"
          description="Stay informed with smart notifications"
          features={[
            'In-app notifications',
            'Email alerts',
            'Custom triggers',
            'Quiet hours',
          ]}
        />
        <FeatureCard
          icon={<Search className="w-6 h-6" />}
          title="Global Search"
          description="Find anything instantly across your CRM"
          features={[
            'Full-text search',
            'Filter by type',
            'Recent searches',
            'Search suggestions',
          ]}
        />
        <FeatureCard
          icon={<Command className="w-6 h-6" />}
          title="Command Palette"
          description="Keyboard-driven navigation for power users"
          features={[
            'Quick navigation',
            'Instant actions',
            'Search commands',
            'Keyboard shortcuts',
          ]}
        />
        <FeatureCard
          icon={<Eye className="w-6 h-6" />}
          title="Recent Views"
          description="Quick access to recently viewed records"
          features={[
            'Recently viewed list',
            'Quick navigation',
            'Record type filtering',
            'Time-based sorting',
          ]}
        />
        <FeatureCard
          icon={<Bookmark className="w-6 h-6" />}
          title="Saved Views"
          description="Create and save filtered list views"
          features={[
            'Custom filters',
            'Column configuration',
            'View sharing',
            'Default views',
          ]}
        />
        <FeatureCard
          icon={<Filter className="w-6 h-6" />}
          title="Advanced Filters"
          description="Powerful filtering across all modules"
          features={[
            'Multiple conditions',
            'AND/OR logic',
            'Date ranges',
            'Custom fields',
          ]}
        />
      </FeatureSection>

      {/* Integrations */}
      <FeatureSection
        title="Integrations"
        subtitle="Connect with your favorite tools and services"
        gradient="from-indigo-500 to-purple-500"
      >
        <FeatureCard
          icon={<Mail className="w-6 h-6" />}
          title="Email Integration"
          description="Connect your email provider"
          features={[
            'SendGrid integration',
            'Gmail integration',
            'Outlook sync',
            'Email tracking',
          ]}
          href="/crm/integrations/email"
        />
        <FeatureCard
          icon={<Phone className="w-6 h-6" />}
          title="SMS & Voice"
          description="Twilio integration for SMS and calls"
          features={[
            'SMS sending',
            'Inbound messages',
            'Call tracking',
            'Voice drops',
          ]}
          href="/crm/integrations/phone"
        />
        <FeatureCard
          icon={<Calendar className="w-6 h-6" />}
          title="Calendar Sync"
          description="Sync with external calendars"
          features={[
            'Google Calendar',
            'Outlook Calendar',
            'Two-way sync',
            'Event creation',
          ]}
          href="/crm/integrations/calendar"
        />
        <FeatureCard
          icon={<Video className="w-6 h-6" />}
          title="Video Conferencing"
          description="Integrate video meeting providers"
          features={[
            'Zoom integration',
            'Google Meet',
            'Microsoft Teams',
            'Meeting link generation',
          ]}
          href="/crm/integrations/video"
        />
        <FeatureCard
          icon={<CreditCard className="w-6 h-6" />}
          title="Payment Processing"
          description="Integrate payment processors"
          features={[
            'Stripe integration',
            'Authorize.net',
            'Credit card processing',
            'ACH payments',
          ]}
          href="/crm/integrations/payments"
        />
        <FeatureCard
          icon={<Cloud className="w-6 h-6" />}
          title="Cloud Storage"
          description="Connect cloud storage providers"
          features={[
            'Google Drive',
            'Dropbox',
            'OneDrive',
            'File synchronization',
          ]}
          href="/crm/integrations/cloud-storage"
        />
        <FeatureCard
          icon={<PenTool className="w-6 h-6" />}
          title="E-Signature"
          description="Electronic signature integration"
          features={[
            'DocuSign',
            'HelloSign',
            'Document signing',
            'Signature tracking',
          ]}
          href="/crm/integrations/esign"
        />
        <FeatureCard
          icon={<ShoppingCart className="w-6 h-6" />}
          title="Commerce"
          description="E-commerce platform integration"
          features={[
            'Order synchronization',
            'Customer sync',
            'Product catalog',
            'Revenue tracking',
          ]}
          href="/crm/integrations/commerce"
        />
        <FeatureCard
          icon={<RefreshCcw className="w-6 h-6" />}
          title="CRM Sync"
          description="Two-way sync with other CRMs"
          features={[
            'Zoho CRM sync',
            'Salesforce sync',
            'Contact sync',
            'Deal sync',
          ]}
          href="/crm/integrations/crm-sync"
        />
        <FeatureCard
          icon={<MessageSquare className="w-6 h-6" />}
          title="WhatsApp"
          description="WhatsApp business messaging"
          features={[
            'Send messages',
            'Receive messages',
            'Conversation threading',
            'Template messages',
          ]}
          href="/crm/integrations/chat"
          isBeta
        />
        <FeatureCard
          icon={<Webhook className="w-6 h-6" />}
          title="Webhooks"
          description="Real-time event notifications"
          features={[
            'Event triggers',
            'Custom payloads',
            'Retry logic',
            'Webhook logs',
          ]}
          href="/crm/integrations/webhooks"
        />
        <FeatureCard
          icon={<Key className="w-6 h-6" />}
          title="API Access"
          description="Full REST API for custom integrations"
          features={[
            'RESTful API',
            'API key management',
            'OAuth support',
            'Rate limiting',
          ]}
          href="/crm/integrations/api"
        />
      </FeatureSection>

      {/* Administration */}
      <FeatureSection
        title="Administration & Settings"
        subtitle="Powerful tools to customize and manage your CRM"
        gradient="from-slate-500 to-slate-700"
      >
        <FeatureCard
          icon={<Settings className="w-6 h-6" />}
          title="System Settings"
          description="Configure your CRM to match your needs"
          features={[
            'Organization settings',
            'Regional preferences',
            'Business hours',
            'Fiscal year',
          ]}
          href="/crm/settings"
        />
        <FeatureCard
          icon={<Layers className="w-6 h-6" />}
          title="Module Configuration"
          description="Enable and configure CRM modules"
          features={[
            'Module customization',
            'Icon/name configuration',
            'Module ordering',
            'Module permissions',
          ]}
          href="/crm/settings/modules"
        />
        <FeatureCard
          icon={<List className="w-6 h-6" />}
          title="Custom Fields"
          description="Add custom fields to any module"
          features={[
            'Multiple field types',
            'Required fields',
            'Default values',
            'Field validation',
          ]}
          href="/crm/settings/fields"
        />
        <FeatureCard
          icon={<Layout className="w-6 h-6" />}
          title="Page Layouts"
          description="Customize record layouts with sections"
          features={[
            'Section management',
            'Field arrangement',
            'Layout templates',
            'Role-based layouts',
          ]}
          href="/crm/settings/layouts"
        />
        <FeatureCard
          icon={<FileCode className="w-6 h-6" />}
          title="Blueprints"
          description="Define stage-based record states"
          features={[
            'Stage definitions',
            'Field visibility per stage',
            'Required fields',
            'Transition rules',
          ]}
          href="/crm/settings/blueprints"
        />
        <FeatureCard
          icon={<AlertTriangle className="w-6 h-6" />}
          title="Validation Rules"
          description="Create custom field validation"
          features={[
            'Required if conditions',
            'Format validation',
            'Range validation',
            'Custom error messages',
          ]}
          href="/crm/settings/customization/validation-rules"
        />
        <FeatureCard
          icon={<Users className="w-6 h-6" />}
          title="User Management"
          description="Manage team members and access"
          features={[
            'User provisioning',
            'Role assignment',
            'Team invitations',
            'User deactivation',
          ]}
          href="/crm/settings/users"
        />
        <FeatureCard
          icon={<Shield className="w-6 h-6" />}
          title="Roles & Permissions"
          description="Fine-grained access control"
          features={[
            'Custom roles',
            'Module permissions',
            'Field-level security',
            'Data sharing rules',
          ]}
          href="/crm/settings/users?tab=roles"
        />
        <FeatureCard
          icon={<Lock className="w-6 h-6" />}
          title="Security Settings"
          description="Enterprise-grade security controls"
          features={[
            'Password policies',
            'Two-factor authentication',
            'Session management',
            'Access logging',
          ]}
          href="/crm/settings/security"
        />
        <FeatureCard
          icon={<Megaphone className="w-6 h-6" />}
          title="Landing Pages"
          description="Create campaign landing pages"
          features={[
            'Page builder',
            'Form embedding',
            'Conversion tracking',
            'A/B testing',
          ]}
          href="/crm/settings/landing-pages"
        />
        <FeatureCard
          icon={<Palette className="w-6 h-6" />}
          title="Customization"
          description="Tailor the CRM to your brand"
          features={[
            'Logo upload',
            'Color themes',
            'Custom views',
            'Personal settings',
          ]}
          href="/crm/settings/customization"
        />
        <FeatureCard
          icon={<Gauge className="w-6 h-6" />}
          title="System Health"
          description="Monitor system performance"
          features={[
            'Performance metrics',
            'System status',
            'Health indicators',
            'Resource usage',
          ]}
          href="/crm/settings/system-health"
        />
      </FeatureSection>

      {/* Learning Center */}
      <FeatureSection
        title="Learning Center"
        subtitle="Comprehensive documentation, tutorials, and training resources"
        gradient="from-violet-500 to-purple-500"
      >
        <FeatureCard
          icon={<BookOpen className="w-6 h-6" />}
          title="Documentation"
          description="Complete user guides and documentation"
          features={[
            'Getting started guides',
            'Feature documentation',
            'Best practices',
            'Troubleshooting',
          ]}
          href="/crm/learn"
        />
        <FeatureCard
          icon={<PlayCircle className="w-6 h-6" />}
          title="Video Tutorials"
          description="Step-by-step video walkthroughs"
          features={[
            'Feature demos',
            'Setup guides',
            'Tips & tricks',
            'New feature highlights',
          ]}
          href="/crm/learn/videos"
        />
        <FeatureCard
          icon={<Lightbulb className="w-6 h-6" />}
          title="Getting Started"
          description="Quick start guides for new users"
          features={[
            'Dashboard overview',
            'Navigation guide',
            'Profile setup',
            'First steps',
          ]}
          href="/crm/learn/getting-started"
        />
        <FeatureCard
          icon={<ListChecks className="w-6 h-6" />}
          title="Module Guides"
          description="Detailed guides for each module"
          features={[
            'Contacts guide',
            'Leads guide',
            'Deals guide',
            'Campaigns guide',
          ]}
          href="/crm/learn/contacts"
        />
        <FeatureCard
          icon={<HelpCircle className="w-6 h-6" />}
          title="FAQ"
          description="Frequently asked questions"
          features={[
            'Common questions',
            'Troubleshooting',
            'Quick answers',
            'Problem solving',
          ]}
          href="/crm/learn/faq"
        />
        <FeatureCard
          icon={<ScrollText className="w-6 h-6" />}
          title="Changelog"
          description="Track new features and updates"
          features={[
            'Release notes',
            'New features',
            'Bug fixes',
            'Improvements',
          ]}
          href="/crm/learn/changelog"
        />
      </FeatureSection>

      {/* User Experience */}
      <FeatureSection
        title="User Experience"
        subtitle="Designed for productivity and ease of use"
        gradient="from-pink-500 to-rose-500"
      >
        <FeatureCard
          icon={<Mic className="w-6 h-6" />}
          title="Voice Command Center"
          description="Control your CRM with natural voice commands"
          features={[
            'Navigate with "Show me leads"',
            'Query data: "How many deals?"',
            'Create tasks by speaking',
            'Hands-free productivity',
          ]}
          href="/crm/learn/voice"
          isNew
        />
        <FeatureCard
          icon={<Terminal className="w-6 h-6" />}
          title="Command Terminal"
          description="Power-user command-line interface for quick actions"
          features={[
            'Keyboard shortcuts (Ctrl+K)',
            'Quick navigation commands',
            'System controls',
            'Developer-friendly',
          ]}
          isNew
        />
        <FeatureCard
          icon={<Moon className="w-6 h-6" />}
          title="Dark Mode"
          description="Beautiful dark theme for reduced eye strain"
          features={[
            'System preference sync',
            'Manual toggle',
            'Consistent styling',
            'Smooth transitions',
          ]}
        />
        <FeatureCard
          icon={<LayoutGrid className="w-6 h-6" />}
          title="Responsive Design"
          description="Works on any device"
          features={[
            'Desktop optimized',
            'Tablet support',
            'Mobile friendly',
            'Touch gestures',
          ]}
        />
        <FeatureCard
          icon={<Zap className="w-6 h-6" />}
          title="Fast Performance"
          description="Lightning-fast application performance"
          features={[
            'Instant page loads',
            'Optimized queries',
            'Smart caching',
            'Background sync',
          ]}
        />
        <FeatureCard
          icon={<Lock className="w-6 h-6" />}
          title="Security"
          description="Enterprise-grade security"
          features={[
            'Row-level security',
            'Encrypted data',
            'Audit logging',
            'Session management',
          ]}
        />
        <FeatureCard
          icon={<Combine className="w-6 h-6" />}
          title="Multi-Tenant"
          description="Complete organization isolation"
          features={[
            'Data separation',
            'Org-level settings',
            'Role-based access',
            'Secure boundaries',
          ]}
        />
        <FeatureCard
          icon={<RotateCcw className="w-6 h-6" />}
          title="Data Recovery"
          description="Never lose important data"
          features={[
            'Undo actions',
            'Record history',
            'Version control',
            'Backup support',
          ]}
        />
      </FeatureSection>

      {/* CTA Section */}
      <div className="py-16 text-center">
        <div className="max-w-3xl mx-auto bg-gradient-to-r from-teal-500 to-emerald-500 rounded-3xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Business?</h2>
          <p className="text-lg text-teal-100 mb-8">
            Start using all these powerful features today and take your customer relationships to the next level.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/crm">
              <Button size="lg" variant="secondary" className="gap-2">
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/crm/learn/getting-started">
              <Button size="lg" variant="outline" className="gap-2 bg-transparent border-white text-white hover:bg-white/10">
                <BookOpen className="w-4 h-4" /> Getting Started Guide
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
