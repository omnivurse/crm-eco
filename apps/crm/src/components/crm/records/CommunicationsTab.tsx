'use client';

import { toast } from 'sonner';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Textarea,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@crm-eco/ui';
import { Mail, MessageSquare, Send, AlertCircle, CheckCircle, Clock, XCircle, Ban } from 'lucide-react';
import type { CrmMessage, CrmMessageTemplate, CrmContactPreferences } from '@/lib/comms/types';

interface CommunicationsTabProps {
  recordId: string;
  orgId: string;
  email?: string | null;
  phone?: string | null;
}

// Status badge component
function MessageStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    queued: { variant: 'outline', icon: <Clock className="h-3 w-3" /> },
    sending: { variant: 'outline', icon: <Clock className="h-3 w-3" /> },
    sent: { variant: 'secondary', icon: <CheckCircle className="h-3 w-3" /> },
    delivered: { variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
    failed: { variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
    bounced: { variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> },
    blocked: { variant: 'destructive', icon: <Ban className="h-3 w-3" /> },
  };
  
  const config = variants[status] || variants.sent;
  
  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      {config.icon}
      {status}
    </Badge>
  );
}

// Message item component
function MessageItem({ message }: { message: CrmMessage }) {
  const isOutbound = message.direction === 'outbound';
  
  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg p-3 ${
          isOutbound
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        }`}
      >
        {message.channel === 'email' && message.subject && (
          <p className="font-medium text-sm mb-1">{message.subject}</p>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
        <div className="flex items-center justify-between mt-2 gap-4">
          <span className="text-xs opacity-70" suppressHydrationWarning>
            {new Date(message.created_at).toLocaleString()}
          </span>
          {isOutbound && <MessageStatusBadge status={message.status} />}
        </div>
      </div>
    </div>
  );
}

export function CommunicationsTab({ recordId, orgId, email, phone }: CommunicationsTabProps) {
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  // Compose form state
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [templateId, setTemplateId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Load messages with React Query (cached, deduplicated)
  const messagesQuery = useQuery({
    queryKey: ['communications', 'messages', recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_messages')
        .select('*')
        .eq('record_id', recordId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CrmMessage[];
    },
    staleTime: 30_000, // 30 seconds
  });

  // Load templates with React Query (longer cache - templates rarely change)
  const templatesQuery = useQuery({
    queryKey: ['communications', 'templates', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_message_templates')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as CrmMessageTemplate[];
    },
    staleTime: 5 * 60_000, // 5 minutes - templates rarely change
  });

  // Load preferences with React Query
  const preferencesQuery = useQuery({
    queryKey: ['communications', 'preferences', recordId],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_contact_preferences')
        .select('*')
        .eq('record_id', recordId)
        .single();
      return data as CrmContactPreferences | null;
    },
    staleTime: 60_000, // 1 minute
  });

  const messages = messagesQuery.data || [];
  const templates = templatesQuery.data || [];
  const preferences = preferencesQuery.data;
  const loading = messagesQuery.isLoading || templatesQuery.isLoading || preferencesQuery.isLoading;

  // Handle template selection
  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    const template = templates.find(t => t.id === id);
    if (template) {
      setSubject(template.subject || '');
      setBody(template.body);
      setChannel(template.channel);
    }
  };

  // Handle send
  const handleSend = async () => {
    if (!body.trim()) return;

    setSending(true);
    try {
      const response = await fetch('/api/comms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
          channel,
          templateId: templateId || undefined,
          subject: channel === 'email' ? subject : undefined,
          body,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Invalidate cache to trigger refetch (React Query handles this efficiently)
        queryClient.invalidateQueries({ queryKey: ['communications', 'messages', recordId] });

        // Reset form
        setSubject('');
        setBody('');
        setTemplateId('');
        setComposeOpen(false);
      } else {
        toast.error(result.error || 'Failed to send message');
      }
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Filter messages by channel
  const emailMessages = messages.filter(m => m.channel === 'email');
  const smsMessages = messages.filter(m => m.channel === 'sms');

  const canEmail = email && !preferences?.do_not_email && !preferences?.unsubscribed_at;
  const canSms = phone && !preferences?.do_not_sms;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Preferences/Compliance Badges */}
      {preferences && (preferences.do_not_email || preferences.do_not_sms || preferences.unsubscribed_at) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Communication Preferences:</span>
              {preferences.do_not_email && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <Ban className="h-3 w-3" />
                  Do Not Email
                </Badge>
              )}
              {preferences.do_not_sms && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <Ban className="h-3 w-3" />
                  Do Not SMS
                </Badge>
              )}
              {preferences.unsubscribed_at && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <Ban className="h-3 w-3" />
                  Unsubscribed
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Communications Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Communications</CardTitle>
            <CardDescription>
              Email and SMS message history
            </CardDescription>
          </div>
          <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
            <DialogTrigger asChild>
              <Button disabled={!canEmail && !canSms}>
                <Send className="h-4 w-4 mr-2" />
                Compose
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Send Message</DialogTitle>
                <DialogDescription>
                  Compose and send an email or SMS to this contact.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Channel</Label>
                    <Select value={channel} onValueChange={(v) => setChannel(v as 'email' | 'sms')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email" disabled={!canEmail}>
                          <span className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email
                          </span>
                        </SelectItem>
                        <SelectItem value="sms" disabled={!canSms}>
                          <span className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            SMS
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Template (optional)</Label>
                    <Select value={templateId} onValueChange={handleTemplateChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates
                          .filter(t => t.channel === channel)
                          .map(t => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {channel === 'email' && (
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder="Enter email subject..."
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Enter your message..."
                    rows={6}
                  />
                  {channel === 'sms' && body.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {body.length} characters ({Math.ceil(body.length / 160)} segment{Math.ceil(body.length / 160) !== 1 ? 's' : ''})
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setComposeOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSend} disabled={sending || !body.trim()}>
                  {sending ? 'Sending...' : 'Send Message'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email">
            <TabsList>
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email ({emailMessages.length})
              </TabsTrigger>
              <TabsTrigger value="sms" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                SMS ({smsMessages.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="email">
              <div className="h-[400px] overflow-y-auto">
                {emailMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <Mail className="h-8 w-8 mb-2" />
                    <p>No email messages yet</p>
                  </div>
                ) : (
                  <div className="space-y-4 p-4">
                    {emailMessages.map(message => (
                      <MessageItem key={message.id} message={message} />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="sms">
              <div className="h-[400px] overflow-y-auto">
                {smsMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mb-2" />
                    <p>No SMS messages yet</p>
                  </div>
                ) : (
                  <div className="space-y-4 p-4">
                    {smsMessages.map(message => (
                      <MessageItem key={message.id} message={message} />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
