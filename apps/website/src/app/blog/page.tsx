import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Card, CardContent, Badge } from '@crm-eco/ui';
import {
  Calendar,
  Clock,
  ArrowRight,
  BookOpen,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog & Resources',
  description:
    'Health and wellness resources, community stories, and plan updates from Double Helix Hub.',
};

const CATEGORIES = [
  'All',
  'Health Tips',
  'Community Stories',
  'Plan Updates',
  'Wellness',
] as const;

const PLACEHOLDER_POSTS = [
  {
    slug: 'understanding-health-sharing',
    title: 'Understanding Health Sharing: A Beginner\'s Guide',
    excerpt:
      'Health sharing ministries offer an alternative to traditional insurance. Learn how members voluntarily share medical expenses and support each other through community.',
    category: 'Health Tips',
    date: '2025-02-10',
    readTime: '5 min read',
  },
  {
    slug: 'family-surgery-story',
    title: 'How Our Community Supported Our Family Through Surgery',
    excerpt:
      'When our son needed emergency surgery, the Double Helix Hub community came through. Here\'s our story of gratitude and the power of shared support.',
    category: 'Community Stories',
    date: '2025-02-08',
    readTime: '4 min read',
  },
  {
    slug: '2025-plan-enhancements',
    title: '2025 Plan Enhancements: What\'s New for Members',
    excerpt:
      'We\'re excited to announce several improvements to our sharing plans, including expanded preventive care benefits and streamlined need submission.',
    category: 'Plan Updates',
    date: '2025-02-05',
    readTime: '6 min read',
  },
  {
    slug: 'wellness-habits-that-stick',
    title: '5 Wellness Habits That Actually Stick',
    excerpt:
      'Building sustainable health habits doesn\'t require drastic changes. Discover simple, evidence-based practices that support long-term wellness.',
    category: 'Wellness',
    date: '2025-02-01',
    readTime: '7 min read',
  },
  {
    slug: 'preventive-care-matters',
    title: 'Why Preventive Care Matters for Your Family',
    excerpt:
      'Regular check-ups and screenings can catch health issues early. Learn how preventive care fits into health sharing and why it\'s worth the investment.',
    category: 'Health Tips',
    date: '2025-01-28',
    readTime: '5 min read',
  },
  {
    slug: 'member-spotlight-john',
    title: 'Member Spotlight: John\'s Journey to Better Health',
    excerpt:
      'After switching to health sharing, John discovered a community that cared. Read how he reduced his healthcare costs while improving his overall wellness.',
    category: 'Community Stories',
    date: '2025-01-25',
    readTime: '4 min read',
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-50 via-emerald-50/50 to-slate-50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(20,184,166,0.15),transparent)]" />
        <div className="container mx-auto px-4 py-16 md:py-24 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-full px-4 py-1.5 mb-6">
              <BookOpen className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-medium text-teal-700">
                Blog & Resources
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">
              Health & Wellness{' '}
              <span className="bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                Resources
              </span>
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed">
              Tips, community stories, plan updates, and wellness guidance to
              support your health journey.
            </p>
          </div>
        </div>
      </section>

      {/* Categories Filter */}
      <section className="border-b bg-white sticky top-16 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat}
                variant={cat === 'All' ? 'default' : 'outline'}
                size="sm"
                className={
                  cat === 'All'
                    ? 'bg-teal-600 hover:bg-teal-700 text-white'
                    : ''
                }
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Blog Grid */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {PLACEHOLDER_POSTS.map((post) => (
            <Card
              key={post.slug}
              className="group overflow-hidden border-slate-200 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-500/5 transition-all duration-300"
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Badge
                    variant="secondary"
                    className="bg-teal-50 text-teal-700 border-teal-200"
                  >
                    {post.category}
                  </Badge>
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2 group-hover:text-teal-700 transition-colors line-clamp-2">
                  {post.title}
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed line-clamp-2 mb-4">
                  {post.excerpt}
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(post.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {post.readTime}
                  </span>
                </div>
                <Link
                  href={`/blog/${post.slug}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700 group/link"
                >
                  Read More
                  <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
