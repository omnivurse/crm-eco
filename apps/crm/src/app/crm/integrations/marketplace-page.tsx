'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
    Search,
    Plug,
    Mail,
    Phone,
    Video,
    Calendar,
    MessageSquare,
    ShoppingBag,
    CreditCard,
    PenTool,
    RefreshCw,
    Target,
    Share2,
    Calculator,
    Headphones,
    Kanban,
    BarChart3,
    UserPlus,
    ClipboardList,
    Cloud,
    Zap,
    ChevronRight,
    Star,
    Sparkles,
    ExternalLink,
    Check,
    ArrowRight,
    Filter,
} from 'lucide-react';
import {
    MARKETPLACE_CATEGORIES,
    MARKETPLACE_PROVIDERS,
    getPopularProviders,
    getNewProviders,
    searchProviders,
    type MarketplaceCategory,
    type MarketplaceProviderConfig,
} from '@/lib/integrations/marketplace-providers';

// Icon mapping
const ICON_MAP: Record<string, React.ReactNode> = {
    Mail: <Mail className="w-5 h-5" />,
    Phone: <Phone className="w-5 h-5" />,
    Video: <Video className="w-5 h-5" />,
    Calendar: <Calendar className="w-5 h-5" />,
    MessageSquare: <MessageSquare className="w-5 h-5" />,
    ShoppingBag: <ShoppingBag className="w-5 h-5" />,
    CreditCard: <CreditCard className="w-5 h-5" />,
    PenTool: <PenTool className="w-5 h-5" />,
    RefreshCw: <RefreshCw className="w-5 h-5" />,
    Target: <Target className="w-5 h-5" />,
    Share2: <Share2 className="w-5 h-5" />,
    Calculator: <Calculator className="w-5 h-5" />,
    Headphones: <Headphones className="w-5 h-5" />,
    Kanban: <Kanban className="w-5 h-5" />,
    BarChart3: <BarChart3 className="w-5 h-5" />,
    UserPlus: <UserPlus className="w-5 h-5" />,
    ClipboardList: <ClipboardList className="w-5 h-5" />,
    Cloud: <Cloud className="w-5 h-5" />,
    Zap: <Zap className="w-5 h-5" />,
};

// Color classes mapping
const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20' },
    green: { bg: 'bg-green-500/10', text: 'text-green-600 dark:text-green-400', border: 'border-green-500/20' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/20' },
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/20' },
    indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/20' },
    red: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/20' },
    pink: { bg: 'bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-500/20' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/20' },
    teal: { bg: 'bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/20' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/20' },
    yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-500/20' },
    slate: { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/20' },
    sky: { bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/20' },
    lime: { bg: 'bg-lime-500/10', text: 'text-lime-600 dark:text-lime-400', border: 'border-lime-500/20' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/20' },
    fuchsia: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-600 dark:text-fuchsia-400', border: 'border-fuchsia-500/20' },
};

function ProviderCard({ provider }: { provider: MarketplaceProviderConfig }) {
    const colors = COLOR_CLASSES[provider.color] || COLOR_CLASSES.blue;

    return (
        <div className="group relative glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-teal-500/50 hover:shadow-lg hover:shadow-teal-500/5 transition-all duration-300">
            {/* Badges */}
            <div className="absolute top-3 right-3 flex gap-1.5">
                {provider.popular && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full">
                        <Star className="w-3 h-3" /> Popular
                    </span>
                )}
                {provider.new && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-full">
                        <Sparkles className="w-3 h-3" /> New
                    </span>
                )}
            </div>

            {/* Icon & Name */}
            <div className="flex items-start gap-3 mb-3">
                <div className={`p-2.5 rounded-xl ${colors.bg} ${colors.text}`}>
                    <Plug className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{provider.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{provider.description}</p>
                </div>
            </div>

            {/* Features */}
            <div className="flex flex-wrap gap-1.5 mb-4">
                {provider.features.slice(0, 3).map((feature) => (
                    <span
                        key={feature}
                        className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded"
                    >
                        {feature.replace(/_/g, ' ')}
                    </span>
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${colors.bg} ${colors.text}`}>
                    {provider.authType === 'oauth' ? 'OAuth' : 'API Key'}
                </span>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                    Connect <ArrowRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

function CategoryCard({ category, count }: { category: typeof MARKETPLACE_CATEGORIES[0]; count: number }) {
    const colors = COLOR_CLASSES[category.color] || COLOR_CLASSES.blue;
    const icon = ICON_MAP[category.icon] || <Plug className="w-5 h-5" />;

    return (
        <button
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:scale-[1.02] ${colors.bg} ${colors.border} border`}
        >
            <div className={colors.text}>{icon}</div>
            <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 dark:text-white text-sm">{category.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{count} apps</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
    );
}

function FeaturedSection({ title, icon, providers }: { title: string; icon: React.ReactNode; providers: MarketplaceProviderConfig[] }) {
    if (providers.length === 0) return null;

    return (
        <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
                {icon}
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {providers.slice(0, 8).map((provider) => (
                    <ProviderCard key={provider.id} provider={provider} />
                ))}
            </div>
        </div>
    );
}

export default function IntegrationMarketplacePage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<MarketplaceCategory | 'all'>('all');

    const popularProviders = useMemo(() => getPopularProviders(), []);
    const newProviders = useMemo(() => getNewProviders(), []);

    const filteredProviders = useMemo(() => {
        let result = MARKETPLACE_PROVIDERS;

        if (searchQuery) {
            result = searchProviders(searchQuery);
        } else if (selectedCategory !== 'all') {
            result = result.filter(p => p.category === selectedCategory);
        }

        return result;
    }, [searchQuery, selectedCategory]);

    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        MARKETPLACE_PROVIDERS.forEach(p => {
            counts[p.category] = (counts[p.category] || 0) + 1;
        });
        return counts;
    }, []);

    return (
        <div className="min-h-screen">
            {/* Hero Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-teal-500/10 via-cyan-500/5 to-transparent rounded-2xl p-8 mb-8">
                <div className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-slate-800 [mask-image:linear-gradient(0deg,transparent,black)] pointer-events-none" />

                <div className="relative">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl shadow-lg shadow-teal-500/20">
                            <Plug className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                                Integration Marketplace
                            </h1>
                            <p className="text-slate-600 dark:text-slate-400 mt-1">
                                Connect {MARKETPLACE_PROVIDERS.length}+ apps to supercharge your CRM
                            </p>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative max-w-2xl">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search integrations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 shadow-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                        />
                    </div>
                </div>
            </div>

            <div className="flex gap-8">
                {/* Sidebar - Categories */}
                <div className="hidden lg:block w-72 shrink-0">
                    <div className="sticky top-4 space-y-2">
                        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 px-1">
                            Categories
                        </h3>

                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${selectedCategory === 'all'
                                    ? 'bg-teal-500/10 border-teal-500/30 border text-teal-700 dark:text-teal-400'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                        >
                            <Filter className="w-5 h-5" />
                            <div className="flex-1">
                                <div className="font-medium text-sm">All Integrations</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">{MARKETPLACE_PROVIDERS.length} apps</div>
                            </div>
                        </button>

                        <div className="border-t border-slate-200 dark:border-slate-700 my-3" />

                        {MARKETPLACE_CATEGORIES.map((category) => (
                            <button
                                key={category.id}
                                onClick={() => setSelectedCategory(category.id)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all ${selectedCategory === category.id
                                        ? 'bg-teal-500/10 border-teal-500/30 border'
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <div className={selectedCategory === category.id ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500'}>
                                    {ICON_MAP[category.icon] || <Plug className="w-5 h-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={`font-medium text-sm ${selectedCategory === category.id ? 'text-teal-700 dark:text-teal-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {category.name}
                                    </div>
                                </div>
                                <span className="text-xs text-slate-400 dark:text-slate-500">
                                    {categoryCounts[category.id] || 0}
                                </span>
                            </button>
                        ))}

                        <div className="border-t border-slate-200 dark:border-slate-700 my-3" />

                        <Link
                            href="/crm/integrations/logs"
                            className="flex items-center gap-3 px-4 py-2.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                        >
                            <BarChart3 className="w-5 h-5" />
                            <span className="text-sm font-medium">Integration Logs</span>
                        </Link>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                    {searchQuery ? (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    Search Results
                                    <span className="ml-2 text-sm font-normal text-slate-500">
                                        {filteredProviders.length} results for "{searchQuery}"
                                    </span>
                                </h2>
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
                                >
                                    Clear search
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filteredProviders.map((provider) => (
                                    <ProviderCard key={provider.id} provider={provider} />
                                ))}
                            </div>
                            {filteredProviders.length === 0 && (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                                        <Search className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                        No integrations found
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400">
                                        Try a different search term or browse by category
                                    </p>
                                </div>
                            )}
                        </>
                    ) : selectedCategory !== 'all' ? (
                        <>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                                {MARKETPLACE_CATEGORIES.find(c => c.id === selectedCategory)?.name} Integrations
                                <span className="ml-2 text-sm font-normal text-slate-500">
                                    {filteredProviders.length} apps
                                </span>
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filteredProviders.map((provider) => (
                                    <ProviderCard key={provider.id} provider={provider} />
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Popular Integrations */}
                            <FeaturedSection
                                title="Popular Integrations"
                                icon={<Star className="w-5 h-5 text-amber-500" />}
                                providers={popularProviders}
                            />

                            {/* New Integrations */}
                            <FeaturedSection
                                title="Recently Added"
                                icon={<Sparkles className="w-5 h-5 text-emerald-500" />}
                                providers={newProviders}
                            />

                            {/* All by Category */}
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                                    Browse by Category
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {MARKETPLACE_CATEGORIES.map((category) => (
                                        <CategoryCard
                                            key={category.id}
                                            category={category}
                                            count={categoryCounts[category.id] || 0}
                                        />
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
