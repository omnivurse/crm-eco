import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'Understand how health sharing works at Double Helix Hub — from enrollment to submitting needs and community sharing.',
};

export default function HowItWorksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
