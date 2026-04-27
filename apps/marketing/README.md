# Double Helix Software — Marketing Site

The public marketing site for **Double Helix Software**, deployed at
[`doublehelix.com`](https://doublehelix.com). Showcases the two licensed
SaaS products — **Admin** (member management & enrollment) and **CRM**
(sales & enrollment automation) — as the twin-strand operating system
for healthcare organizations.

## Stack

- **Next.js 16** (App Router, server components, edge-rendered statics)
- **Tailwind CSS 3** (custom dark-helix design tokens — _not_ shared with
  the PIFH consumer site, so the SaaS brand stays visually distinct)
- **Phosphor Duotone** icons (curated set in `src/components/icons`)
- **Framer Motion** for entrance animations
- Animated DNA helix rendered to `<canvas>` (GPU-friendly, reduced-motion
  safe — see `src/components/helix/HelixCanvas.tsx`)

## Local development

```bash
# from the repo root
npm install
npm run dev:marketing
# → http://localhost:3010
```

## Production build

```bash
npm run build:marketing
```

## Deployment (Vercel)

1. **Create a new Vercel project** pointing at this monorepo.
2. **Project root**: `apps/marketing`
3. **Build command**: `cd ../.. && npm run build --workspace=@crm-eco/marketing`
4. **Install command**: `cd ../.. && npm install --no-audit --no-fund`
5. **Output directory**: `.next` (default)
6. **Domains**:
   - Primary: `doublehelix.com`
   - Apex redirect: `www.doublehelix.com → doublehelix.com`

The companion **Admin** app (`apps/admin`) deploys separately at
`admin.doublehelix.com` with a wildcard subdomain (`*.admin.doublehelix.com`)
so each tenant gets a branded subdomain (e.g. `acme.admin.doublehelix.com`).

## Routes

| Route          | Purpose                                                      |
| -------------- | ------------------------------------------------------------ |
| `/`            | Umbrella landing — featuring both products as twin strands   |
| `/admin`       | Admin product page (cyan-toned)                              |
| `/crm`         | CRM product page (violet-toned)                              |
| `/contact`     | Demo request form                                            |
| `/api/contact` | Form submission handler (wire to Resend in env vars)         |
| `/sitemap.xml` | Generated sitemap                                            |
| `/robots.txt`  | Generated robots                                             |

## Design system

The dark-helix aesthetic lives in:

- `tailwind.config.ts` — colour scales, typography, animations
- `src/app/globals.css` — base styles, gradient utilities, aurora layers
- `src/components/primitives/*` — Container, Button, SectionHeading
- `src/components/brand/HelixMark.tsx` — Branded SVG mark
- `src/components/helix/HelixCanvas.tsx` — Animated DNA helix

When evolving the brand, prefer extending tokens in `tailwind.config.ts`
over adding ad-hoc classes in components.
