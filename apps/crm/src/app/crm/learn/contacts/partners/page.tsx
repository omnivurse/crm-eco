import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import { ArrowLeft, HeartHandshake, Phone, StickyNote, Building2 } from 'lucide-react';
import { QuickTip } from '@/components/learn/AnimatedDemo';

export default function PartnerContactsLearnPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8 px-4">
      <div>
        <Link
          href="/crm/learn/contacts"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Contacts
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
          Partners & support contacts
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          People at a bank, a vendor, or another partner are not leads. A lead is someone
          who might become a member. A partner is someone you work with — and their call
          notes belong on their own contact record.
        </p>
      </div>

      <QuickTip title="They are Contacts, not Leads" type="tip">
        Use <strong>Add Partner</strong> on the Contacts list, the + menu (New Partner),
        or ⌘K → “Add Partner”. Do not use Add Lead or Add Member.
      </QuickTip>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Which type to pick</h2>
        <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
          <li>
            <strong className="text-slate-800 dark:text-slate-200">Partner Contact</strong> —
            someone you work with at another organization (a banker, a lender, a clinic
            contact). This is the default.
          </li>
          <li>
            <strong className="text-slate-800 dark:text-slate-200">Support Contact</strong> —
            an operations or service person you call for help (enrollment desk, billing
            specialist), not a sales prospect.
          </li>
          <li>
            <strong className="text-slate-800 dark:text-slate-200">Vendor</strong> — a supplier
            or contractor, not a referral source.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">How to log a bank call</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-400">
          <li>Open Contacts and click <strong>Add Partner</strong>.</li>
          <li>Enter name, phone, email, company (the bank), and job title.</li>
          <li>
            Leave Contact type as Partner Contact unless they are purely operational
            support.
          </li>
          <li>
            Set Industry to Banking / Credit Union or Mortgage / Lending when it fits.
          </li>
          <li>
            Write the call notes in the box — they save on the contact automatically.
          </li>
        </ol>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Later calls: open that same contact → Notes. Each note is stamped with the date
          and time and autosaves as you type.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
          <Building2 className="mb-2 h-5 w-5 text-teal-600" />
          <p className="text-sm font-medium text-slate-900 dark:text-white">One person, one record</p>
          <p className="mt-1 text-xs text-slate-500">
            Do not create a new lead per call. Reuse the contact and add another note.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
          <Phone className="mb-2 h-5 w-5 text-teal-600" />
          <p className="text-sm font-medium text-slate-900 dark:text-white">Company is the bank</p>
          <p className="mt-1 text-xs text-slate-500">
            Put the bank name in Company so everyone at that bank is easy to find together.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
          <StickyNote className="mb-2 h-5 w-5 text-teal-600" />
          <p className="text-sm font-medium text-slate-900 dark:text-white">Notes stay on the person</p>
          <p className="mt-1 text-xs text-slate-500">
            Call details live on their Notes tab — not in a task log and not on a lead.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/crm/modules/contacts">
            <HeartHandshake className="mr-2 h-4 w-4" />
            Go to Contacts
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/crm/learn/contacts/creating">Creating members</Link>
        </Button>
      </div>
    </div>
  );
}
