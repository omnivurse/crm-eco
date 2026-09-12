# Cash Pay Advocate — Brand Kit

Cash Pay is the published-rate instrument at **cashpay.doublehelixhub.com**. This kit is the source of truth for that app. Every color below is sampled from the official Double Helix Hub mark (`public/logo.png`).

> Voice: the **Cash Pay Advocate**. Plain, fair, specific. We show the tick that was published — we do not invent a quote. Tagline: **Fair for All.**

---

## 1. Color palette (extracted from the logo)

The mark is three colors: a teal helix, a violet wordmark, and bronze nodes.

| Role | Name | Hex | Where it comes from |
|------|------|-----|---------------------|
| **Ink** | Helix Violet | `#3B145B` | “Double Helix Hub” wordmark (dominant) |
| **Primary** | Helix Teal | `#1088A2` | the helix strand |
| **Primary ink** | Teal Ink | `#0C6F85` | teal darkened for AA body text on mist |
| **Highlight** | Node Bronze | `#AC641F` | the helix nodes |
| **Signal** | Bronze Ink | `#8A4E12` | money on light paper (AA) |
| **Canvas** | Mist | `#F3FAFB` | cool teal-tinted off-white |
| **Night** | Night Chart | `#0A1216` | dark instrument / marketing |

### Accessibility
- Body text uses **Helix Violet `#3B145B`** on white / mist (≈ 14:1).
- Teal `#1088A2` is **not** body text on white (≈ 4.2:1). Use **Teal Ink `#0C6F85`** for captions and links.
- Cash figures on light surfaces use **Bronze Ink `#8A4E12`** (≈ 6.6:1). Raw node bronze is a highlight only.
- On night chart, cash uses `#E8A04A`. White text on violet, and violet text on mist, both pass AA.

---

## 2. Gradients

| Token | Definition | Use |
|-------|-----------|-----|
| `--lp-gradient` | `135deg, #1088A2 → #3B145B` | hero wash, eyebrow bar, primary brand motion |
| `--lp-gradient-text` | `135deg, #0C6F85 → #3B145B` | a single clipped phrase |
| `--lp-gradient-signal` | `135deg, #AC641F → #3B145B` | rare money emphasis |

---

## 3. Typography

- **Display & headings — Bricolage Grotesque** (`--font-display` / `--font-heading`)
- **Body & UI — Plus Jakarta Sans** (`--font-body`)
- **CPT, cash, captions — IBM Plex Mono** (`--font-mono`), tabular-nums for money
- **Tagline treatment:** uppercase, tracked, Teal Ink. Always include the period: `Fair for All.`

Scale: 14 / 18 / 22 / 28 / 35 (ratio 1.25 from 14px body).

---

## 4. Logo

| File | Use |
|------|-----|
| `/logo.png` | Full color wordmark on mist / white (print, PDF, light chrome) |
| `/logo-white.png` | White wordmark on night surfaces |
| `/logo-icon.png` | Helix only — instrument chrome, favicon companion |
| `/favicon.svg` | Violet tile, teal strand, bronze nodes |
| `/brand-kit.pdf` | Printable kit with the color wordmark and tagline |

Regenerate the PDF after logo or token changes:

`python apps/cashpay/scripts/build-brand-kit-pdf.py`

Clear space: one helix-node diameter around the mark. Do not recolor the helix or swap bronze for amber.

---

## 5. Components & motifs

- **Rate (signal):** bronze, never decoration. Five hits: rail CPT, slice strip, grouped ledger, mobile card, compare tray.
- **CMS needle:** teal ink, quiet next to cash.
- **Buttons:** primary = Helix Violet fill, white type. Secondary = mist + violet text + teal hairline.
- **Cards / ticks:** mist or `--tick` `#E8F5F7`, 6 / 10 / 16 radius.
- **Print / PDF:** color wordmark top-left, tagline top-right, bronze cash column.

---

## 6. Don'ts

- ❌ Do not keep the old chargemaster amber (`#d97706`) as the rate color.
- ❌ Do not use teal or bronze for body copy on white.
- ❌ Do not drop the period from **Fair for All.**
- ❌ Do not call the figures insurance, a bid, or a guaranteed quote.
- ❌ Do not edit `@crm-eco/ui` tokens — this brand is applied locally in `src/app/globals.css` + `src/lib/brand.ts`.
