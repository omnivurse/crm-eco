import { redirect } from 'next/navigation';
import { inboxConversationHref } from '@/lib/inbox/new-mail-notification';

export default async function InboxConversationRedirect({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  redirect(conversationId ? inboxConversationHref(conversationId) : '/crm/inbox');
}
