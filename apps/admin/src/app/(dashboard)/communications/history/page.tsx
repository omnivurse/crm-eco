'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Mail,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  Send,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui/components/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';

interface SentEmail {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  status: string;
  from_email: string;
  triggered_by: string;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  error_message: string | null;
  body_html: string | null;
  email_templates: {
    name: string;
    slug: string;
  } | null;
}

const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'opened', label: 'Opened' },
  { value: 'clicked', label: 'Clicked' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'failed', label: 'Failed' },
];

export default function EmailHistoryPage() {
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEmail, setSelectedEmail] = useState<SentEmail | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;
  const supabase = createClient();

  useEffect(() => {
    loadEmails();
  }, [page, statusFilter]);

  async function loadEmails() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single() as { data: { organization_id: string } | null };

    if (!profile) return;

    let query = (supabase as any)
      .from('sent_emails')
      .select('*, email_templates(name, slug)', { count: 'exact' })
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, count } = await query;

    if (data) {
      setEmails(data);
      setTotalCount(count || 0);
    }

    setLoading(false);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'delivered':
      case 'opened':
      case 'clicked':
        return <Badge className="bg-emerald-100 text-emerald-700">{status}</Badge>;
      case 'failed':
      case 'bounced':
        return <Badge className="bg-red-100 text-red-700">{status}</Badge>;
      case 'pending':
      case 'queued':
        return <Badge className="bg-amber-100 text-amber-700">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'delivered':
      case 'opened':
      case 'clicked':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'failed':
      case 'bounced':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
      case 'queued':
        return <Clock className="w-4 h-4 text-amber-500" />;
      default:
        return <Send className="w-4 h-4 text-blue-500" />;
    }
  }

  const filteredEmails = searchQuery
    ? emails.filter(e =>
        e.recipient_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.subject.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : emails;

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Email History</h1>
          <p className="text-slate-600 mt-1">
            View all sent emails and their delivery status
          </p>
        </div>
        <Button variant="outline" onClick={loadEmails}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by email or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Emails Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sent Emails</CardTitle>
          <CardDescription>
            {totalCount} total emails
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded"></div>
              ))}
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="text-center py-16">
              <Mail className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No emails found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmails.map((email) => (
                    <TableRow key={email.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{email.recipient_email}</p>
                          {email.recipient_name && (
                            <p className="text-sm text-slate-500">{email.recipient_name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-xs truncate">{email.subject}</p>
                      </TableCell>
                      <TableCell>
                        {email.email_templates ? (
                          <Badge variant="outline">{email.email_templates.name}</Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(email.status)}
                          {getStatusBadge(email.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{new Date(email.created_at).toLocaleDateString()}</p>
                          <p className="text-slate-400">
                            {new Date(email.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedEmail(email)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-slate-500">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p - 1)}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Email Detail Dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Recipient</p>
                  <p className="font-medium">{selectedEmail.recipient_email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  {getStatusBadge(selectedEmail.status)}
                </div>
                <div>
                  <p className="text-sm text-slate-500">From</p>
                  <p className="font-medium">{selectedEmail.from_email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Triggered By</p>
                  <p className="font-medium capitalize">{selectedEmail.triggered_by}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-500 mb-1">Subject</p>
                <p className="font-medium">{selectedEmail.subject}</p>
              </div>

              {selectedEmail.error_message && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-700">{selectedEmail.error_message}</p>
                </div>
              )}

              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Created</p>
                  <p>{new Date(selectedEmail.created_at).toLocaleString()}</p>
                </div>
                {selectedEmail.sent_at && (
                  <div>
                    <p className="text-slate-500">Sent</p>
                    <p>{new Date(selectedEmail.sent_at).toLocaleString()}</p>
                  </div>
                )}
                {selectedEmail.delivered_at && (
                  <div>
                    <p className="text-slate-500">Delivered</p>
                    <p>{new Date(selectedEmail.delivered_at).toLocaleString()}</p>
                  </div>
                )}
                {selectedEmail.opened_at && (
                  <div>
                    <p className="text-slate-500">Opened</p>
                    <p>{new Date(selectedEmail.opened_at).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {selectedEmail.body_html && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Content Preview</p>
                  <div className="border rounded-lg overflow-hidden">
                    <iframe
                      srcDoc={selectedEmail.body_html}
                      className="w-full h-[400px]"
                      title="Email Content"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
