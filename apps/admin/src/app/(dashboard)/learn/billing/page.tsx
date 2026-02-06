import { ArticleLayout, StepList, QuickTip, SectionCard } from '@/components/learn/LearnComponents';

export default function BillingLearnPage() {
  return (
    <ArticleLayout
      title="Billing & Payments"
      description="Learn how to process payments, manage invoices, and handle billing schedules."
      readTime="4 min read"
    >
      <SectionCard title="Overview">
        <p>
          The Billing module integrates with Authorize.Net to process credit card and ACH payments.
          It handles payment profiles, invoice generation, transaction tracking, and failed payment management.
        </p>
        <p>
          Navigate to <strong>Billing</strong> from the sidebar or type <code>billing</code> in the Command Center.
        </p>
      </SectionCard>

      <div id="payments">
        <SectionCard title="Processing Payments">
          <StepList steps={[
            {
              title: 'Navigate to Billing',
              description: 'Click "Billing" in the sidebar to access the billing dashboard showing recent transactions and payment status.',
            },
            {
              title: 'Select the Member',
              description: 'Find the member whose payment you need to process. You can search by name or enrollment code.',
            },
            {
              title: 'Create or Select Payment Profile',
              description: 'If the member has a stored payment profile (credit card or ACH), select it. Otherwise, create a new one with their payment details.',
            },
            {
              title: 'Process the Payment',
              description: 'Enter the amount and submit the payment. The system processes it through Authorize.Net and records the transaction.',
            },
          ]} />
        </SectionCard>
      </div>

      <QuickTip title="PCI Compliance">
        Payment card data is never stored in our system. Authorize.Net handles tokenization and PCI compliance.
        Only the payment profile reference ID is stored locally for recurring transactions.
      </QuickTip>

      <div id="invoices">
        <SectionCard title="Managing Invoices">
          <p>
            Invoices are automatically generated for member contributions and can be managed from the Invoices page.
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>Auto-generated invoice numbers</strong> — Each invoice gets a unique sequential number.</li>
            <li><strong>Status tracking</strong> — Invoices can be Draft, Sent, Paid, Overdue, or Cancelled.</li>
            <li><strong>Amount reconciliation</strong> — Track amount_due vs. amount_paid for each invoice.</li>
            <li><strong>Search</strong> — Use <code>search invoice INV-001</code> in the Command Center to find invoices.</li>
          </ul>
        </SectionCard>
      </div>

      <div id="failures">
        <SectionCard title="Handling Failed Payments">
          <p>
            When a payment fails (declined card, insufficient funds, etc.), the system tracks the failure and allows retry:
          </p>
          <StepList steps={[
            {
              title: 'Monitor Failed Payments',
              description: 'Go to Billing → Failed Payments to see all transactions that did not process successfully.',
            },
            {
              title: 'Review the Failure Reason',
              description: 'Each failed transaction includes the decline reason from Authorize.Net (e.g., "Card Declined", "Expired Card").',
            },
            {
              title: 'Update Payment Method',
              description: 'If needed, update the member\'s payment profile with new card details before retrying.',
            },
            {
              title: 'Retry the Payment',
              description: 'Click "Retry" to attempt the payment again with the updated or existing payment profile.',
            },
          ]} />
        </SectionCard>
      </div>

      <QuickTip title="Billing Schedule Automation" type="info">
        The system can automatically process recurring payments on a monthly schedule.
        Configure billing automation rules under <strong>Settings → Automations</strong>.
      </QuickTip>
    </ArticleLayout>
  );
}
