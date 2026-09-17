import Link from 'next/link';
import { FileText } from '@phosphor-icons/react/dist/ssr';
import { Card, CardContent } from '@crm-eco/ui';
import { listInvoices } from '@/lib/data/billing';
import { PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

function money(value: number | null | undefined) {
  return `$${(Number(value) || 0).toFixed(2)}`;
}

export default async function MemberInvoicesPage() {
  const { rows } = await listInvoices({ limit: 50 });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <PageHeader
        title="Invoices"
        description="Membership invoices for your household."
        backHref="/billing"
        backLabel="Back to Billing"
      />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText weight="light" className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-slate-500">No invoices yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-slate-500">
                    <th className="px-4 py-3 font-medium">Invoice</th>
                    <th className="px-4 py-3 font-medium">Due</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Balance</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((invoice) => (
                    <tr key={invoice.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-mono">{invoice.invoice_number}</td>
                      <td className="px-4 py-3">
                        {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">{money(invoice.total)}</td>
                      <td className="px-4 py-3">{money(invoice.balance_due)}</td>
                      <td className="px-4 py-3 capitalize">{invoice.status ?? 'draft'}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/api/member/invoices/${invoice.id}`}
                          className="text-[var(--mp-teal)] hover:underline"
                          target="_blank"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
