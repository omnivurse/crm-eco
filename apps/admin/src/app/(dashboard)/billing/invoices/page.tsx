import { redirect } from 'next/navigation';

export default function BillingInvoicesRedirect() {
  redirect('/invoices');
}
