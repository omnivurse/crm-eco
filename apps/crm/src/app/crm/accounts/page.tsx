import { redirect } from 'next/navigation';

interface PageProps {
  /** Forward the full query string so filters, scope, territory, sort, etc. match the list page. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Accounts page - redirects to the generic module page with the accounts module key
// This provides a dedicated URL while reusing the existing module infrastructure
export default async function AccountsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const queryString = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val === undefined || val === '') continue;
    if (Array.isArray(val)) {
      for (const v of val) {
        if (v !== undefined && v !== '') queryString.append(key, v);
      }
    } else {
      queryString.set(key, val);
    }
  }

  const query = queryString.toString();
  redirect(`/crm/modules/accounts${query ? `?${query}` : ''}`);
}
