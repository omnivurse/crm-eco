'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  FileCheck,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Send,
  Copy,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  DollarSign,
  User,
  Calendar,
  FileText,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@crm-eco/ui/lib/utils';

// ============================================================================
// Type Definitions
// ============================================================================

interface Quote {
  id: string;
  quote_number: string;
  title: string | null;
  status: string;
  subtotal: number;
  discount_value: number;
  tax_amount: number;
  total: number;
  valid_until: string | null;
  created_at: string;
  contact?: { id: string; title: string }[] | null;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_OPTIONS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-slate-500/10 text-slate-600', icon: FileText },
  sent: { label: 'Sent', color: 'bg-blue-500/10 text-blue-600', icon: Send },
  viewed: { label: 'Viewed', color: 'bg-purple-500/10 text-purple-600', icon: Eye },
  accepted: { label: 'Accepted', color: 'bg-emerald-500/10 text-emerald-600', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-600', icon: XCircle },
  expired: { label: 'Expired', color: 'bg-amber-500/10 text-amber-600', icon: Clock },
};

// ============================================================================
// Components
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function QuoteCard({
  quote,
  onEdit,
  onDelete,
  onDuplicate,
  onSend,
}: {
  quote: Quote;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSend: () => void;
}) {
  const status = STATUS_OPTIONS[quote.status] || STATUS_OPTIONS.draft;
  const StatusIcon = status.icon;
  const contactName = quote.contact?.[0]?.title || 'No contact';
  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date();

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-blue-500/50 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-blue-600 dark:text-blue-400">
              {quote.quote_number}
            </span>
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1', status.color)}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {quote.title || 'Untitled Quote'}
          </h3>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Quote
            </DropdownMenuItem>
            {quote.status === 'draft' && (
              <DropdownMenuItem onClick={onSend}>
                <Send className="w-4 h-4 mr-2" />
                Send Quote
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="w-4 h-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
        <span className="flex items-center gap-1">
          <User className="w-4 h-4" />
          {contactName}
        </span>
        {quote.valid_until && (
          <span className={cn('flex items-center gap-1', isExpired && 'text-red-500')} suppressHydrationWarning>
            <Calendar className="w-4 h-4" />
            Valid until {new Date(quote.valid_until).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
        <span className="text-xs text-slate-500" suppressHydrationWarning>
          Created {new Date(quote.created_at).toLocaleDateString()}
        </span>
        <span className="text-lg font-bold text-slate-900 dark:text-white">
          {formatCurrency(quote.total)}
        </span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  };

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2.5 rounded-lg', colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function QuotesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadQuotes();
  }, []);

  async function loadQuotes() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;
      setOrganizationId(profile.organization_id);

      const { data, error } = await supabase
        .from('quotes')
        .select(`
          id,
          quote_number,
          title,
          status,
          subtotal,
          discount_value,
          tax_amount,
          total,
          valid_until,
          created_at,
          contact:crm_records!quotes_contact_id_fkey(id, title)
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotes((data || []) as unknown as Quote[]);
    } catch (error) {
      console.error('Error loading quotes:', error);
      // Table might not exist yet - that's ok
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteQuote(quote: Quote) {
    if (!confirm(`Are you sure you want to delete quote ${quote.quote_number}?`)) return;

    try {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quote.id);

      if (error) throw error;
      toast.success('Quote deleted successfully');
      await loadQuotes();
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast.error('Failed to delete quote');
    }
  }

  async function handleDuplicateQuote(quote: Quote) {
    if (!organizationId) return;

    try {
      // Get next quote number
      const { data: nextNumberData } = await supabase.rpc('generate_quote_number', {
        org_id: organizationId,
      });

      const { error } = await supabase
        .from('quotes')
        .insert({
          organization_id: organizationId,
          quote_number: nextNumberData || `Q-${Date.now()}`,
          title: `${quote.title || 'Quote'} (Copy)`,
          status: 'draft',
          subtotal: quote.subtotal,
          discount_value: quote.discount_value,
          tax_amount: quote.tax_amount,
          total: quote.total,
        });

      if (error) throw error;
      toast.success('Quote duplicated successfully');
      await loadQuotes();
    } catch (error) {
      console.error('Error duplicating quote:', error);
      toast.error('Failed to duplicate quote');
    }
  }

  async function handleSendQuote(quote: Quote) {
    try {
      const { error } = await supabase
        .from('quotes')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', quote.id);

      if (error) throw error;
      toast.success('Quote sent successfully');
      await loadQuotes();
    } catch (error) {
      console.error('Error sending quote:', error);
      toast.error('Failed to send quote');
    }
  }

  // Filter quotes
  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = !searchQuery ||
      quote.quote_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const totalValue = quotes.reduce((sum, q) => sum + (q.total || 0), 0);
  const pendingCount = quotes.filter(q => ['draft', 'sent', 'viewed'].includes(q.status)).length;
  const acceptanceRate = quotes.length > 0
    ? Math.round((quotes.filter(q => q.status === 'accepted').length / quotes.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl">
            <FileCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quotes</h1>
            <p className="text-slate-500 dark:text-slate-400">
              Create and send professional quotes to your prospects
            </p>
          </div>
        </div>

        <Link href="/crm/quotes/new">
          <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400">
            <Plus className="w-4 h-4 mr-2" />
            Create Quote
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Quotes" value={quotes.length} icon={FileCheck} color="blue" />
        <StatCard label="Total Value" value={formatCurrency(totalValue)} icon={DollarSign} color="emerald" />
        <StatCard label="Pending" value={pendingCount} icon={Clock} color="amber" />
        <StatCard label="Acceptance Rate" value={`${acceptanceRate}%`} icon={CheckCircle2} color="violet" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search quotes..."
            className="pl-10"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          {Object.entries(STATUS_OPTIONS).map(([value, { label }]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Quotes Grid */}
      {filteredQuotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              onEdit={() => router.push(`/crm/quotes/${quote.id}/edit`)}
              onDelete={() => handleDeleteQuote(quote)}
              onDuplicate={() => handleDuplicateQuote(quote)}
              onSend={() => handleSendQuote(quote)}
            />
          ))}
        </div>
      ) : (
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
          <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 w-fit mx-auto mb-4">
            <FileCheck className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-900 dark:text-white font-medium mb-1">
            {searchQuery || statusFilter !== 'all' ? 'No matching quotes' : 'No quotes yet'}
          </p>
          <p className="text-slate-500 text-sm mb-4">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create professional quotes to send to your prospects'
            }
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <Link href="/crm/quotes/new">
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400">
                <Plus className="w-4 h-4 mr-2" />
                Create First Quote
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
