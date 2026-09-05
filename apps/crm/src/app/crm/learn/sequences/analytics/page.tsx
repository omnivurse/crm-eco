import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Clock,
  CheckCircle,
  Mail,
  Eye,
  MousePointer,
  UserMinus,
  TrendingUp,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Open Sequence',
    description: 'Navigate to your sequence to view its performance.',
    cursor: { x: 50, y: 35 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'View Overall Stats',
    description: 'See total enrolled, active, completed, and reply rates.',
    highlight: { x: 15, y: 18, width: 70, height: 15 },
    cursor: { x: 50, y: 25 },
    duration: 3000,
  },
  {
    title: 'Check Per-Step Metrics',
    description: 'Each email step shows its own open and click rates.',
    highlight: { x: 15, y: 38, width: 70, height: 35 },
    cursor: { x: 50, y: 55 },
    duration: 3500,
  },
  {
    title: 'See Where People Left',
    description: 'Exit reasons show why contacts stopped early.',
    highlight: { x: 15, y: 75, width: 35, height: 18 },
    cursor: { x: 32, y: 84 },
    duration: 2500,
  },
  {
    title: 'Check the Enrollment Mix',
    description: 'Active, paused, completed and exited counts at a glance.',
    highlight: { x: 55, y: 75, width: 30, height: 18 },
    cursor: { x: 70, y: 84 },
    action: 'click' as const,
    duration: 2500,
  },
];

const METRICS = [
  { icon: <Mail className="w-5 h-5" />, name: 'Emails Sent', value: '2,450', color: 'blue' },
  { icon: <Eye className="w-5 h-5" />, name: 'Open Rate', value: '58%', color: 'emerald' },
  { icon: <MousePointer className="w-5 h-5" />, name: 'Click Rate', value: '12%', color: 'violet' },
  { icon: <UserMinus className="w-5 h-5" />, name: 'Bounce Rate', value: '2%', color: 'amber' },
];

export default function SequenceAnalyticsPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <Link href="/crm/learn/sequences" className="text-slate-500 hover:text-teal-600 transition-colors">
          Sequences
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Sequence Analytics</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500">
          <BarChart3 className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Sequence Analytics
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Track sequence performance with per-step metrics and reply tracking.
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              4 min read
            </span>
          </div>
        </div>
      </div>

      {/* Video Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Interactive Demo
        </h2>
        <AnimatedDemo
          title="Viewing Sequence Analytics"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Sample Metrics */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Key Metrics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {METRICS.map((metric) => (
            <div
              key={metric.name}
              className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-center"
            >
              <div className={`mx-auto w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                metric.color === 'blue' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                metric.color === 'emerald' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                metric.color === 'violet' ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400' :
                'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
              }`}>
                {metric.icon}
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{metric.value}</div>
              <div className="text-xs text-slate-500">{metric.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Per-Step Analytics */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Per-Step Analytics
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Each email step in your sequence has its own metrics, helping you identify
          which emails perform best.
        </p>
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden overflow-x-auto">
          <div className="min-w-[500px]">
            <div className="grid grid-cols-5 gap-2 sm:gap-4 p-3 sm:p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="text-xs sm:text-sm font-medium text-slate-500">Step</div>
              <div className="text-xs sm:text-sm font-medium text-slate-500">Sent</div>
              <div className="text-xs sm:text-sm font-medium text-slate-500">Opens</div>
              <div className="text-xs sm:text-sm font-medium text-slate-500">Clicks</div>
              <div className="text-xs sm:text-sm font-medium text-slate-500">Bounced</div>
            </div>
            {[
              { step: 'Email 1: Introduction', sent: 500, opens: '62%', clicks: '15%', bounced: '2%' },
              { step: 'Email 2: Value Add', sent: 450, opens: '58%', clicks: '12%', bounced: '1%' },
              { step: 'Email 3: Case Study', sent: 400, opens: '55%', clicks: '18%', bounced: '1%' },
              { step: 'Email 4: Final Touch', sent: 320, opens: '45%', clicks: '8%', bounced: '3%' },
            ].map((row) => (
              <div key={row.step} className="grid grid-cols-5 gap-2 sm:gap-4 p-3 sm:p-4 border-b last:border-b-0 border-slate-200 dark:border-slate-700">
                <div className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white truncate">{row.step}</div>
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">{row.sent}</div>
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">{row.opens}</div>
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">{row.clicks}</div>
                <div className="text-xs sm:text-sm text-amber-600 dark:text-amber-400">{row.bounced}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Analyzing Performance */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Analyzing Your Sequence
        </h2>
        <StepList
          steps={[
            {
              title: 'Check How Many Finish',
              description:
                'Compare completed against exited. A high exit count means people are leaving before the sequence makes its point.',
            },
            {
              title: 'Compare Per-Step Performance',
              description: 'Identify which emails get the best engagement. Learn what works.',
            },
            {
              title: 'Look at Drop-off Points',
              description: 'Where do most people stop engaging? That step may need work.',
            },
            {
              title: 'Read the Exit Reasons',
              description:
                'Unsubscribes and bounces mean something different from replies. The exit list tells you which.',
            },
            {
              title: 'Watch the Bounce Rate',
              description:
                'Anything above a couple of percent suggests list quality problems that will hurt deliverability.',
            },
          ]}
        />
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Analytics Tips
        </h2>
        <div className="space-y-4">
          <QuickTip title="Give It Time" type="tip">
            Wait until at least 100 contacts have completed the sequence before
            drawing conclusions. Small samples can be misleading.
          </QuickTip>
          <QuickTip title="Opens Need Tracking Enabled" type="info">
            Open and click figures come from your email provider. If tracking is
            switched off for your sending domain, those columns stay at zero even
            though the emails were delivered normally.
          </QuickTip>
          <QuickTip title="Iterate Based on Data" type="warning">
            Don't change everything at once. Test one variable at a time (subject line,
            email length, CTA) to know what moved the needle.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Button variant="outline" className="gap-2" asChild>
          <Link href="/crm/learn/sequences/enrolling">
            <ArrowLeft className="w-4 h-4" />
            Previous: Enrolling Contacts
          </Link>
        </Button>
        <Button className="gap-2" asChild>
          <Link href="/crm/learn/workflows">
            Next: Workflows
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
