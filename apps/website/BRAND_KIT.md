# Pay It Forward Health — Brand Kit

Pay It Forward Health (PIFH) is a community health‑sharing organization and a **tenant brand on the DoubleHelixHub platform**. This kit is the single source of truth for the marketing site at **payitforwardhealth.com**. Every color below is derived from the official logo (`/public/logo.png`).

> Voice: warm, plain‑spoken, trustworthy. We are a community, not an insurer. Generosity ("pay it forward") is the throughline.

---

## 1. Color palette (extracted from the logo)

The logo is built from four colors with a natural teal→green gradient in the mark.

| Role | Name | Hex | Where it comes from |
|------|------|-----|---------------------|
| **Primary** | Deep Navy | `#003A5C` | "Pay it Forward" wordmark (dominant ~53% of the mark) |
| **Secondary** | Teal | `#0E8C9A` | the spiral ring |
| **Accent** | Emerald Green | `#12A065` | "Health" wordmark + the leaves/people |
| **Highlight** | Generosity Gold | `#F4B400` | the seed / sun dot at the spiral's center |
| **Ink** | Navy‑Ink | `#0A2233` | body text (navy‑tinted near‑black) |
| **Canvas** | Mist | `#F2F8F9` | cool, teal‑tinted off‑white sections |

### Tints & shades (Tailwind scales — `pif-navy`, `pif-teal`, `pif-green`, `pif-gold`)

```
navy   50 #ECF3F8 · 100 #D5E5EF · 200 #ADCBDE · 300 #6E9EBE · 400 #356E92
       500 #0E5277 · 600 #003A5C · 700 #002F4B · 800 #06283D · 900 #04202F
teal   50 #E6F6F7 · 100 #C2EAED · 200 #8FD7DC · 300 #54BFC7 · 400 #1FA4AE
       500 #0E8C9A · 600 #0B7480 · 700 #0B5D66 · 800 #0C4A52 · 900 #0A3B42
green  50 #E7F7EE · 100 #C5EBD5 · 200 #93D9B1 · 300 #57C389 · 400 #25AC68
       500 #12A065 · 600 #0B8453 · 700 #0A6A44 · 800 #0A5538 · 900 #08442E
gold   50 #FEF7E6 · 100 #FCEBBE · 200 #F9D982 · 300 #F6C748 · 400 #F4B400
       500 #D89E00 · 600 #B07F00 · 700 #8A6300 · 800 #6B4D00 · 900 #4F3900
```

### Accessibility
- Body text uses **Navy‑Ink `#0A2233`** on white (≈ 15:1).
- Interactive text (`text-primary`) is **Teal‑700 `#0B5D66`** on white (≈ 5.7:1 — passes AA for normal text). Never use Teal‑500 for small text on white.
- White text on Navy/Teal/Green 600+ all pass AA. Gold is a **highlight only** — never gold text on white at body size.

---

## 2. Gradients (use them generously, but with intent)

The logo's spiral runs teal→green; our gradients echo that journey.

| Token | Definition | Use |
|-------|-----------|-----|
| `--pif-grad-brand` | `135deg, #003A5C → #0E8C9A 52% → #12A065` | hero washes, the "full journey" — navy→teal→green |
| `--pif-grad-care` | `135deg, #0E8C9A → #12A065` | primary buttons, icon chips, vivid accents |
| `--pif-grad-deep` | `160deg, #04202F → #003A5C 55% → #0B5D66` | dark sections / popular plan card |
| `--pif-grad-gold` | `135deg, #F4B400 → #F59E0B` | "pay it forward" / giving motifs, ribbons |

Helper classes: `.pif-grad-brand`, `.pif-grad-care`, `.pif-grad-deep`, `.pif-grad-gold` (backgrounds) and `.gradient-text` (clipped brand gradient on headings — use sparingly, one phrase at a time).

---

## 3. Typography

A **serif display + humanist sans** pairing — deliberately *not* the default Inter/Geist look of generic Next.js sites. It reads established, human, trustworthy.

- **Display & headings — Fraunces** (`--font-heading`): warm "old‑style" serif. Weights 400–600. Used for h1–h6.
- **Body & UI — Inter** (`--font-body`): clean, legible. 400/500/600.
- **Eyebrows / labels:** Inter, uppercase, `letter-spacing: 0.2em`, teal or gold.

Scale: display `clamp(40px, 5.5vw, 68px)`, h2 `clamp(28px, 3.5vw, 44px)`, body `1.0625rem`, large body `1.125rem`.

---

## 4. Imagery
- Real people: families, clinicians, community moments. Warm, natural light. Avoid sterile stock or obvious AI imagery.
- Always pair photos with a soft navy gradient scrim at the base for text legibility and brand cohesion.
- Rounded corners (`rounded-2xl`/`rounded-3xl`), generous shadow, thin ring (`ring-1 ring-pif-navy/10`).
- Centralized, reviewed set in `src/lib/site-images.ts`.

## 5. Components & motifs
- **Buttons:** primary = `.pif-grad-care` (teal→green) pill, lift on hover. Secondary = white with navy text + navy/15 border.
- **Cards:** white, `rounded-2xl`, `ring-1 ring-pif-navy/10`, soft shadow; popular = `.pif-grad-deep` with white text + gold "Most Popular" ribbon.
- **Icon chips:** rounded square, teal‑50 bg, teal‑600 icon (or `.pif-grad-care` for emphasis).
- **Trust:** stats strips, BBB/"Not insurance" disclosure, real testimonials, member counts — always visible, measured tone.
- **Gold** is the spark: underlines on a key word, the "pay it forward" heart/hands motif, star ratings, the seed dot. Never the dominant surface.

## 6. Don'ts
- ❌ No cyan/violet SaaS gradients (the old DoubleHelixHub template palette).
- ❌ Don't call PIFH "insurance."
- ❌ Don't edit `@crm-eco/ui` tokens — this brand is applied **locally** in `globals.css` + `tailwind.config.ts` so it never leaks into the CRM/admin/portal apps.
