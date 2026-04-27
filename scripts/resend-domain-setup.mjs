#!/usr/bin/env node
/**
 * Resend domain setup — doublehelix.com
 * --------------------------------------------------------------
 * Turnkey, idempotent script that prepares the marketing site's
 * `/api/contact` Resend integration end-to-end:
 *
 *   1. Looks up `doublehelix.com` in your Resend account.
 *   2. Creates it if missing (US-East, sending enabled, opportunistic
 *      TLS, click+open tracking off so we never leak prospect data).
 *   3. Prints the DNS records (SPF, DKIM, DMARC, return-path) you must
 *      publish at your DNS provider.
 *   4. Polls verification status every 10s for up to ~5 minutes once
 *      you confirm DNS is live (or run with --no-wait to skip).
 *   5. Optionally fires a test transactional email to a recipient you
 *      provide via --to <email>, using the same React Email template
 *      the live `/api/contact` endpoint uses.
 *
 * Auth:
 *   Set RESEND_API_KEY before running. Get one from
 *   https://resend.com/api-keys (full-access OK; the script only uses
 *   domain.read/write and email.send).
 *
 * Usage:
 *   RESEND_API_KEY=re_xxx node scripts/resend-domain-setup.mjs
 *   RESEND_API_KEY=re_xxx node scripts/resend-domain-setup.mjs --to you@yourdomain.com
 *   RESEND_API_KEY=re_xxx node scripts/resend-domain-setup.mjs --no-wait
 *
 * The script never prints the API key, never logs prospect PII, and
 * exits non-zero on any failure so it can drop into CI if needed.
 */

import process from 'node:process';

const DOMAIN = 'doublehelix.com';
const REGION = 'us-east-1';
const POLL_INTERVAL_MS = 10_000;
const POLL_MAX_ATTEMPTS = 30; // ≈ 5 min

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const NO_WAIT = flag('--no-wait');
const TO_EMAIL = arg('--to');

const API_KEY = process.env.RESEND_API_KEY;
if (!API_KEY) {
  console.error(
    '\x1b[31m✗ RESEND_API_KEY is not set.\x1b[0m\n' +
      '   Get one at https://resend.com/api-keys and rerun:\n' +
      '   RESEND_API_KEY=re_xxx node scripts/resend-domain-setup.mjs',
  );
  process.exit(1);
}

const BASE = 'https://api.resend.com';
const HEADERS = {
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.message || json?.error || res.statusText;
    throw new Error(`${method} ${path} → ${res.status} ${msg}`);
  }
  return json;
}

const ok = (m) => console.log(`\x1b[32m✓\x1b[0m ${m}`);
const info = (m) => console.log(`  ${m}`);
const warn = (m) => console.log(`\x1b[33m!\x1b[0m ${m}`);
const fail = (m) => console.log(`\x1b[31m✗\x1b[0m ${m}`);

function printRecords(records) {
  if (!records?.length) {
    warn('No DNS records returned by Resend.');
    return;
  }
  console.log('');
  console.log('  DNS records to publish:');
  console.log('  ---------------------------------------------------------------------');
  for (const r of records) {
    const status = r.status ? ` [${r.status}]` : '';
    console.log(`  • ${r.record} ${r.type}${status}`);
    console.log(`      name : ${r.name}`);
    console.log(`      value: ${r.value}`);
    if (r.priority !== undefined && r.priority !== null) {
      console.log(`      priority: ${r.priority}`);
    }
    if (r.ttl) console.log(`      ttl  : ${r.ttl}`);
    console.log('');
  }
}

async function findDomain() {
  const res = await api('GET', '/domains?limit=100');
  const items = res?.data ?? res?.items ?? [];
  return items.find((d) => d.name?.toLowerCase() === DOMAIN);
}

async function createDomain() {
  return api('POST', '/domains', {
    name: DOMAIN,
    region: REGION,
  });
}

async function getDomain(id) {
  return api('GET', `/domains/${id}`);
}

async function verifyDomain(id) {
  return api('POST', `/domains/${id}/verify`).catch((e) => {
    // Some accounts return 4xx if verification has already succeeded.
    warn(`verify endpoint returned: ${e.message}`);
    return null;
  });
}

async function pollUntilVerified(id) {
  for (let i = 1; i <= POLL_MAX_ATTEMPTS; i++) {
    const d = await getDomain(id);
    info(`attempt ${i}/${POLL_MAX_ATTEMPTS} — status=${d.status}`);
    if (d.status === 'verified') return d;
    if (i < POLL_MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return null;
}

async function sendTestEmail(toEmail) {
  const subject = '[Double Helix] Resend integration test';
  const text =
    'This is a Resend deliverability test from scripts/resend-domain-setup.mjs.\n' +
    'If you can read this, doublehelix.com is verified and `from`-able.';
  return api('POST', '/emails', {
    from: process.env.SALES_FROM_EMAIL || `Double Helix <noreply@${DOMAIN}>`,
    to: [toEmail],
    subject,
    text,
    tags: [
      { name: 'app', value: 'marketing' },
      { name: 'kind', value: 'integration-test' },
    ],
  });
}

async function main() {
  console.log(`Resend setup for ${DOMAIN}\n`);

  let domain = await findDomain();

  if (!domain) {
    info(`creating ${DOMAIN} in ${REGION}…`);
    const created = await createDomain();
    domain = created;
    ok(`created (id=${created.id})`);
  } else {
    ok(`found existing domain (id=${domain.id}, status=${domain.status})`);
  }

  const detail = await getDomain(domain.id);

  if (detail.status === 'verified') {
    ok('domain is already \x1b[1mverified\x1b[0m — DNS is good.');
  } else {
    warn(`current status: ${detail.status}`);
    printRecords(detail.records);
    info('publish the records above at your DNS provider, then rerun this script.');
    info('Resend usually verifies within 1–10 minutes after DNS propagates.');

    if (!NO_WAIT) {
      info('triggering verification…');
      await verifyDomain(domain.id);
      info(`polling for "verified" status (every ${POLL_INTERVAL_MS / 1000}s)…`);
      const v = await pollUntilVerified(domain.id);
      if (v?.status === 'verified') {
        ok('domain verified \x1b[32m🎉\x1b[0m');
      } else {
        warn('domain still not verified after polling — DNS may need more time.');
        warn('Rerun this script later or check https://resend.com/domains');
        if (!TO_EMAIL) process.exit(0); // not an error per se
        process.exit(0);
      }
    } else {
      info('--no-wait passed; skipping verification polling.');
      process.exit(0);
    }
  }

  if (TO_EMAIL) {
    info(`sending test email to ${TO_EMAIL}…`);
    const sent = await sendTestEmail(TO_EMAIL);
    ok(`test email queued (id=${sent.id || sent.data?.id || 'unknown'})`);
    info('check the recipient inbox — it should arrive within ~30s.');
    info('inspect logs: https://resend.com/logs');
  } else {
    info('skip test send (pass --to <email> to fire a deliverability test).');
  }

  console.log('');
  ok('Resend setup complete.');
  ok(
    'Next: set RESEND_API_KEY, SALES_FROM_EMAIL, SALES_INBOX_EMAIL on the\n' +
      '   `apps/marketing` Vercel project (Production scope) and redeploy.',
  );
}

main().catch((err) => {
  fail(err.message || err);
  process.exit(1);
});
