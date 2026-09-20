# Payments — universal provider seam

The enrollment + billing flows never talk to a payment gateway directly. They call
the **`PaymentProvider`** seam (`payment-provider.ts`):

```ts
const provider = getPaymentProvider();           // chosen by PAYMENT_PROVIDER env
await provider.vaultPaymentMethod({ ... });       // tokenize/store card or ACH
await provider.chargeOnce({ ... });               // one-time charge (e.g. month 1)
await provider.refund({ ... });                   // refund a prior transaction

Recurring charges use `getPaymentProviderForProcessor(payment_profiles.processor)`
so existing Authorize.Net CIM ids keep billing Authorize.Net after NMI is the
intended live rail.
```

So swapping processors is **configuration + (at most) a thin adapter** — no flow
changes. Until the client's bank is chosen, the default is a no-op placeholder.

## Providers

| `PAYMENT_PROVIDER` | What it is |
|---|---|
| `placeholder` (default) | Returns deterministic synthetic results, **never moves money**, warns loudly. For dev / before a bank is wired. |
| `http` | **Generic REST adapter** — talks to any JSON gateway via env config (below). Covers most processors with zero code. |
| `nmi` | **Intended live rail.** Browser Payment Component → Customer Vault → MIT sale. Fails closed if `NMI_PRIVATE_API_KEY` is missing. Never falls through to placeholder. |
| `authorizenet` | Authorize.Net CIM. Still required for existing `payment_profiles.processor = authorizenet` rows. |
| `<bankname>` | A bespoke adapter you register (see "Adding a bespoke adapter"). |

### NMI env (sandbox first)

```
PAYMENT_PROVIDER=nmi
NMI_PRIVATE_API_KEY=...          # server-only
NMI_ENVIRONMENT=sandbox          # or production
# NMI_API_BASE=https://sandbox.nmi.com
NEXT_PUBLIC_NMI_TOKENIZATION_KEY=...   # browser Payment Component only
```

Hosts: sandbox `https://sandbox.nmi.com` · live `https://secure.nmi.com`.
PCI: only `nmi_payment_token` / vault ids. No PAN/CVV on our servers.

Unknown `PAYMENT_PROVIDER` throws. Do not apply the `processor` column
migration, set production keys, or deploy edge functions without approval.

## Wiring the generic `http` adapter (most banks)

Set on the app that runs completion (the `admin-enroll` Vercel project):

```
PAYMENT_PROVIDER=http
PAYMENT_HTTP_VAULT_URL=https://gateway.example.com/v1/vault
PAYMENT_HTTP_CHARGE_URL=https://gateway.example.com/v1/charge
PAYMENT_HTTP_AUTH_SCHEME=bearer            # bearer | basic | header | none
PAYMENT_HTTP_API_KEY=sk_live_xxx           # token / basic password / header value
# PAYMENT_HTTP_USERNAME=...                # basic-auth only
# PAYMENT_HTTP_AUTH_HEADER=X-Api-Key       # 'header' scheme only
```

The adapter **POSTs** our canonical body to each endpoint:

- vault ⟶ `{ organizationId, memberId, email, method, billingAddress }`
  where `method` is `{type:'card',cardNumber,expiration,cardCode}` | `{type:'ach',...}` | `{type:'opaque',descriptor,value}` (tokenized — preferred).
- charge ⟶ `{ organizationId, memberId, gatewayCustomerId, gatewayPaymentProfileId, amountCents, description, idempotencyKey }`

It reads the responses via these dot-paths (defaults shown — override only if the
gateway names things differently):

```
PAYMENT_HTTP_RESP_OK=ok                     # truthy => success (else HTTP status)
PAYMENT_HTTP_RESP_ERROR=error
PAYMENT_HTTP_RESP_CUSTOMER_ID=customerId
PAYMENT_HTTP_RESP_PROFILE_ID=paymentProfileId
PAYMENT_HTTP_RESP_PAYMENT_TYPE=paymentType  # 'credit_card' | 'bank_account'
PAYMENT_HTTP_RESP_LAST_FOUR=lastFour
PAYMENT_HTTP_RESP_BRAND=brand
PAYMENT_HTTP_RESP_EXPIRATION=expiration
PAYMENT_HTTP_RESP_TXN_ID=transactionId
PAYMENT_HTTP_RESP_STATUS=status
```

> If the gateway can't accept our canonical request body, use a bespoke adapter
> instead (below) — it gives full control of the request mapping.

## Adding a bespoke adapter

```ts
import { registerPaymentProvider, GenericHttpPaymentProvider } from '@crm-eco/lib';

// Option A: reuse the HTTP adapter with custom response mapping
registerPaymentProvider('acmebank', () => new GenericHttpPaymentProvider({
  name: 'acmebank',
  vaultUrl: process.env.ACME_VAULT_URL!,
  chargeUrl: process.env.ACME_CHARGE_URL!,
  authScheme: 'header', authHeaderName: 'X-Acme-Key', apiKey: process.env.ACME_KEY,
  resp: { customerId: 'data.customer.id', paymentProfileId: 'data.token', transactionId: 'data.txn_id' },
}));

// Option B: implement PaymentProvider directly for a non-REST/SDK gateway.
```

Call `registerPaymentProvider(...)` once at process start, then set
`PAYMENT_PROVIDER=acmebank`.

## What we need from the client to go live

1. **Processor name** + whether they have a **tokenization SDK** (Accept.js-style)
   for PCI-safe, client-side card capture (strongly preferred).
2. **API credentials** (sandbox first, then production): key/secret + auth scheme.
3. **Vault + charge endpoints** (or the SDK to call), and the request/response
   shapes (so we confirm canonical mapping vs. a small override).
4. ACH support details if bank drafts are offered.

## Going live (once the bank is wired)
1. Build/configure the adapter; set `PAYMENT_PROVIDER` + creds.
2. Add the tokenized payment step to the enrollment wizard.
3. Flip `ENROLLMENT_COMPLETION_ENABLED='true'`.
4. Run one sandbox enrollment end-to-end; confirm membership + billing + portal
   invite + emails + CRM record; then switch to production keys.
