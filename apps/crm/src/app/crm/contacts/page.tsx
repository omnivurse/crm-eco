import { redirect } from 'next/navigation';

interface PageProps {
  searchParams: Promise<{
    view?: string;
    page?: string;
    search?: string;
  }>;
}

// Contacts page - redirects to the generic module page with the contacts module key
// This provides a dedicated URL while reusing the existing module infrastructure
export default async function ContactsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const queryString = new URLSearchParams();
  if (params.view) queryString.set('view', params.view);
  if (params.page) queryString.set('page', params.page);
  if (params.search) queryString.set('search', params.search);
  
  const query = queryString.toString();
  redirect(`/crm/modules/contacts${query ? `?${query}` : ''}`);
}
