'use client';

import { useState, useEffect } from 'react';

const HEALTHCARE_QUOTES = [
  { text: 'The greatest wealth is health.', author: 'Virgil' },
  { text: 'Caring for others is an expression of what it means to be fully human.', author: 'Hillary Clinton' },
  { text: 'Health is not valued till sickness comes.', author: 'Thomas Fuller' },
  { text: 'Wherever the art of medicine is loved, there is also a love of humanity.', author: 'Hippocrates' },
  { text: 'To care for those who once cared for us is one of the highest honors.', author: 'Tia Walker' },
  { text: 'It is health that is real wealth and not pieces of gold and silver.', author: 'Mahatma Gandhi' },
  { text: 'The good physician treats the disease; the great physician treats the patient who has the disease.', author: 'William Osler' },
  { text: 'The art of medicine consists of amusing the patient while nature cures the disease.', author: 'Voltaire' },
];

const ROTATE_INTERVAL = 8000;

export default function QuoteRotator() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % HEALTHCARE_QUOTES.length);
    }, ROTATE_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-24 overflow-hidden">
      {HEALTHCARE_QUOTES.map((quote, index) => (
        <div
          key={index}
          className={`absolute inset-0 login-quote-transition ${
            index === activeIndex ? 'login-quote-active' : 'login-quote-inactive'
          }`}
        >
          <p className="text-white/90 text-lg italic leading-relaxed">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="text-white/60 text-sm mt-2">&mdash; {quote.author}</p>
        </div>
      ))}
    </div>
  );
}
