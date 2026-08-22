import { Suspense } from 'react';
import type { Metadata } from 'next';
import { RateInstrument } from '@/components/RateInstrument';
import { landingFontVars } from '@/lib/fonts';

export const metadata: Metadata = {
  title: 'Rate instrument',
};

export default function SearchPage() {
  return (
    <div className={landingFontVars}>
      <Suspense fallback={<p style={{ padding: '2rem' }}>Loading the instrument…</p>}>
        <RateInstrument />
      </Suspense>
    </div>
  );
}
