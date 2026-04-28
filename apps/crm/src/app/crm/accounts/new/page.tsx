import { redirect } from 'next/navigation';

/** Canonical create URL is `/crm/modules/accounts/new`; keep this for bookmarks and old links. */
export default function AccountsNewRedirect() {
  redirect('/crm/modules/accounts/new');
}
