import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, User, AlertCircle, CheckCircle2, Building } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import { SupportContact } from '../../components/ui/SupportContact';
import { FileUpload } from '../../components/tickets/FileUpload';
import { supabase } from '../../lib/supabase';

const CATEGORIES = [
  'Accounting and Billing',
  'Commissions',
  'e123',
  'Technical',
  'Software',
  'App Support',
  'Login Issue',
  'Password',
  'Security Breach',
  'CRM',
  'Enrollment Issue',
  'Pricing Issue',
  'Promo Code Issue',
];

export default function ConciergePortal() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    memberName: '',
    memberEmail: '',
    memberPhone: '',
    memberId: '',
    category: '',
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
      const urlsArray = formData.urls
        .split('\n')
        .map((url) => url.trim())
        .filter((url) => url.length > 0);

      const ticketData = {
        origin: 'concierge',
        submitter_name: formData.memberName,
        submitter_email: formData.memberEmail,
        submitter_phone: formData.memberPhone || null,
        member_id: formData.memberId,
        category: formData.category,
        subject: formData.subject,
        description: formData.description,
        urls: urlsArray.length > 0 ? urlsArray : null,
        status: 'new',
        priority: 'medium',
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

  const handleReset = () => {
    setFormData({
      memberName: '',
      memberEmail: '',
      memberPhone: '',
      memberId: '',
      category: '',
      subject: '',
      description: '',
      urls: '',
    });
    setFiles([]);
    setSuccess(false);
    setTicketNumber(null);
    setError(null);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-green-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="text-success-600 dark:text-green-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">
            Ticket Created Successfully!
          </h2>
          <p className="text-neutral-600 dark:text-neutral-300 mb-2">
            Ticket number:
          </p>
          <p className="text-3xl font-bold text-teal-600 dark:text-teal-400 mb-6">
            #{ticketNumber}
          </p>
          <p className="text-neutral-600 dark:text-neutral-300 mb-8">
            Created for member: <strong>{formData.memberName}</strong>
            <br />
            Confirmation sent to: <strong>{formData.memberEmail}</strong>
          </p>
          <div className="space-y-3">
            <button
              onClick={handleReset}
              className="w-full py-3 px-6 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors"
            >
              Submit Another Ticket
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 px-6 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-medium rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-green-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="mb-4">
            <Logo size="large" />
          </div>
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-3">
            Concierge Support Portal
          </h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-300 mb-4">
            Submit a support ticket on behalf of a member
          </p>
          <div className="max-w-xl mx-auto">
            <SupportContact variant="inline" />
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-teal-900 dark:text-teal-100 mb-1 flex items-center">
                <Building className="inline mr-2" size={16} />
                Member Information
              </h3>
              <p className="text-xs text-teal-700 dark:text-teal-300">
                Enter the details of the member you're assisting
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  <User className="inline mr-2" size={16} />
                  Member Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.memberName}
                  onChange={(e) => setFormData({ ...formData, memberName: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Member's full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Member ID *
                </label>
                <input
                  type="text"
                  required
                  value={formData.memberId}
                  onChange={(e) => setFormData({ ...formData, memberId: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Required"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  <Mail className="inline mr-2" size={16} />
                  Member Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.memberEmail}
                  onChange={(e) => setFormData({ ...formData, memberEmail: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="member@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  <Phone className="inline mr-2" size={16} />
                  Member Phone
                </label>
                <input
                  type="tel"
                  value={formData.memberPhone}
                  onChange={(e) => setFormData({ ...formData, memberPhone: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                Issue Details
              </h3>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Issue Category *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">Select a category</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Subject *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Brief description of the issue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Description *
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                    placeholder="Detailed information about the member's issue..."
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
                    className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                    placeholder="Enter relevant URLs (one per line)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Attachments
                  </label>
                  <FileUpload onFilesChange={setFiles} />
                </div>
              </div>
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
                className="flex-1 py-3 px-6 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                {loading ? 'Creating Ticket...' : 'Create Ticket'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
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
