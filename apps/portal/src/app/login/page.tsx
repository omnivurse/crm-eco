import { redirect } from 'next/navigation';

/** Canonical member sign-in route — /login kept for bookmarks. */
export default async function LoginRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const target = params.redirect
    ? `/signin?redirect=${encodeURIComponent(params.redirect)}`
    : '/signin';
  redirect(target);
}
