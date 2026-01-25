import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { BookOpen, Search, Plus, Sparkles } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { motion } from 'framer-motion';
import { PublicNavHeader } from '../../components/ui/PublicNavHeader';

interface Article {
  id: string;
  title: string;
  body: string;
  tags: string[];
  is_published: boolean;
  created_at: string;
  created_by: string;
  author: {
    full_name: string;
    email: string;
  } | null;
}

export function KBList() {
  const { profile } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const isStaff = profile?.role && ['staff', 'agent', 'admin', 'super_admin'].includes(profile.role);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('kb_articles')
        .select(`
          id,
          title,
          body,
          tags,
          is_published,
          created_at,
          created_by,
          author:profiles!kb_articles_created_by_fkey(full_name, email)
        `)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const formattedData = (data || []).map(article => ({
        ...article,
        author: Array.isArray(article.author) ? article.author[0] : article.author
      }));
      setArticles(formattedData as any);
    } catch (error) {
      // Error fetching articles
    } finally {
      setLoading(false);
    }
  };

  const filteredArticles = articles.filter(
    (article) =>
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.tags?.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
      <PublicNavHeader
        title="Knowledge Base"
        subtitle="Browse articles and documentation"
        showBackButton={true}
        backPath="/support"
        backLabel="Back to Support Portal"
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        {isStaff && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-end mb-6"
          >
            <Link to="/kb/new" className="neon-button">
              <Plus size={20} className="inline mr-2" />
              New Article
            </Link>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 mb-8"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400" size={22} />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-4 py-4 border-2 border-white/20 dark:border-white/10 rounded-xl bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm text-neutral-900 dark:text-white placeholder-gray-400 text-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full text-center py-16">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="inline-block"
            >
              <Sparkles className="text-primary-800 dark:text-primary-500" size={48} />
            </motion.div>
            <p className="mt-4 text-neutral-500 dark:text-neutral-400 text-lg">Loading articles...</p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <BookOpen className="mx-auto text-neutral-400 mb-4" size={64} />
            <p className="text-neutral-500 dark:text-neutral-400 text-lg">
              {searchTerm ? 'No articles found matching your search' : 'No articles available'}
            </p>
          </div>
        ) : (
          filteredArticles.map((article, index) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                to={`/kb/${article.id}`}
                className="glass-card p-8 hover:shadow-xl hover:scale-105 transition-all block group h-full"
              >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 floating group-hover:scale-110 transition-transform">
                  <BookOpen className="text-white" size={24} />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white line-clamp-2 group-hover:text-primary-800 dark:group-hover:text-primary-500 transition-colors">
                  {article.title}
                </h3>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-5 line-clamp-3 leading-relaxed">
                {article.body.replace(/<[^>]*>/g, '').substring(0, 150)}...
              </p>
              {article.tags && article.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {article.tags.slice(0, 3).map((tag, index) => (
                    <span
                      key={index}
                      className="modern-badge bg-primary-100 dark:bg-primary-950/30 text-primary-900 dark:text-primary-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <p>
                  By {article.author?.full_name || 'Unknown'}
                </p>
                <p>
                  {new Date(article.created_at).toLocaleDateString()}
                </p>
              </div>
              </Link>
            </motion.div>
          ))
        )}
        </div>
      </div>
    </div>
  );
}
