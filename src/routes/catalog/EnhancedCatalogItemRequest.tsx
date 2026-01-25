import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Send, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { motion } from 'framer-motion';

interface CatalogItem {
  id: string;
  name: string;
  description: string;
  form_schema: {
    fields: Array<{
      key: string;
      label: string;
      type: 'text' | 'textarea' | 'email' | 'number' | 'select' | 'checkbox';
      required?: boolean;
      options?: string[];
      placeholder?: string;
    }>;
  };
  estimated_delivery_days: number;
  approval_required: boolean;
}

export function EnhancedCatalogItemRequest() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (id) fetchItem();
  }, [id]);

  const fetchItem = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setItem(data);
    } catch (err: any) {
      console.error('Error fetching item:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('You must be logged in to submit a request');
      }

      const { error } = await supabase.from('requests').insert({
        catalog_item_id: id,
        requester_id: user.id,
        answers: formData,
        status: 'submitted'
      });

      if (error) throw error;

      navigate('/requests', { state: { message: 'Request submitted successfully!' } });
    } catch (err: any) {
      console.error('Error submitting request:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: any) => {
    const commonClasses = "input-modern w-full";

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            id={field.key}
            required={field.required}
            placeholder={field.placeholder}
            value={formData[field.key] || ''}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
            className={`${commonClasses} min-h-[120px] resize-none`}
            rows={4}
          />
        );

      case 'select':
        return (
          <select
            id={field.key}
            required={field.required}
            value={formData[field.key] || ''}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
            className={commonClasses}
          >
            <option value="">Select an option</option>
            {field.options?.map((option: string) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              id={field.key}
              checked={formData[field.key] || false}
              onChange={(e) => setFormData({ ...formData, [field.key]: e.target.checked })}
              className="w-5 h-5 rounded border-2 border-primary-600 text-primary-800 focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-300">{field.label}</span>
          </label>
        );

      default:
        return (
          <input
            type={field.type || 'text'}
            id={field.key}
            required={field.required}
            placeholder={field.placeholder}
            value={formData[field.key] || ''}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
            className={commonClasses}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader className="inline-block w-16 h-16 text-primary-800 animate-spin" />
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">Loading service details...</p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 text-accent-600" size={64} />
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">Service Not Found</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">The requested service could not be found.</p>
          <button
            onClick={() => navigate('/catalog')}
            className="neon-button"
          >
            Back to Catalog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate('/catalog')}
          className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-800 dark:hover:text-primary-500 mb-8 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Catalog</span>
        </motion.button>

        {/* Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 mb-8"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">{item.name}</h1>
              <p className="text-neutral-600 dark:text-neutral-400">{item.description}</p>
            </div>
            <div className="text-5xl">{(item as any).icon || '📦'}</div>
          </div>

          <div className="flex flex-wrap gap-4 mt-6">
            <div className="stat-card flex-1 min-w-[200px]">
              <div className="relative z-10">
                <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Estimated Delivery</div>
                <div className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {item.estimated_delivery_days} days
                </div>
              </div>
            </div>
            {item.approval_required && (
              <div className="stat-card flex-1 min-w-[200px]">
                <div className="relative z-10">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Requires</div>
                  <div className="text-2xl font-bold text-neutral-900 dark:text-white">Approval</div>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-8"
        >
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">Request Form</h2>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3"
            >
              <AlertCircle className="text-accent-600 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">Error</h3>
                <p className="text-sm text-accent-700 dark:text-red-300">{error}</p>
              </div>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {item.form_schema?.fields?.map((field, index) => (
              <motion.div
                key={field.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="space-y-2"
              >
                {field.type !== 'checkbox' && (
                  <label
                    htmlFor={field.key}
                    className="block text-sm font-medium text-neutral-900 dark:text-white"
                  >
                    {field.label}
                    {field.required && <span className="text-accent-500 ml-1">*</span>}
                  </label>
                )}
                {renderField(field)}
              </motion.div>
            ))}

            <div className="flex gap-4 pt-6">
              <button
                type="button"
                onClick={() => navigate('/catalog')}
                className="flex-1 px-6 py-3 rounded-xl border-2 border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 neon-button flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader className="animate-spin" size={20} />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    <span>Submit Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 glass-card p-6"
        >
          <div className="flex items-start gap-3">
            <CheckCircle className="text-primary-800 flex-shrink-0 mt-1" size={20} />
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-2">What happens next?</h3>
              <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-2">
                <li>• Your request will be reviewed by our team</li>
                {item.approval_required && <li>• Approval may be required before processing</li>}
                <li>• You'll receive updates via email and in your requests dashboard</li>
                <li>• Estimated completion: {item.estimated_delivery_days} business days</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
