import Image from 'next/image';
import Link from 'next/link';
import { imageUrl, type UnsplashImage } from '@/lib/site-images';

const CANDIDATES: Array<UnsplashImage & { label: string; vibe: string }> = [
  {
    id: 'photo-1511895426328-dc8714191300',
    alt: 'A multi-generational family holding hands on the beach at sunset',
    label: 'A · Family at sunset',
    vibe: 'Healthy living + togetherness — multigenerational family on the beach',
  },
  {
    id: 'photo-1529156069898-49953e39b3ac',
    alt: 'Friends with arms around each other overlooking the water',
    label: 'B · Community arms',
    vibe: '“We have you covered” — friends supporting each other at the waterfront',
  },
  {
    id: 'photo-1544367567-0f2fcb009e0b',
    alt: 'A person in a yoga pose silhouetted against a sunset sky',
    label: 'C · Yoga at sunset',
    vibe: 'Calm wellness and vitality — serene healthy-living energy',
  },
  {
    id: 'photo-1571019614242-c5c5dee9f50b',
    alt: 'A trainer coaching someone through an exercise',
    label: 'D · Active support',
    vibe: 'Healthy living + guidance — someone in your corner',
  },
  {
    id: 'photo-1469571486292-0ba58a3f068b',
    alt: 'Painted hands forming a heart shape together',
    label: 'E · Community heart',
    vibe: 'Pay-it-forward community care — bold and symbolic',
  },
];

function HeroMock({ label, vibe, ...image }: (typeof CANDIDATES)[number]) {
  return (
    <article className="overflow-hidden rounded-2xl border border-pif-navy-100 bg-white shadow-sm">
      <div className="relative aspect-[16/9] overflow-hidden border-b border-pif-navy-100">
        <Image
          src={imageUrl(image, 1200)}
          alt={image.alt}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover opacity-[0.22]"
        />
        <div className="absolute inset-0 bg-white/82" />
        <div className="absolute inset-0 flex flex-col justify-center px-8 sm:px-12">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-pif-teal-800">{label}</p>
          <h2 className="max-w-md font-heading text-2xl font-semibold leading-tight text-pif-navy-800 sm:text-3xl">
            The caring alternative to <span className="text-pif-teal-700">health insurance</span>
          </h2>
          <p className="mt-3 max-w-sm text-sm text-slate-600">
            Same 22% image + 82% white overlay as the live hero.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p className="text-sm text-slate-600">{vibe}</p>
        <a
          href={imageUrl(image, 1600)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-pif-teal-700 hover:underline"
        >
          Full image ↗
        </a>
      </div>
    </article>
  );
}

export default function HeroPreviewPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
      <div className="mb-10">
        <Link href="/" className="text-sm font-medium text-pif-teal-700 hover:underline">
          ← Back to home
        </Link>
        <h1 className="mt-4 font-heading text-3xl font-semibold text-pif-navy-800">Hero background preview</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Each option shows the exact hero treatment. Pick a letter (A–E) and I&apos;ll swap it on the homepage — nothing
          changes until you choose.
        </p>
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Note: the current live hero uses an ID that resolves to a doctor in PPE, not a family outdoors scene. These
          options were visually verified.
        </p>
      </div>

      <div className="grid gap-8">
        {CANDIDATES.map((candidate) => (
          <HeroMock key={candidate.id} {...candidate} />
        ))}
      </div>
    </main>
  );
}
