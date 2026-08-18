import type { Metadata } from 'next';
import CrmLandingPage from '@/components/landing/CrmLandingPage';

const TITLE = 'Double Helix CRM | Book of business, enrollments, commissions';
const DESCRIPTION =
  'Double Helix CRM keeps contacts, enrollments and commissions on the same record, so a benefits agency runs the book from one queue.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'Double Helix CRM',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function Home() {
  return <CrmLandingPage />;
}
