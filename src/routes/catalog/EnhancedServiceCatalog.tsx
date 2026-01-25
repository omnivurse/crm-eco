import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ShoppingBag, Search, ArrowRight, Sparkles, TrendingUp, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface CatalogItem {
  id: string;
  name: string;
  description: string;
  category_id: string;
  icon: string;
  estimated_delivery_days: number;
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export function EnhancedServiceCatalog() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsRes, categoriesRes] = await Promise.all([
        supabase.from('catalog_items').select('*').eq('is_active', true).order('name'),
        supabase.from('catalog_categories').select('*').eq('is_active', true).order('sort_order')
      ]);

      if (itemsRes.data) setItems(itemsRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Error fetching catalog:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || item.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryIcon = (iconName: string) => {
    const icons: Record<string, any> = {
      'shopping-bag': ShoppingBag,
      'sparkles': Sparkles,
      'trending-up': TrendingUp,
      'clock': Clock
    };
    return icons[iconName] || ShoppingBag;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">Loading catalog...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="hero-service text-white py-20 px-6"
      >
        <div className="w-full relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="flex items-center gap-4 mb-4">
              <motion.div
                animate={{
                  y: [0, -10, 0],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20"
              >
                <ShoppingBag size={48} className="text-white" />
              </motion.div>
              <div>
                <h1 className="text-6xl font-black mb-2 tracking-tight">
                  Service Catalog
                </h1>
                <p className="text-2xl text-cyan-100 font-medium">
                  Request services and resources with just a few clicks
                </p>
              </div>
            </div>
          </motion.div>

          {/* Enhanced Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative max-w-3xl"
          >
            <div className="absolute left-5 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <Search className="text-cyan-300" size={24} />
            </div>
            <input
              type="text"
              placeholder="Search for services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-16 pr-6 py-5 rounded-2xl border-2 border-white/30 bg-white/15 backdrop-blur-xl text-white placeholder-cyan-200 text-lg focus:outline-none focus:ring-4 focus:ring-white/40 focus:border-white/50 transition-all shadow-2xl"
            />
            <div className="absolute right-5 top-1/2 transform -translate-y-1/2">
              <kbd className="px-3 py-1.5 text-xs font-semibold text-teal-900 bg-white/90 border border-white/40 rounded-xl shadow-sm">
                ⌘ K
              </kbd>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Categories */}
        {categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">Categories</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`glass-card p-4 text-center transition-all ${
                  !selectedCategory ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <div className="text-2xl mb-2">🌟</div>
                <div className="text-sm font-medium text-neutral-900 dark:text-white">All</div>
              </button>
              {categories.map((category) => {
                const Icon = getCategoryIcon(category.icon);
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`glass-card p-4 text-center transition-all ${
                      selectedCategory === category.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    <Icon className="mx-auto mb-2 text-primary-800 dark:text-primary-500" size={24} />
                    <div className="text-sm font-medium text-neutral-900 dark:text-white">{category.name}</div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Services Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Available Services ({filteredItems.length})
            </h2>
          </div>

          {filteredItems.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <ShoppingBag className="mx-auto mb-4 text-neutral-400" size={64} />
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">No services found</h3>
              <p className="text-neutral-600 dark:text-neutral-400">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link to={`/catalog/${item.id}`}>
                    <div className="glass-card p-6 h-full group cursor-pointer">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-teal-600 flex items-center justify-center text-white text-xl">
                          {item.icon || '📦'}
                        </div>
                        <ArrowRight className="text-neutral-400 group-hover:text-primary-800 group-hover:translate-x-1 transition-all" size={20} />
                      </div>

                      <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2 group-hover:text-primary-800 transition-colors">
                        {item.name}
                      </h3>

                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 line-clamp-2">
                        {item.description || 'No description available'}
                      </p>

                      <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                        <Clock size={14} />
                        <span>{item.estimated_delivery_days || 3} day delivery</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Popular Services */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12"
        >
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="text-primary-800" size={24} />
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Need Help?</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-4 rounded-xl bg-primary-50 dark:bg-primary-950/20">
                <h3 className="font-semibold text-neutral-900 dark:text-white mb-2">Browse by Category</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Find services organized by type</p>
              </div>
              <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20">
                <h3 className="font-semibold text-neutral-900 dark:text-white mb-2">Quick Search</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Use the search bar to find exactly what you need</p>
              </div>
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20">
                <h3 className="font-semibold text-neutral-900 dark:text-white mb-2">Track Requests</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">View status of your service requests</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
