import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function VendorsRedirect() {
  redirect('/crm/vendors');
}
