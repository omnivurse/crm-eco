import type { Metadata } from 'next';
import { AdminProductSurface } from '@/components/product/AdminProductSurface';

export const metadata: Metadata = {
  title: 'Admin — Member management & enrollment platform',
  description:
    'The Admin platform is the system of record for members, agents, products, billing, and commissions. Multi-tenant. HIPAA-ready. Engineered for healthcare operations.',
};

export default function AdminProductPage() {
  return <AdminProductSurface />;
}
