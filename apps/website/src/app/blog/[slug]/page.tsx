import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, Badge } from '@crm-eco/ui';
import { ArrowLeft, Calendar, Clock, User } from 'lucide-react';

const PLACEHOLDER_POSTS: Record<
  string,
  {
    title: string;
    category: string;
    date: string;
    readTime: string;
    excerpt: string;
    author: { name: string; role: string };
    related: { slug: string; title: string }[];
  }
> = {
  'understanding-health-sharing': {
    title: "Understanding Health Sharing: A Beginner's Guide",
    category: 'Health Tips',
    date: '2025-02-10',
    readTime: '5 min read',
    excerpt:
      'Health sharing ministries offer an alternative to traditional insurance.',
    author: { name: 'Sarah Chen', role: 'Community Outreach Director' },
    related: [
      { slug: 'preventive-care-matters', title: 'Why Preventive Care Matters for Your Family' },
      { slug: '2025-plan-enhancements', title: "2025 Plan Enhancements: What's New for Members" },
    ],
  },
  'family-surgery-story': {
    title: 'How Our Community Supported Our Family Through Surgery',
    category: 'Community Stories',
    date: '2025-02-08',
    readTime: '4 min read',
    excerpt: 'When our son needed emergency surgery, the community came through.',
    author: { name: 'David Martinez', role: 'Member since 2023' },
    related: [
      { slug: 'member-spotlight-john', title: "Member Spotlight: John's Journey to Better Health" },
      { slug: 'understanding-health-sharing', title: "Understanding Health Sharing: A Beginner's Guide" },
    ],
  },
  '2025-plan-enhancements': {
    title: "2025 Plan Enhancements: What's New for Members",
    category: 'Plan Updates',
    date: '2025-02-05',
    readTime: '6 min read',
    excerpt: 'Several improvements to our sharing plans are now available.',
    author: { name: 'Jennifer Walsh', role: 'Member Services' },
    related: [
      { slug: 'understanding-health-sharing', title: "Understanding Health Sharing: A Beginner's Guide" },
      { slug: 'wellness-habits-that-stick', title: '5 Wellness Habits That Actually Stick' },
    ],
  },
  'wellness-habits-that-stick': {
    title: '5 Wellness Habits That Actually Stick',
    category: 'Wellness',
    date: '2025-02-01',
    readTime: '7 min read',
    excerpt: 'Building sustainable health habits with simple, evidence-based practices.',
    author: { name: 'Dr. Amanda Foster', role: 'Wellness Advisor' },
    related: [
      { slug: 'preventive-care-matters', title: 'Why Preventive Care Matters for Your Family' },
      { slug: 'understanding-health-sharing', title: "Understanding Health Sharing: A Beginner's Guide" },
    ],
  },
  'preventive-care-matters': {
    title: 'Why Preventive Care Matters for Your Family',
    category: 'Health Tips',
    date: '2025-01-28',
    readTime: '5 min read',
    excerpt: 'Regular check-ups and screenings can catch health issues early.',
    author: { name: 'Dr. Michael Torres', role: 'Medical Advisor' },
    related: [
      { slug: 'wellness-habits-that-stick', title: '5 Wellness Habits That Actually Stick' },
      { slug: 'family-surgery-story', title: 'How Our Community Supported Our Family Through Surgery' },
    ],
  },
  'member-spotlight-john': {
    title: "Member Spotlight: John's Journey to Better Health",
    category: 'Community Stories',
    date: '2025-01-25',
    readTime: '4 min read',
    excerpt: 'How one member reduced costs while improving wellness.',
    author: { name: 'John R.', role: 'Member since 2022' },
    related: [
      { slug: 'family-surgery-story', title: 'How Our Community Supported Our Family Through Surgery' },
      { slug: 'wellness-habits-that-stick', title: '5 Wellness Habits That Actually Stick' },
    ],
  },
};

function SampleArticleContent() {
  return (
    <div className="space-y-6 text-slate-600 leading-relaxed">
      <p>
        Maintaining good health is a journey that requires commitment, community
        support, and the right resources. At Pay It Forward Health, we believe
        that when members come together to share medical expenses, everyone
        benefits from a more transparent and affordable approach to healthcare.
      </p>
      <p>
        Traditional insurance often creates barriers between patients and care.
        Health sharing ministries like ours remove those barriers by connecting
        members directly. When you have a medical need, your fellow members
        contribute to help cover eligible expenses. This model has helped
        thousands of families access quality care without the burden of high
        premiums.
      </p>
      <h3 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        Key Benefits of Health Sharing
      </h3>
      <p>
        Members report significant savings compared to traditional insurance
        plans. The average family saves over 60% on monthly healthcare costs
        while still receiving support for hospital stays, surgeries, preventive
        care, and more. Our community-driven approach also means faster
        processing times and personalized support when you need it most.
      </p>
      <h3 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        Getting Started
      </h3>
      <p>
        Enrollment is simple and straightforward. Choose a plan that fits your
        household size and needs, complete the application, and your membership
        begins on the first of the next month. From there, you&apos;ll contribute
        your monthly share and can submit needs when they arise. Our team is here
        to guide you every step of the way.
      </p>
      <p>
        We invite you to explore our plans and join a community that truly cares
        about your health and wellbeing. Together, we&apos;re paying it forward
        for each other.
      </p>
    </div>
  );
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = PLACEHOLDER_POSTS[slug];
  if (!post) {
    return {
      title: 'Article Not Found',
    };
  }
  return {
    title: post.title,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = PLACEHOLDER_POSTS[slug];

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Article not found</h1>
        <p className="text-slate-600 mt-2">
          The article you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <article className="container mx-auto px-4 py-12 md:py-16 max-w-3xl">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 mb-8 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        <header className="mb-10">
          <Badge
            variant="secondary"
            className="bg-teal-50 text-teal-700 border-teal-200 mb-4"
          >
            {post.category}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {post.readTime}
            </span>
          </div>
        </header>

        {/* Article content - placeholder prose */}
        <SampleArticleContent />

        {/* Author card */}
        <Card className="mt-12 border-slate-200">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
              <User className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">{post.author.name}</p>
              <p className="text-sm text-slate-500">{post.author.role}</p>
            </div>
          </CardContent>
        </Card>

        {/* Related posts */}
        <section className="mt-16">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">
            Related Posts
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {post.related.map((related) => (
              <Link key={related.slug} href={`/blog/${related.slug}`}>
                <Card className="h-full border-slate-200 hover:border-teal-200 hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <p className="font-medium text-slate-900 group-hover:text-teal-700 line-clamp-2">
                      {related.title}
                    </p>
                    <span className="text-sm text-teal-600 mt-2 inline-block">
                      Read article →
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}
