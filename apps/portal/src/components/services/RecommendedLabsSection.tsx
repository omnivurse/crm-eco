import Link from 'next/link';
import { ExternalLink, Package, TestTube2 } from 'lucide-react';
import {
  OYL_BASE_URL,
  RECOMMENDED_LAB_BUNDLES,
  RECOMMENDED_LAB_TESTS,
  type RecommendedLabItem,
} from '@/lib/labs/partners';

function LabItemCard({ item }: { item: RecommendedLabItem }) {
  const Icon = item.kind === 'bundle' ? Package : TestTube2;

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-cyan-200 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        {item.priceLabel && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold text-emerald-700">
            {item.priceLabel}
          </span>
        )}
      </div>
      <h3 className="font-semibold text-slate-900">{item.name}</h3>
      <p className="mt-1 flex-1 text-sm text-slate-600">{item.description}</p>
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-700 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-800"
      >
        Order on Own Your Labs
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>
    </article>
  );
}

function ItemGrid({ title, subtitle, items }: { title: string; subtitle: string; items: RecommendedLabItem[] }) {
  return (
    <section aria-labelledby={`${title.replace(/\s+/g, '-').toLowerCase()}-heading`}>
      <div className="mb-4">
        <h2
          id={`${title.replace(/\s+/g, '-').toLowerCase()}-heading`}
          className="text-lg font-semibold text-slate-900"
        >
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <LabItemCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

/**
 * Curated OYL tests and bundles — Tier 1 member self-serve lab ordering.
 */
export function RecommendedLabsSection() {
  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-cyan-50/40 p-5">
        <p className="text-sm text-slate-700">
          <span className="font-medium text-slate-900">How it works:</span> order tests on{' '}
          <a
            href={OYL_BASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-cyan-700 underline-offset-2 hover:underline"
          >
            Own Your Labs
          </a>
          , visit your local Labcorp® for the draw, then view results securely on their site.
          Paid out-of-pocket? You may submit eligible bills as a{' '}
          <Link href="/needs/new" className="font-medium text-cyan-700 underline-offset-2 hover:underline">
            sharing need
          </Link>
          .
        </p>
      </div>

      <ItemGrid
        title="Popular tests"
        subtitle="Most-ordered panels — affordable direct-to-consumer pricing."
        items={RECOMMENDED_LAB_TESTS}
      />

      <ItemGrid
        title="Popular bundles"
        subtitle="Curated sets for wellness check-ins and focused lab work."
        items={RECOMMENDED_LAB_BUNDLES}
      />
    </div>
  );
}
