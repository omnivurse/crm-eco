/**
 * The `describe` sentence of every rule renders VERBATIM on the Data Health
 * card, under the rule's label, to a business owner who has never seen this
 * schema. It is product copy, not a code comment.
 *
 * An earlier catalog shipped sentences like "no start date anywhere the
 * activate-pending cron looks (the server invariant blocks new ones; this is
 * pre-guard residue)" and "The linked_member_id on these records points at no
 * row in the members table" straight onto the page. Every one of those words is
 * true and none of them mean anything to the person the page is for.
 *
 * The engineering rationale did not get deleted — it moved to `rationale`,
 * which the route deliberately does not send. This test is the fence between
 * the two: it fails the moment schema vocabulary leaks back into `describe`.
 */

import { describe as suite, it, expect } from 'vitest';
import { DATA_HEALTH_RULES } from './rules';

/** Words that are precise to an engineer and opaque to an owner. */
const BANNED: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /\bcron\b/i, why: 'say "automatically" or name the job in plain words' },
  { pattern: /\bserver invariant\b/i, why: 'say what it stops, not what it is called' },
  { pattern: /\bpre-guard residue\b/i, why: 'say "leftovers from before that rule existed"' },
  { pattern: /\bterminal (status|state)\b/i, why: 'say "never finished or failed cleanly"' },
  { pattern: /\bNOT NULL\b/, why: 'describe the guarantee, not its DDL' },
  { pattern: /\bON DELETE CASCADE\b/i, why: 'describe the guarantee, not its DDL' },
  { pattern: /\bforeign key\b/i, why: 'describe the link in plain words' },
  { pattern: /->>/, why: 'a JSON path is not owner-facing copy' },
  { pattern: /\bRLS\b/, why: 'owners do not know what row-level security is' },
  { pattern: /\bnullable\b/i, why: 'say "optional" or "may be left empty"' },
  { pattern: /\bcolumn\b/i, why: 'say "field" — and usually not even that' },
  // A bare snake_case or dotted schema identifier: crm_trash_batches,
  // linked_member_id, members.effective_date, reap_stalled_import_jobs.
  { pattern: /\b[a-z]+(?:_[a-z0-9]+)+\b/, why: 'a table/column identifier is not owner copy' },
  { pattern: /\b(?:crm|public)\.[a-z_]+\b/i, why: 'a qualified table name is not owner copy' },
];

/**
 * Allowed even though they match a rule above: product surfaces an owner
 * actually clicks, spelled the way the UI spells them.
 */
const ALLOWED_PHRASES: RegExp[] = [/Dropdown lists/i, /Review Duplicates/i];

function strip(text: string): string {
  return ALLOWED_PHRASES.reduce((acc, re) => acc.replace(new RegExp(re, 'gi'), ''), text);
}

suite('rule `describe` copy is owner-facing', () => {
  it('every rule has one', () => {
    for (const rule of DATA_HEALTH_RULES) {
      expect(rule.describe.trim().length, rule.key).toBeGreaterThan(30);
    }
  });

  it('carries no schema or engineering vocabulary', () => {
    const offences: string[] = [];
    for (const rule of DATA_HEALTH_RULES) {
      const text = strip(rule.describe);
      for (const { pattern, why } of BANNED) {
        const hit = text.match(pattern);
        if (hit) offences.push(`${rule.key}: "${hit[0]}" — ${why}`);
      }
    }
    expect(offences, offences.join('\n')).toEqual([]);
  });

  it('uses the ellipsis glyph, never three dots', () => {
    for (const rule of DATA_HEALTH_RULES) {
      expect(rule.describe.includes('...'), rule.key).toBe(false);
    }
  });

  it('keeps the engineering rationale off the owner-facing sentence but not deleted', () => {
    // The rules whose "why is the SQL shaped like this" note was the reason the
    // old describe read like a commit message. Each must still carry it.
    const mustKeepRationale = [
      'refs.orphan-tasks',
      'refs.linked-member',
      'refs.trash-batch',
      'vocabulary.status',
      'completeness.member-core',
      'twins.contact-member',
      'ingest.stuck-imports',
      'refs.orphan-notes',
      'dates.pending-no-start',
      'lifecycle.stale-pending',
    ];
    for (const key of mustKeepRationale) {
      const rule = DATA_HEALTH_RULES.find((r) => r.key === key);
      expect(rule, key).toBeTruthy();
      expect(rule!.rationale?.trim().length ?? 0, key).toBeGreaterThan(20);
    }
  });
});
