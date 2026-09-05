# Inbound email routing fix — `payitforwardhealth.com`

**Prepared 2026-09-05. Two people are needed: whoever administers the Liberation
Email account, and whoever administers DNS at the registrar.**

---

## The problem in one paragraph

`payitforwardhealth.com` currently publishes **three MX records at the same
priority**, pointing at two unrelated mail systems:

```
payitforwardhealth.com.  60  IN  MX  10 mx1.liberation.email.
payitforwardhealth.com.  60  IN  MX  10 mx2.liberation.email.
payitforwardhealth.com.  60  IN  MX  10 inbound-smtp.us-east-1.amazonaws.com.   ← the problem
```

When MX records share a priority, a sending server picks one and delivers the
message there **only**. So every message to `@payitforwardhealth.com` lands in
either the Liberation mailbox *or* the CRM — never both, and which one is
effectively random. Neither system has the full record of any conversation.

This is why email threads look incomplete and replies appear to go missing.

**Nothing is being permanently destroyed** — each message is delivered
somewhere. But roughly a third of mail is currently reaching only the CRM and
never the real mailbox, and the rest reaches only the mailbox and never the CRM.

---

## The fix, in the order it must be done

> **Do not start at step 3.** Removing the DNS record before forwarding is in
> place leaves the CRM blind to new mail. Done in the order below, there is
> never a moment when either system loses visibility.

### Step 1 — Liberation Email: add forwarding (no DNS changes yet)

**Preferred: configure a catch-all.** A catch-all that preserves the local part
(`*@payitforwardhealth.com` → `*@mail.payitforwardhealth.com`) is safest,
because mail to any address not listed below still reaches the CRM. There is
already at least one real message on file addressed to an unlisted name, so a
fixed list will miss some traffic.

If a catch-all is not possible, forward each address below to the **same local
part** on `mail.payitforwardhealth.com` — e.g.
`billing@payitforwardhealth.com` → `billing@mail.payitforwardhealth.com`.

These are the 16 addresses the CRM already recognises as queues:

| | | |
|---|---|---|
| `admin@` | `advocacy@` | `billing@` |
| `compliance@` | `contact@` | `enrollment@` |
| `hello@` | `info@` | `legal@` |
| `membership@` | `notifications@` | `privacy@` |
| `security@` | `support@` | `wendy@` |
| `noreply@` | | |

`noreply@` and `notifications@` are used for outbound only. Forwarding them is
optional — worth doing if you want bounce replies captured, skippable if you
would rather keep that noise out of the shared inbox.

Keep delivery to the original mailbox as well — this should be
**forward *and* keep a copy**, not a redirect. If Liberation offers
"redirect / do not retain", do not use it.

Notes for the administrator:
- The CRM recognises the `mail.` subdomain and folds those messages back into
  the normal `billing@` / `support@` / `wendy@` queues automatically. You do
  **not** need to create anything on the CRM side, and no mailboxes need to
  exist on the `mail.` subdomain — the CRM receives for the whole subdomain.
- Do not forward to `@payitforwardhealth.com` addresses — that would loop.

### Step 2 — Verify forwarding before touching DNS

1. Send a test message from an outside address (a personal Gmail is fine) to
   `billing@payitforwardhealth.com`.
2. Confirm it arrives in the Liberation mailbox as normal.
3. Confirm it appears in the CRM shared inbox under the **`billing@`** queue.

If it appears under a separate `billing@mail.payitforwardhealth.com` queue
instead of the normal `billing@` queue, stop and report that before continuing.

Repeat once more for a second address. Only proceed when both land correctly.

### Step 3 — Registrar: remove one MX record

Delete **only** this record from `payitforwardhealth.com`:

```
10 inbound-smtp.us-east-1.amazonaws.com
```

Leave both Liberation records exactly as they are:

```
10 mx1.liberation.email.     ← keep
10 mx2.liberation.email.     ← keep
```

Two hosts at equal priority from a single provider is correct redundancy. The
problem was only ever the third, competing destination.

The TTL on these records is 60 seconds, so the change settles in about a
minute. Removing one MX from a set does not cause bounces — the remaining
hosts already accept this mail today.

### Step 4 — Confirm

1. `dig payitforwardhealth.com MX` should return only the two Liberation hosts.
2. Send one more test to `support@payitforwardhealth.com`.
3. Confirm it arrives in **both** the Liberation mailbox and the CRM.

Watch for the first business day after the change: every inbound message should
now appear in both places rather than one.

---

## Two further DNS records (independent of the above)

These relate to open/click tracking, not to mail delivery. They can be done at
any time, including before step 1.

| Type | Name | Value | Purpose |
|---|---|---|---|
| CNAME | `link` | `links1.resend-dns.com` | Enables open & click tracking |
| CAA | `@` (apex) | `0 issue "amazon.com"` | Optional — see warning |

### ⚠️ Warning about the CAA record

The apex **already has three CAA records**:

```
0 issue "sectigo.com"
0 issue "letsencrypt.org"
0 issue "pki.goog"
```

CAA is deny-by-default: only the certificate authorities listed may issue
certificates. The current TLS certificates are issued by **Let's Encrypt**.

**The Amazon entry must be ADDED as a fourth record. It must not replace the
existing three.** If the set is replaced with only `amazon.com`, Let's Encrypt
is no longer authorised and certificate renewal for
`crm.payitforwardhealth.com` and `admin.payitforwardhealth.com` will begin to
fail, taking those sites offline when the current certificates expire.

If in doubt, **skip the CAA record entirely.** The only consequence is a
"pending" line in the Resend dashboard; tracking still works without it.

### Note on the `link` CNAME

There is a wildcard `*.payitforwardhealth.com` A record pointing at Vercel.
That is fine — an explicit CNAME for `link` takes precedence over a wildcard.
No change to the wildcard is needed.

Once this record resolves, click tracking rewrites links in outbound marketing
email through `link.payitforwardhealth.com`. If that is not wanted, say so and
tracking can be turned off instead.

---

## Rollback

Every step is reversible.

| Step | To undo |
|---|---|
| Step 1 (forwarding) | Remove the forwarding rules at Liberation. |
| Step 3 (MX removal) | Re-add `10 inbound-smtp.us-east-1.amazonaws.com` to the apex MX. Restores the previous behaviour within ~60s. |
| `link` CNAME | Delete the record; tracking returns to inactive. |
| CAA | Delete the added `amazon.com` entry. |

No message already stored in the CRM is affected by any step here. All 62
messages currently on file remain untouched.

---

## Things not to do

- **Do not** set different priorities on the MX records hoping to get a copy in
  both systems. MX priority is failover, not duplication — the lower number
  receives everything and the higher number receives nothing until the first
  one is unreachable. Forwarding is the only way both systems get a copy.
- **Do not** remove the Liberation MX records. That would move all staff mail
  into the CRM and out of their mailboxes.
- **Do not** replace the existing CAA records (see warning above).
- **Do not** change the MX on `mail.payitforwardhealth.com`. That subdomain is
  correctly configured with a single MX and is what the CRM receives on.
