/**
 * Identity of a provider message inside the inbox.
 *
 * Backed by the unique index `inbox_messages_provider_identity_key`. Every
 * writer upserts against this target so a webhook redelivery or a cron retry
 * lands on the row it already filed instead of adding a duplicate copy.
 *
 * Scoped per org because the same RFC-822 Message-ID can legitimately be
 * delivered to two tenants, and per direction because inbound stores the
 * Message-ID while outbound stores the provider's send id — two different
 * namespaces sharing one column.
 *
 * Rows with a null `external_id` or `external_provider` are exempt: Postgres
 * treats nulls as distinct in a unique index, so messages with no provider
 * identity can never collide with each other.
 *
 * Mirrors `apps/crm/src/lib/inbox/message-identity.ts`, which Deno cannot import.
 */
export const MESSAGE_IDENTITY_CONFLICT_TARGET =
  "org_id,direction,external_provider,external_id";

/** PostgREST path that upserts against the identity above. */
export const MESSAGE_UPSERT_PATH =
  `/rest/v1/inbox_messages?on_conflict=${MESSAGE_IDENTITY_CONFLICT_TARGET}`;

/**
 * `ignore-duplicates` (ON CONFLICT DO NOTHING), deliberately not
 * `merge-duplicates`, for inbound mail.
 *
 * Inbound bodies are hydrated by a second, best-effort call to Resend, and the
 * function already files a message with an empty body when that call fails. A
 * merging upsert would let a redelivery whose hydration failed overwrite the
 * body of a message that was filed correctly the first time — silent data loss
 * on exactly the retry path this index exists to make safe. A message that is
 * missing a body can still be recovered later through its stored
 * resend_email_id; a body overwritten with null cannot.
 *
 * So a duplicate is a true no-op: no write, and no AFTER INSERT trigger, which
 * is also what keeps a thread's message_count from drifting.
 */
export const MESSAGE_UPSERT_PREFER =
  "return=representation,resolution=ignore-duplicates";
