import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Plug,
  Mail,
  Phone,
  Video,
  Calendar,
  ShoppingBag,
  CreditCard,
  MessageSquare,
  PenTool,
  Database,
  ChevronRight,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { getCurrentProfile } from '@/lib/crm/queries';
import { getConnections, getHealthSummary } from '@/lib/integrations';
import type { ConnectionType, IntegrationConnection, HealthSummary } from '@/lib/integrations';

// ============================================================================
// Type Definitions
// ============================================================================

interface IntegrationCategory {
  type: ConnectionType;
  name: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  {
    type: 'email',
    name: 'Email',
    description: 'SendGrid, Resend, Mailgun',
    icon: <Mail className="w-5 h-5" />,
    href: '/crm/integrations/email',
    color: 'blue',
  },
  {
    type: 'phone',
    name: 'Phone & SMS',
    description: 'Twilio, RingCentral, GoTo',
    icon: <Phone className="w-5 h-5" />,
    href: '/crm/integrations/phone',
    color: 'green',
  },
  {
    type: 'video',
    name: 'Video',
    description: 'Zoom, Google Meet, Teams',
    icon: <Video className="w-5 h-5" />,
    href: '/crm/integrations/video',
    color: 'purple',
  },
  {
    type: 'calendar',
    name: 'Calendar',
    description: 'Google Calendar, Outlook',
    icon: <Calendar className="w-5 h-5" />,
    href: '/crm/integrations/calendar',
    color: 'orange',
  },
  {
    type: 'chat',
    name: 'Chat',
    description: 'Slack, WhatsApp',
    icon: <MessageSquare className="w-5 h-5" />,
    href: '/crm/integrations/chat',
    color: 'indigo',
  },
  {
    type: 'commerce',
    name: 'Commerce',
    description: 'Shopify, WooCommerce',
    icon: <ShoppingBag className="w-5 h-5" />,
    href: '/crm/integrations/commerce',
    color: 'emerald',
  },
  {
    type: 'payments',
    name: 'Payments',
    description: 'Stripe, Square, Authorize.net',
    icon: <CreditCard className="w-5 h-5" />,
    href: '/crm/integrations/payments',
    color: 'violet',
  },
  {
    type: 'esign',
    name: 'E-Sign',
    description: 'DocuSign, PandaDoc',
    icon: <PenTool className="w-5 h-5" />,
    href: '/crm/integrations/esign',
    color: 'amber',
  },
  {
    type: 'crm_sync',
    name: 'CRM Sync',
    description: 'Zoho, Salesforce, HubSpot',
    icon: <Database className="w-5 h-5" />,
    href: '/crm/integrations/crm-sync',
    color: 'rose',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusInfo(connections: IntegrationConnection[], type: ConnectionType) {
  const typeConnections = connections.filter(c => c.connection_type === type);
  const connected = typeConnections.filter(c => c.status === 'connected').length;
  const hasError = typeConnections.some(c => c.status === 'error' || c.health_status === 'unhealthy');
  
  if (connected === 0) {
    return { status: 'not_configured', label: 'Not Configured', color: 'slate' };
  }
  if (hasError) {
    return { status: 'error', label: 'Error', color: 'red' };
  }
  return { status: 'connected', label: `${connected} Connected`, color: 'green' };
}

function getLastSyncTime(connections: IntegrationConnection[], type: ConnectionType) {
  const typeConnections = connections.filter(c => c.connection_type === type);
  const lastSync = typeConnections
    .map(c => c.last_sync_at)
    .filter(Boolean)
    .sort()
    .reverse()[0];
  
  if (!lastSync) return null;
  
  const date = new Date(lastSync);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
  return `${Math.floor(diffMinutes / 1440)}d ago`;
}

// ============================================================================
// Components
// ============================================================================

function StatusBadge({ status, color }: { status: string; color: string }) {
  const colorClasses: Record<string, string> = {
    green: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
    red: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
    slate: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400',
  };
  
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${colorClasses[color] || colorClasses.slate}`}>
      {status}
    </span>
  );
}

function IntegrationCard({
  category,
  connections,
}: {
  category: IntegrationCategory;
  connections: IntegrationConnection[];
}) {
  const statusInfo = getStatusInfo(connections, category.type);
  const lastSync = getLastSyncTime(connections, category.type);
  
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-green-500/10 text-green-600 dark:text-green-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  };
  
  return (
    <Link
      href={category.href}
      className="group glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-teal-500/50 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${colorClasses[category.color] || colorClasses.blue}`}>
          {category.icon}
        </div>
        <StatusBadge status={statusInfo.label} color={statusInfo.color} />
      </div>
      
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
        {category.name}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
        {category.description}
      </p>
      
      <div className="flex items-center justify-between">
        {lastSync ? (
          <span className="text-xs text-slate-500 dark:text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {lastSync}
          </span>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-600">No sync yet</span>
        )}
        <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-teal-500 transition-colors" />
      </div>
    </Link>
  );
}

function HealthSummaryCard({ summary }: { summary: HealthSummary }) {
  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-teal-500/10 rounded-lg">
          <Activity className="w-5 h-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">System Health</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Integration status overview</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {summary.total_connections}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Total</div>
        </div>
        
        <div className="text-center p-3 bg-green-50 dark:bg-green-500/10 rounded-lg">
          <div className="flex items-center justify-center gap-1 text-2xl font-bold text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-5 h-5" />
            {summary.connected_count}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Connected</div>
        </div>
        
        <div className="text-center p-3 bg-red-50 dark:bg-red-500/10 rounded-lg">
          <div className="flex items-center justify-center gap-1 text-2xl font-bold text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5" />
            {summary.error_count}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Errors</div>
        </div>
        
        <div className="text-center p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
          <div className="flex items-center justify-center gap-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
            <Clock className="w-5 h-5" />
            {summary.recent_errors}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">24h Errors</div>
        </div>
      </div>
    </div>
  );
}

function QuickActions() {
  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h3>
      
      <div className="space-y-2">
        <Link
          href="/crm/integrations/logs"
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <FileText className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-900 dark:text-white">View Logs</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">See all integration activity</div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </Link>
        
        <Link
          href="/crm/settings/system-health"
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <Activity className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-900 dark:text-white">System Health</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Monitor performance</div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </Link>
        
        <button
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-900 dark:text-white">Refresh Status</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Update all connections</div>
          </div>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Content
// ============================================================================

async function IntegrationsContent() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/crm-login');
  }
  
  // Fetch connections and health summary
  const [{ connections }, summary] = await Promise.all([
    getConnections(),
    getHealthSummary(),
  ]);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-xl">
            <Plug className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Integration Command Center
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Manage all your third-party integrations in one place
            </p>
          </div>
        </div>
        
        <Link
          href="/crm/settings"
          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>
      </div>
      
      {/* Health Summary */}
      <HealthSummaryCard summary={summary} />
      
      {/* Integration Categories Grid */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Integrations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {INTEGRATION_CATEGORIES.map((category) => (
            <IntegrationCard
              key={category.type}
              category={category}
              connections={connections}
            />
          ))}
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickActions />
        
        {/* Recent Activity */}
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Recent Activity</h3>
          
          {connections.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                <Plug className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-500 dark:text-slate-400">No integrations configured yet</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                Connect your first integration to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {connections
                .filter(c => c.last_sync_at)
                .sort((a, b) => new Date(b.last_sync_at!).getTime() - new Date(a.last_sync_at!).getTime())
                .slice(0, 5)
                .map((connection) => (
                  <div
                    key={connection.id}
                    className="flex items-center gap-3 p-2 rounded-lg"
                  >
                    <div className={`w-2 h-2 rounded-full ${
                      connection.status === 'connected' ? 'bg-green-500' :
                      connection.status === 'error' ? 'bg-red-500' :
                      'bg-slate-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {connection.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {connection.provider} • {getLastSyncTime([connection], connection.connection_type)}
                      </div>
                    </div>
                  </div>
                ))}
              
              {connections.filter(c => c.last_sync_at).length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
                  No recent activity
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Page Export
// ============================================================================

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<IntegrationsSkeleton />}>
      <IntegrationsContent />
    </Suspense>
  );
}

function IntegrationsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-slate-200 dark:bg-slate-800/50 rounded-xl" />
        <div>
          <div className="h-7 w-64 bg-slate-200 dark:bg-slate-800/50 rounded" />
          <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800/50 rounded mt-2" />
        </div>
      </div>
      
      {/* Health Summary Skeleton */}
      <div className="h-40 bg-slate-200 dark:bg-slate-800/50 rounded-xl" />
      
      {/* Grid Skeleton */}
      <div>
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800/50 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 bg-slate-200 dark:bg-slate-800/50 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
