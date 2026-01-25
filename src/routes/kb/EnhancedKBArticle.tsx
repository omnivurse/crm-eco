import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Clock, User, History, RotateCcw, Edit, CheckCircle, Home, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { PublicNavHeader } from '../../components/ui/PublicNavHeader';
import { useAuth } from '../../providers/AuthProvider';

interface KBArticle {
  id: string;
  title: string;
  content_md: string;
  status: string;
  author_id: string;
  created_at: string;
  updated_at: string;
}

interface KBVersion {
  id: string;
  version: number;
  title: string;
  content_md: string;
  created_at: string;
  created_by: string;
}

export function EnhancedKBArticle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [article, setArticle] = useState<KBArticle | null>(null);
  const [versions, setVersions] = useState<KBVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const isAuthenticated = !!profile;
  const isStaff = profile?.role && ['staff', 'agent', 'admin', 'super_admin'].includes(profile.role);

  useEffect(() => {
    if (id) fetchArticle();
  }, [id]);

  const fetchArticle = async () => {
    try {
      setLoading(true);
      const { data: articleData, error: articleError } = await supabase
        .from('kb_articles')
        .select('*')
        .eq('id', id)
        .single();

      if (articleError) throw articleError;
      setArticle(articleData);

      const { data: versionsData } = await supabase
        .from('knowledge_versions')
        .select('*')
        .eq('article_id', id)
        .order('version', { ascending: false });

      if (versionsData) setVersions(versionsData);
    } catch (error) {
      console.error('Error fetching article:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (version: number) => {
    if (!confirm(`Rollback to version ${version}?`)) return;

    try {
      const targetVersion = versions.find(v => v.version === version);
      if (!targetVersion) return;

      const { error } = await supabase
        .from('kb_articles')
        .update({
          title: targetVersion.title,
          content_md: targetVersion.content_md
        })
        .eq('id', id);

      if (error) throw error;

      alert('Article rolled back successfully!');
      fetchArticle();
    } catch (error: any) {
      console.error('Error rolling back:', error);
      alert('Failed to rollback: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">Loading article...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">Article Not Found</h2>
          <button onClick={() => navigate('/kb')} className="neon-button mt-4">
            Back to Knowledge Base
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
      <PublicNavHeader
        title={article?.title || 'Knowledge Base Article'}
        showBackButton={true}
        backPath="/kb"
        backLabel="Back to Knowledge Base"
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 mb-6">
          <Link to="/support" className="hover:text-primary-800 dark:hover:text-primary-500 transition-colors">
            Support Portal
          </Link>
          <span>/</span>
          <Link to="/kb" className="hover:text-primary-800 dark:hover:text-primary-500 transition-colors">
            Knowledge Base
          </Link>
          <span>/</span>
          <span className="text-neutral-900 dark:text-white font-medium">Article</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-8"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex flex-wrap gap-4 text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                    <div className="flex items-center gap-2">
                      <Clock size={16} />
                      <span>Updated {format(new Date(article.updated_at), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User size={16} />
                      <span>Author ID: {article.author_id.slice(0, 8)}...</span>
                    </div>
                  </div>
                </div>
                {isStaff && (
                  <div className={`modern-badge ${
                    article.status === 'published' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                    article.status === 'draft' ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300' :
                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                  }`}>
                    {article.status}
                  </div>
                )}
              </div>

              <div className="prose prose-lg dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  {article.content_md}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="text-primary-800" size={20} />
                <h3 className="font-semibold text-neutral-900 dark:text-white">Was this helpful?</h3>
              </div>
              <div className="flex gap-3">
                <button className="flex-1 px-4 py-2 rounded-xl border-2 border-success-500 text-success-600 dark:text-green-400 font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                  👍 Yes
                </button>
                <button className="flex-1 px-4 py-2 rounded-xl border-2 border-accent-500 text-accent-600 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  👎 No
                </button>
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Navigation */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-6"
            >
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">Quick Navigation</h3>
              <div className="space-y-3">
                <Link
                  to="/kb"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-50 dark:bg-primary-950/20 text-primary-800 dark:text-primary-500 hover:bg-primary-100 dark:hover:bg-primary-950/30 transition-colors"
                >
                  <BookOpen size={20} />
                  <span className="font-medium">All Articles</span>
                </Link>
                <Link
                  to="/support"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Home size={20} />
                  <span className="font-medium">Support Portal</span>
                </Link>
                {isAuthenticated && (
                  <Link
                    to="/dashboard"
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <Home size={20} />
                    <span className="font-medium">Dashboard</span>
                  </Link>
                )}
              </div>
            </motion.div>

            {/* Actions for Staff */}
            {isStaff && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-6"
              >
                <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-50 dark:bg-primary-950/20 text-primary-800 dark:text-primary-500 hover:bg-primary-100 dark:hover:bg-primary-950/30 transition-colors"
                  >
                    <History size={20} />
                    <span className="font-medium">View History</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                    <Edit size={20} />
                    <span className="font-medium">Edit Article</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Version History */}
            {showHistory && versions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card p-6"
              >
                <h3 className="font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                  <History size={20} />
                  Version History
                </h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="p-4 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 hover:border-primary-600 dark:hover:border-primary-600 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-neutral-900 dark:text-white">
                          Version {version.version}
                        </span>
                        <button
                          onClick={() => handleRollback(version.version)}
                          className="flex items-center gap-1 text-sm text-primary-800 dark:text-primary-500 hover:text-primary-900 dark:hover:text-primary-300"
                        >
                          <RotateCcw size={14} />
                          Rollback
                        </button>
                      </div>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">
                        {format(new Date(version.created_at), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Related Articles */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: isStaff ? 0.2 : 0.1 }}
              className="glass-card p-6"
            >
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">Related Articles</h3>
              <div className="space-y-3">
                <Link to="/kb" className="block p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">Browse all articles</p>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
