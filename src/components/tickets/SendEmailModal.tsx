import { useState, useEffect } from 'react';
import { X, Send, Mail, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: string;
  requester_email?: string;
  submitter_email?: string;
  submitter_name?: string;
  requester?: {
    full_name: string;
    email: string;
  } | null;
}

interface SendEmailModalProps {
  ticket: Ticket;
  isOpen: boolean;
  onClose: () => void;
  onEmailSent?: () => void;
}

export function SendEmailModal({ ticket, isOpen, onClose, onEmailSent }: SendEmailModalProps) {
  const { profile } = useAuth();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && ticket) {
      const email = ticket.requester?.email || ticket.submitter_email || '';
      const name = ticket.requester?.full_name || ticket.submitter_name || 'Valued Customer';

      setRecipientEmail(email);
      setRecipientName(name);

      const ticketId = ticket.id.substring(0, 8);
      setSubject(`Update on Your Support Ticket - #${ticketId}`);

      const defaultMessage = `Hello ${name},

We wanted to update you on your support ticket.

Ticket Details:
- Ticket ID: #${ticketId}
- Subject: ${ticket.subject}
- Current Status: ${ticket.status}

${ticket.status === 'resolved' || ticket.status === 'closed'
  ? 'Your ticket has been ' + ticket.status + '. If you have any additional questions, please feel free to reach out.'
  : 'We are actively working on resolving your issue and will keep you updated on our progress.'}

Thank you for your patience.

Best regards,
MPB Health Support Team`;

      setMessage(defaultMessage);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, ticket]);

  const handleSendEmail = async () => {
    if (!recipientEmail || !subject || !message) {
      setError('Please fill in all required fields');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration missing');
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('You must be logged in to send emails');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-ticket-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({
            ticketId: ticket.id,
            recipientEmail: recipientEmail,
            recipientName: recipientName,
            subject: subject,
            bodyText: message,
            notificationType: 'manual',
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to send email');
      }

      setSuccess(true);

      if (onEmailSent) {
        onEmailSent();
      }

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error sending email:', err);
      setError(err.message || 'Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Mail className="text-primary-800 dark:text-primary-300" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                Send Email to Requester
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Ticket #{ticket.id.substring(0, 8)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={sending}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {success && (
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle className="text-green-600 dark:text-green-400 flex-shrink-0" size={20} />
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">Email sent successfully!</p>
                <p className="text-sm text-green-700 dark:text-green-300">The email has been delivered to {recipientEmail}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
              <div>
                <p className="font-medium text-red-900 dark:text-red-100">Failed to send email</p>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Recipient Email
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="requester@example.com"
              disabled={sending || success}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Recipient Name
            </label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="John Doe"
              disabled={sending || success}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Email subject"
              disabled={sending || success}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none font-mono text-sm"
              placeholder="Type your message here..."
              disabled={sending || success}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-5 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSendEmail}
            disabled={sending || success || !recipientEmail || !subject || !message}
            className="flex items-center gap-2 px-5 py-2 bg-primary-800 hover:bg-primary-900 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <Loader size={18} className="animate-spin" />
                Sending...
              </>
            ) : success ? (
              <>
                <CheckCircle size={18} />
                Sent
              </>
            ) : (
              <>
                <Send size={18} />
                Send Email
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
