'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button, Textarea } from '@crm-eco/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@crm-eco/ui';
import { MessageSquare, Send, Loader2, CheckCircle } from 'lucide-react';
import { createMemberTicket } from '@/app/support/actions';

const CATEGORIES = [
  { value: 'general', label: 'General Question' },
  { value: 'enrollment', label: 'Enrollment / Membership' },
  { value: 'billing', label: 'Billing / Payments' },
  { value: 'needs', label: 'Needs / Sharing' },
  { value: 'technical', label: 'Technical Support' },
];

interface SupportTicketFormProps {
  onTicketCreated?: () => void;
}

export function SupportTicketForm({ onTicketCreated }: SupportTicketFormProps) {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await createMemberTicket({
        subject,
        category,
        message,
      });

      if (!result.success) {
        setError(result.error || 'Failed to submit ticket');
        return;
      }

      // Success
      setSuccess(true);
      setSubject('');
      setCategory('');
      setMessage('');

      // Notify parent
      onTicketCreated?.();

      // Refresh the page data
      router.refresh();

      // Clear success after 5 seconds
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          Contact Support
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600 mb-6">
          Have a question or need help? Send us a message and we&apos;ll get back to you 
          as soon as possible, usually within 1 business day.
        </p>

        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-green-900 font-medium">Message Sent!</p>
              <p className="text-sm text-green-700">
                Your support request has been submitted. A team member will follow up 
                with you shortly.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              placeholder="Brief description of your question or issue"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={category}
              onValueChange={setCategory}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              placeholder="Please describe your question or issue in detail..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              disabled={loading}
              rows={5}
              className="resize-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button 
              type="submit" 
              disabled={loading || !subject || !category || !message}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Ticket
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

