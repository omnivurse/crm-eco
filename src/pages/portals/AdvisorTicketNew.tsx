import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { FileUpload } from '../../components/tickets/FileUpload';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

const ADVISOR_CATEGORIES = [
  'Member Issues',
  'Accounting & Billing',
  'Commissions',
  'Technical',
  'Software',
  'Web Support',
  'App Support',
  'Enrollment (e123)',
  'Enrollment Page Support',
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function AdvisorTicketNew() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [formData, setFormData] = useState({
    advisorId: '',
    category: '',
    subcategory: '',
    priority: 'medium',
    subject: '',
    description: '',
    urls: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!user) {
        throw new Error('You must be logged in to submit a ticket');
      }

      const urlsArray = formData.urls
        .split('\n')
        .map((url) => url.trim())
        .filter((url) => url.length > 0);

      const ticketData = {
        origin: 'advisor',
        requester_id: user.id,
        advisor_id: formData.advisorId,
        category: formData.category,
        subcategory: formData.subcategory || null,
        priority: formData.priority,
        subject: formData.subject,
        description: formData.description,
        urls: urlsArray.length > 0 ? urlsArray : null,
        status: 'new',
        submitter_name: profile?.full_name || null,
        submitter_email: user.email || null,
        created_at: new Date().toISOString(),
      };

      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert([ticketData])
        .select()
        .single();

      if (ticketError) throw ticketError;

      if (files.length > 0 && ticket) {
        for (const file of files) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${ticket.id}/${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('ticket-files')
            .upload(fileName, file);

          if (uploadError) {
            console.error('File upload error:', uploadError);
            continue;
          }

          await supabase.from('ticket_files').insert([
            {
              ticket_id: ticket.id,
              filename: file.name,
              storage_path: fileName,
              file_size: file.size,
              mime_type: file.type,
              uploaded_by: user.id,
            },
          ]);
        }
      }

      setSuccess(true);
      setTicketNumber(ticket?.id.split('-')[0].toUpperCase());
    } catch (err: any) {
      console.error('Submission error:', err);
      setError(err.message || 'Failed to submit ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="text-success-600 dark:text-green-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">
            Ticket Submitted Successfully!
          </h2>
          <p className="text-neutral-600 dark:text-neutral-300 mb-2">
            Your ticket number is:
          </p>
          <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-6">
            #{ticketNumber}
          </p>
          <p className="text-neutral-600 dark:text-neutral-300 mb-8">
            Our support team will review your request and get back to you shortly.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/advisor/dashboard')}
              className="w-full py-3 px-6 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 px-6 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-medium rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
            >
              Submit Another Ticket
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-6">
          <button
            onClick={() => navigate('/advisor/dashboard')}
            className="flex items-center space-x-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
          >
            <ArrowLeft size={20} />
            <span>Back to Dashboard</span>
          </button>
        </div>

        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full mb-4">
            <Briefcase className="text-orange-600 dark:text-orange-400" size={32} />
          </div>
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-3">
            Submit Advisor Ticket
          </h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-300">
            Get help with member issues, commissions, or technical support
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Advisor ID *
                </label>
                <input
                  type="text"
                  required
                  value={formData.advisorId}
                  onChange={(e) => setFormData({ ...formData, advisorId: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Your advisor ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Priority *
                </label>
                <select
                  required
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Category *
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">Select a category</option>
                {ADVISOR_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Subcategory
              </label>
              <input
                type="text"
                value={formData.subcategory}
                onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Optional - provide more specific details"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Subject *
              </label>
              <input
                type="text"
                required
                minLength={5}
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Brief description of your issue"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Description *
              </label>
              <textarea
                required
                minLength={10}
                rows={6}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                placeholder="Please provide detailed information about your issue..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Related URLs
              </label>
              <textarea
                rows={3}
                value={formData.urls}
                onChange={(e) => setFormData({ ...formData, urls: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                placeholder="Enter relevant URLs (one per line)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Attachments
              </label>
              <FileUpload onFilesChange={setFiles} />
            </div>

            {error && (
              <div className="flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="text-accent-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
                <p className="text-accent-700 dark:text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 px-6 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                {loading ? 'Submitting...' : 'Submit Ticket'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/advisor/dashboard')}
                className="px-6 py-3 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-medium rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
