import AdminLandingPage from '@/components/landing/AdminLandingPage';

export const metadata = {
  title: 'MMS | Benefits Enrollment & Member Management System | Double Helix Hub',
  description:
    'MMS is the operations engine for health sharing: digital applications and e-sign, plan selection, the member registry, billing and NACHA, and agent commissions on one record.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    title: 'MMS | Benefits Enrollment & Member Management System',
    description:
      'Enrollment at the front, the member registry in the middle, billing and agent payouts at the end — one engine, one record.',
    siteName: 'Double Helix MMS',
  },
};

export default function Home() {
  return <AdminLandingPage />;
}
