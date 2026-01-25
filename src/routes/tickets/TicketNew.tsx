import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle, Ticket } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { FileUpload } from '../../components/tickets/FileUpload';
import { uploadTicketAttachments, saveAttachmentReferences } from '../../lib/fileUpload';

const STAFF_ROLES = ['staff', 'agent', 'admin', 'super_admin'] as const;

export function TicketNew() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'medium',
    category: '',
  });

  const determineOrigin = () => {
    if (!profile?.role) return 'member';
    if (profile.role === 'advisor') return 'advisor';
    if (STAFF_ROLES.includes(profile.role as any)) return 'staff';
    return 'member';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const origin = determineOrigin();

      const { data, error: submitError } = await supabase
        .from('tickets')
        .insert({
          subject: formData.subject,
          description: formData.description,
          priority: formData.priority,
          category: formData.category || null,
          origin,
          status: 'new',
          requester_id: profile?.id,
        })
        .select()
        .single();

      if (submitError) throw submitError;

      if (files.length > 0 && profile?.id) {
        try {
          const uploadedFiles = await uploadTicketAttachments(data.id, files);
          await saveAttachmentReferences(data.id, uploadedFiles, profile.id);
        } catch (uploadError: any) {
          console.error('Failed to upload attachments:', uploadError);
          setError(`Ticket created but file upload failed: ${uploadError.message}`);
        }
      }

      navigate(`/tickets/${data.id}`);
    } catch (err: any) {
      console.error('Error creating ticket:', err);
      setError(err.message || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/tickets')}
        className="group inline-flex items-center gap-2 px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all duration-200"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform duration-200" />
        <span className="font-medium">Back to Tickets</span>
      </button>

      <div className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-neutral-200/50 dark:border-neutral-700/50 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-neutral-900 to-neutral-700 dark:from-white dark:to-neutral-300 bg-clip-text text-transparent mb-2">
            Create New Ticket
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Fill out the form below to create a new support ticket
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
            <AlertCircle className="text-accent-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">Error</h3>
              <p className="text-sm text-accent-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Subject <span className="text-accent-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-4 py-3 border-2 border-neutral-200 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-primary-600 focus:ring-4 focus:ring-primary-500/10 transition-all"
              placeholder="Brief description of the issue"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Description <span className="text-accent-500">*</span>
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={6}
              className="w-full px-4 py-3 border-2 border-neutral-200 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-primary-600 focus:ring-4 focus:ring-primary-500/10 transition-all resize-none"
              placeholder="Provide detailed information about the issue..."
            />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                Priority <span className="text-accent-500">*</span>
              </label>
              <select
                required
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-3 border-2 border-neutral-200 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:border-primary-600 focus:ring-4 focus:ring-primary-500/10 transition-all cursor-pointer"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 border-2 border-neutral-200 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:border-primary-600 focus:ring-4 focus:ring-primary-500/10 transition-all cursor-pointer"
              >
                <option value="">Select category...</option>
                <option value="Access">Access & Authentication</option>
                <option value="Email">Email</option>
                <option value="Software">Software & Applications</option>
                <option value="Hardware">Hardware</option>
                <option value="Network">Network & Connectivity</option>
                <option value="Phone">Phone System</option>
                <option value="Account">Account & Billing</option>
                <option value="Data">Data & Reports</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                Submitting As
              </label>
              <div className="w-full px-4 py-3 border-2 border-neutral-200 dark:border-neutral-600 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                {profile?.role === 'advisor' ? 'Advisor' :
                 STAFF_ROLES.includes(profile?.role as any) ? 'Staff' :
                 'Member'}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Attachments (Optional)
            </label>
            <FileUpload
              onFilesChange={setFiles}
              maxFiles={5}
              maxSizeMB={10}
            />
          </div>

          <div className="flex items-center gap-4 pt-6 border-t-2 border-neutral-200 dark:border-neutral-700">
            <button
              type="submit"
              disabled={loading}
              className="group flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-primary-700 to-primary-800 hover:from-primary-800 hover:to-primary-900 disabled:from-neutral-400 disabled:to-neutral-500 text-white font-semibold rounded-xl shadow-lg shadow-primary-800/30 hover:shadow-xl hover:shadow-primary-900/40 transition-all duration-300 hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Save size={20} className="group-hover:scale-110 transition-transform duration-200" />
                  <span>Create Ticket</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/tickets')}
              className="px-6 py-3.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 font-semibold rounded-xl transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
