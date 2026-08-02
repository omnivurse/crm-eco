'use client';

import { useEffect, useState } from 'react';

const DEFAULT_QUOTES = [
  { text: 'The greatest wealth is health.', author: 'Virgil' },
  { text: 'Caring for others is an expression of what it means to be fully human.', author: 'Hillary Clinton' },
  { text: 'Health is not valued till sickness comes.', author: 'Thomas Fuller' },
  { text: 'Wherever the art of medicine is loved, there is also a love of humanity.', author: 'Hippocrates' },
  { text: 'To care for those who once cared for us is one of the highest honors.', author: 'Tia Walker' },
  { text: 'It is health that is real wealth and not pieces of gold and silver.', author: 'Mahatma Gandhi' },
];

interface AuthQuoteRotatorProps {
  quotes?: Array<{ text: string; author: string }>;
  intervalMs?: number;
}

export function AuthQuoteRotator({ quotes = DEFAULT_QUOTES, intervalMs = 8000 }: AuthQuoteRotatorProps) {
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
    <div className="relative h-24 overflow-hidden">
      {quotes.map((quote, index) => (
        <div
          key={`${quote.author}-${index}`}
          className={`absolute inset-0 login-quote-transition ${
            index === activeIndex ? 'login-quote-active' : 'login-quote-inactive'
          }`}
        >
          <p className="text-[var(--auth-text)] text-lg italic leading-relaxed opacity-90">&ldquo;{quote.text}&rdquo;</p>
          <p className="text-[var(--auth-muted)] text-sm mt-2">&mdash; {quote.author}</p>
        </div>
      ))}
    </div>
  );
}
