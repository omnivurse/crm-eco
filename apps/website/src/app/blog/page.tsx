import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Calendar, Clock } from 'lucide-react';
import { Reveal } from '@/components/sections/Reveal';
import {
  Container,
  Eyebrow,
  SectionHeading,
  CTABand,
} from '@/components/sections/blocks';
import { IMAGES, imageUrl, type SiteImage } from '@/lib/site-images';
import { BRAND } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Blog & Member Stories',
  description:
    'Health and wellness guidance, plain-spoken explainers, and real community stories from the Pay It Forward Health family. Learn how health care sharing works.',
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
    title: "Understanding Health Sharing: A Beginner's Guide",
    excerpt:
      'Health care sharing is a community alternative to insurance — not insurance itself. Learn how members voluntarily share one another’s eligible medical costs.',
    category: 'Health Tips',
    date: '2025-02-10',
    readTime: '5 min read',
  },
  {
    slug: 'family-surgery-story',
    title: 'How Our Community Supported Our Family Through Surgery',
    excerpt:
      'When our son needed emergency surgery, the Pay It Forward Health community came through. Here is our story of gratitude and the power of shared support.',
    category: 'Community Stories',
    date: '2025-02-08',
    readTime: '4 min read',
  },
  {
    slug: '2025-plan-enhancements',
    title: "2025 Membership Enhancements: What's New for Members",
    excerpt:
      'We are excited to share several improvements to our programs, including expanded preventive care and a simpler way to submit a sharing request.',
    category: 'Plan Updates',
    date: '2025-02-05',
    readTime: '6 min read',
  },
  {
    slug: 'wellness-habits-that-stick',
    title: '5 Wellness Habits That Actually Stick',
    excerpt:
      'Building lasting health habits does not require drastic changes. Discover simple, evidence-based practices that support your wellbeing for the long haul.',
    category: 'Wellness',
    date: '2025-02-01',
    readTime: '7 min read',
  },
  {
    slug: 'preventive-care-matters',
    title: 'Why Preventive Care Matters for Your Family',
    excerpt:
      'Regular check-ups and screenings can catch issues early. Learn how preventive care fits into your membership and why it is worth making time for.',
    category: 'Health Tips',
    date: '2025-01-28',
    readTime: '5 min read',
  },
  {
    slug: 'member-spotlight-john',
    title: "Member Spotlight: John's Journey to Better Health",
    excerpt:
      'After joining a sharing community, John found people who genuinely cared. Read how he lowered his health care costs while improving his overall wellness.',
    category: 'Community Stories',
    date: '2025-01-25',
    readTime: '4 min read',
  },
];

/** Map each editorial category to a reviewed brand image for thumbnails. */
const CATEGORY_IMAGE: Record<string, SiteImage> = {
  'Health Tips': IMAGES.consultation,
  'Community Stories': IMAGES.familyTogether,
  'Plan Updates': IMAGES.teamMeeting,
  Wellness: IMAGES.wellness,
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function BlogPage() {
  const [featured, ...rest] = PLACEHOLDER_POSTS;
  const featuredImage = CATEGORY_IMAGE[featured.category] ?? IMAGES.community;

  return (
    <>
      {/* Hero */}
      <section className="hub-inner-page-hero py-20 md:py-28">
        <Container>
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <Eyebrow className="mb-4">Resources &amp; Stories</Eyebrow>
              <h1 className="font-heading text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-[1.08] text-pif-navy-800 text-balance">
                Learn, explore, and read{' '}
                <span className="gradient-text">real member stories</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                Plain-spoken guidance on health care sharing, practical wellness
                tips, and honest stories from the {BRAND.name} community —
                because the best way to understand sharing is to hear from the
                people who live it.
              </p>
            </div>
          </Reveal>

          {/* Category chips (presentational) */}
          <Reveal delay={0.1}>
            <div className="mt-10 flex flex-wrap justify-center gap-2.5">
              {CATEGORIES.map((cat) => (
                <span
                  key={cat}
                  className={
                    cat === 'All'
                      ? 'pif-grad-care rounded-full px-4 py-1.5 text-sm font-semibold text-white shadow-sm shadow-pif-teal/25'
                      : 'rounded-full border border-pif-navy-100 bg-white px-4 py-1.5 text-sm font-medium text-slate-600'
                  }
                >
                  {cat}
                </span>
              ))}
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Featured post */}
      <section className="bg-white pb-4 pt-4 md:pt-8">
        <Container>
          <Reveal>
            <Link
              href={`/blog/${featured.slug}`}
              className="group grid overflow-hidden rounded-3xl border border-pif-navy-100 bg-white shadow-sm ring-1 ring-pif-navy/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-pif-navy/10 md:grid-cols-2"
            >
              <div className="relative aspect-[16/10] overflow-hidden md:aspect-auto">
                <Image
                  src={imageUrl(featuredImage, 1100)}
                  alt={featuredImage.alt}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-pif-navy-900/25 via-transparent to-transparent" />
              </div>
              <div className="flex flex-col justify-center p-8 md:p-10">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-pif-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-pif-teal-700 ring-1 ring-pif-teal-100">
                    {featured.category}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-pif-gold-600">
                    Featured
                  </span>
                </div>
                <h2 className="mt-5 font-heading text-2xl font-semibold leading-snug text-pif-navy-800 transition-colors group-hover:text-pif-teal-700 md:text-3xl">
                  {featured.title}
                </h2>
                <p className="mt-4 leading-relaxed text-slate-600">
                  {featured.excerpt}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" aria-hidden="true" />
                    {formatDate(featured.date)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    {featured.readTime}
                  </span>
                </div>
                <span className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-pif-teal-700">
                  Read the story
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          </Reveal>
        </Container>
      </section>

      {/* Article grid */}
      <section className="bg-white py-16 md:py-20">
        <Container>
          <Reveal>
            <SectionHeading
              align="left"
              eyebrow="Latest articles"
              title="More from the community"
              subtitle="Browse our most recent guides, updates, and member stories."
            />
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {rest.map((post, i) => {
              const image = CATEGORY_IMAGE[post.category] ?? IMAGES.community;
              return (
                <Reveal key={post.slug} delay={(i % 3) * 0.07}>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-pif-navy-100 bg-white shadow-sm ring-1 ring-pif-navy/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-pif-navy/10"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={imageUrl(image, 800)}
                        alt={image.alt}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-pif-navy-900/25 via-transparent to-transparent" />
                      <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-pif-teal-700 shadow-sm">
                        {post.category}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="font-heading text-lg font-semibold leading-snug text-pif-navy-800 transition-colors group-hover:text-pif-teal-700">
                        {post.title}
                      </h3>
                      <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
                        {post.excerpt}
                      </p>
                      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-pif-navy-100 pt-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                          {formatDate(post.date)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {post.readTime}
                        </span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Final CTA */}
      <CTABand
        title="Have questions about how sharing works?"
        subtitle="Our team is happy to walk you through it — no pressure, no sales pitch. Join any time; there is no enrollment window to wait for."
        primary={{ label: 'Become a Member', href: '/enroll' }}
        secondary={{ label: 'See How It Works', href: '/how-it-works' }}
      />
    </>
  );
}
