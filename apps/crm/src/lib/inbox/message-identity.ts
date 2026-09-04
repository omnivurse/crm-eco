/**
 * Identity of a provider message inside the inbox.
 *
 * Backed by the unique index `inbox_messages_provider_identity_key`. Every
 * writer upserts against this target so a provider redelivery, a cron retry, or
 * an outbox row reclaimed as stale lands on the existing row instead of adding a
 * duplicate copy of the same email.
 *
 * Scoped per org because the same RFC-822 Message-ID can legitimately be
 * delivered to two tenants, and per direction because inbound stores the
 * Message-ID while outbound stores the provider's send id — two different
 * namespaces sharing one column.
 *
 * Rows with a null `external_id` or `external_provider` are exempt: Postgres
 * treats nulls as distinct in a unique index, so messages with no provider
 * identity can never collide with each other.
 */
export const INBOX_MESSAGE_IDENTITY_CONFLICT_TARGET =
  'org_id,direction,external_provider,external_id';
