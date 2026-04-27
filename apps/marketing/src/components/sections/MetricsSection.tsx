'use client';

import { motion } from 'framer-motion';
import { Container } from '@/components/primitives/Container';

const metrics = [
  { value: '99.99%', label: 'Platform availability', sub: 'Multi-region failover' },
  { value: '< 200ms', label: 'p95 API response', sub: 'Edge-rendered, globally cached' },
  { value: '60%', label: 'Faster enrollment', sub: 'vs. legacy admin systems' },
  { value: 'SOC 2', label: 'Type II in progress', sub: 'HIPAA controls audited' },
];

export function MetricsSection() {
  return (
    <section className="relative border-y border-white/[0.06] bg-ink-900/40">
      <Container>
        <div className="grid grid-cols-2 divide-y divide-white/[0.06] lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.07 }}
              className="px-6 py-10 lg:px-8 lg:py-12"
            >
              <p className="tabular text-3xl font-medium tracking-tight text-white sm:text-4xl">
                {m.value}
              </p>
              <p className="mt-2 text-sm font-medium text-white/85">{m.label}</p>
              <p className="mt-1 text-xs text-helix-fog">{m.sub}</p>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
