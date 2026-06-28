import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Calendar, Clock, User } from 'lucide-react';
import { Reveal } from '@/components/sections/Reveal';
import { Container, CTABand } from '@/components/sections/blocks';
import { IMAGES, imageUrl, type SiteImage } from '@/lib/site-images';
import { BRAND } from '@/lib/site';

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
      'Health care sharing is a community alternative to insurance — not insurance itself.',
    author: { name: 'Sarah Chen', role: 'Community Outreach Director' },
    related: [
      { slug: 'preventive-care-matters', title: 'Why Preventive Care Matters for Your Family' },
      { slug: '2025-plan-enhancements', title: "2025 Membership Enhancements: What's New for Members" },
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
    title: "2025 Membership Enhancements: What's New for Members",
    category: 'Plan Updates',
    date: '2025-02-05',
    readTime: '6 min read',
    excerpt: 'Several improvements to our programs are now available.',
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

/** Map each editorial category to a reviewed brand image (matches the index). */
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

function SampleArticleContent() {
  return (
    <div className="prose-pif max-w-prose space-y-6 text-[1.0625rem] leading-relaxed text-slate-700">
      <p>
        Maintaining good health is a journey that takes commitment, community
        support, and the right resources. At {BRAND.name}, we believe that when
        members come together to share medical costs, everyone benefits from a
        more transparent and affordable approach to care.
      </p>
      <p>
        Traditional insurance often puts barriers between patients and care.
        Health care sharing removes those barriers by connecting members
        directly. When you have an eligible medical need, your fellow members
        help cover the cost. This model has helped thousands of families get
        quality care without the burden of high premiums — and it is important
        to remember it is a community arrangement, not insurance.
      </p>
      <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
        The benefits of sharing
      </h2>
      <p>
        Members consistently report meaningful savings compared with traditional
        coverage. Many families pay far less each month while still receiving
        support for hospital stays, surgeries, preventive care, and more. Our
        community-driven approach also means faster processing and personal
        support when you need it most — no networks to navigate and no referrals
        to chase.
      </p>
      <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
        Getting started
      </h2>
      <p>
        Joining is simple and welcoming to everyone. Choose a program that fits
        your household, complete a short application, and your sharing begins on
        the first of the following month. From there, you contribute your monthly
        share and submit a sharing request whenever a need arises. There is no
        open-enrollment window — you can join any time.
      </p>
      <p>
        We would love for you to explore our programs and join a community that
        truly cares about your health and wellbeing. Together, we are paying it
        forward for one another.
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
      <section className="hub-inner-page-hero py-24 md:py-32">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Link
              href="/blog"
              className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Blog
            </Link>
            <h1 className="font-heading text-3xl font-semibold text-pif-navy-800">
              Article not found
            </h1>
            <p className="mt-3 text-slate-600">
              The article you&apos;re looking for doesn&apos;t exist or has been
              moved.
            </p>
          </div>
        </Container>
      </section>
    );
  }

  const heroImage = CATEGORY_IMAGE[post.category] ?? IMAGES.community;

  return (
    <>
      {/* Hero */}
      <section className="hub-inner-page-hero py-16 md:py-20">
        <Container>
          <div className="mx-auto max-w-3xl">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Blog
            </Link>
            <div className="mt-8">
              <span className="rounded-full bg-pif-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-pif-teal-700 ring-1 ring-pif-teal-100">
                {post.category}
              </span>
            </div>
            <h1 className="mt-5 font-heading text-[clamp(2rem,4.5vw,3rem)] font-semibold leading-[1.1] text-pif-navy-800 text-balance">
              {post.title}
            </h1>
            <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" aria-hidden="true" />
                {post.author.name}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                {formatDate(post.date)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" aria-hidden="true" />
                {post.readTime}
              </span>
            </div>
          </div>
        </Container>
      </section>

      {/* Hero image */}
      <section className="bg-white">
        <Container>
          <Reveal>
            <div className="relative mx-auto aspect-[16/9] max-w-4xl overflow-hidden rounded-3xl shadow-xl shadow-pif-navy/15 ring-1 ring-pif-navy/10">
              <Image
                src={imageUrl(heroImage, 1400)}
                alt={heroImage.alt}
                fill
                priority
                sizes="(max-width: 896px) 100vw, 896px"
                className="object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-pif-navy-900/25 via-transparent to-transparent" />
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Article body */}
      <section className="bg-white py-14 md:py-20">
        <Container>
          <article className="mx-auto max-w-3xl">
            <SampleArticleContent />

            {/* Disclosure */}
            <p className="mt-10 rounded-2xl bg-pif-mist px-6 py-5 text-sm leading-relaxed text-slate-600 ring-1 ring-pif-navy/5">
              {BRAND.name} is a health care sharing community — it is{' '}
              <strong className="font-semibold text-pif-navy-800">not insurance</strong>.
              Members voluntarily share one another&apos;s eligible medical costs.
              This article is for general information and is not medical or
              financial advice.
            </p>

            {/* Author card */}
            <div className="mt-12 flex items-center gap-4 rounded-2xl border border-pif-navy-100 bg-white p-6 shadow-sm ring-1 ring-pif-navy/5">
              <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full pif-grad-care text-white shadow-md shadow-pif-teal/25">
                <User className="h-7 w-7" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pif-teal-700">
                  Written by
                </p>
                <p className="mt-1 font-heading text-lg font-semibold text-pif-navy-800">
                  {post.author.name}
                </p>
                <p className="text-sm text-slate-500">{post.author.role}</p>
              </div>
            </div>
          </article>
        </Container>
      </section>

      {/* Related posts */}
      {post.related.length > 0 && (
        <section className="hub-section-muted py-16 md:py-20">
          <Container>
            <Reveal>
              <h2 className="font-heading text-[clamp(1.5rem,3vw,2rem)] font-semibold text-pif-navy-800">
                Keep reading
              </h2>
              <p className="mt-2 text-slate-600">
                More guidance and stories from the community.
              </p>
            </Reveal>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {post.related.map((related, i) => {
                const relatedPost = PLACEHOLDER_POSTS[related.slug];
                const image =
                  CATEGORY_IMAGE[relatedPost?.category ?? ''] ?? IMAGES.community;
                return (
                  <Reveal key={related.slug} delay={i * 0.08}>
                    <Link
                      href={`/blog/${related.slug}`}
                      className="group flex h-full overflow-hidden rounded-2xl border border-pif-navy-100 bg-white shadow-sm ring-1 ring-pif-navy/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-pif-navy/10"
                    >
                      <div className="relative w-32 flex-shrink-0 overflow-hidden sm:w-40">
                        <Image
                          src={imageUrl(image, 400)}
                          alt={image.alt}
                          fill
                          sizes="160px"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <div className="flex flex-1 flex-col justify-center p-5">
                        {relatedPost?.category && (
                          <span className="text-xs font-semibold uppercase tracking-wide text-pif-teal-700">
                            {relatedPost.category}
                          </span>
                        )}
                        <p className="mt-1.5 font-heading font-semibold leading-snug text-pif-navy-800 transition-colors group-hover:text-pif-teal-700 line-clamp-2">
                          {related.title}
                        </p>
                        <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-pif-teal-700">
                          Read article
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </Container>
        </section>
      )}

      {/* Final CTA */}
      <CTABand
        title="Ready to join a community that cares?"
        subtitle="Thousands of families have chosen transparency, real savings, and a community that pays it forward. Join any time — there is no enrollment window."
        primary={{ label: 'Become a Member', href: '/enroll' }}
        secondary={{ label: 'Compare Plans', href: '/plans' }}
      />
    </>
  );
}
