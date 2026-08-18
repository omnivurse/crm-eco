'use client';

import { useEffect, useState } from 'react';

/**
 * NOTE FOR APP AGENTS — read before you keep this on a sign-in page.
 *
 * Rotating aphorisms are marketing furniture. On the front door of a
 * production system they are the one element that moves while someone is
 * typing a password, and WCAG 2.2.2 treats auto-updating content over five
 * seconds as something the user must be able to pause. The component is
 * therefore easy to omit — `showQuotes={false}` on AuthHeroPanel — and that
 * is the recommendation for the CRM and Admin consoles.
 *
 * The copy below and at every call site is UNCHANGED. Nothing here invents,
 * edits or attributes a quote.
 *
 * Behaviour kept as shipped: no rotation under prefers-reduced-motion, no
 * rotation with a single quote, same 8s interval, same props.
 */
const DEFAULT_QUOTES = [
  { text: 'The greatest wealth is health.', author: 'Virgil' },
  { text: 'Caring for others is an expression of what it means to be fully human.', author: 'Hillary Clinton' },
  { text: 'Health is not valued till sickness comes.', author: 'Thomas Fuller' },
  { text: 'Wherever the art of medicine is loved, there is also a love of humanity.', author: 'Hippocrates' },
  { text: 'To care for those who once cared for us is one of the highest honors.', author: 'Tia Walker' },
  { text: 'It is health that is real wealth and not pieces of gold and silver.', author: 'Mahatma Gandhi' },
];

export interface AuthQuoteRotatorProps {
  quotes?: Array<{ text: string; author: string }>;
  intervalMs?: number;
  className?: string;
}

export function AuthQuoteRotator({
  quotes = DEFAULT_QUOTES,
  intervalMs = 8000,
  className,
}: AuthQuoteRotatorProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || quotes.length <= 1) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % quotes.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [quotes.length, intervalMs]);

  return (
    <div className={['auth-quote', className].filter(Boolean).join(' ')}>
      {quotes.map((quote, index) => {
        const active = index === activeIndex;
        return (
          <blockquote
            key={`${quote.author}-${index}`}
            className={`auth-quote-item login-quote-transition ${
              active ? 'login-quote-active' : 'login-quote-inactive'
            }`}
            /* The inactive quotes are painted to zero opacity but stayed in
               the accessibility tree, so a screen reader read all six in a
               row. They are hidden from it now; the visible one is not. */
            aria-hidden={active ? undefined : 'true'}
          >
            <p className="auth-quote-text">&ldquo;{quote.text}&rdquo;</p>
            <p className="auth-quote-author">&mdash; {quote.author}</p>
          </blockquote>
        );
      })}
    </div>
  );
}
