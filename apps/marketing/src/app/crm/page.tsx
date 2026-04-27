import type { Metadata } from 'next';
import { CrmProductSurface } from '@/components/product/CrmProductSurface';

export const metadata: Metadata = {
  title: 'CRM — Sales, advisor & enrollment automation',
  description:
    'A pipeline CRM tuned for advisor networks: lead routing, hierarchy, deal stages, e-signature enrollment, and built-in compliance. Pairs natively with Admin.',
};

export default function CrmProductPage() {
  return <CrmProductSurface />;
}
