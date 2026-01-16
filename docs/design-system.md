# Pay It Forward HealthShare — Design System (v1)

## Brand Principles

- **Trust first**: calm, readable, restrained.
- **Momentum**: subtle gradients and gentle motion.
- **Community**: friendly shapes, rounded radii, supportive microcopy.

## Color Palette (Brand)

### Core

| Name | HEX | Usage |
|------|-----|-------|
| Navy (Authority) | `#003560` | Headings, authority elements |
| Teal (Primary Action - accessible) | `#047474` | Buttons, links (WCAG AA on white) |
| Teal (Support) | `#069B9A` | Fills, gradients, chips |
| Emerald (Success/Growth) | `#027343` | Success states, growth indicators |
| Gold (Highlight) | `#E9B61F` | Featured badges, milestones (never as text on white) |

### Neutrals

| Name | HEX | Usage |
|------|-----|-------|
| Ink | `#0B1220` | Deep text, dark mode background |
| Background | `#F8FAFC` | App background (light mode) |
| Surface | `#FFFFFF` | Cards, modals |
| Border | `#E2E8F0` | Borders, dividers |
| Muted text | `#475569` | Secondary text, captions |

## Usage Rules

- **Headings**: Navy or Ink
- **Primary buttons + links**: Teal (accessible) with white text
- **Success states**: Emerald
- **Gold**: only for highlights (badges, featured, milestones). Use Ink text on gold backgrounds.
- **Never** use gold as text on white backgrounds (low contrast, fails accessibility).

## Typography

### Font Families

- **Headings**: Plus Jakarta Sans (600–700 weight)
- **Body**: Inter (400–600 weight)
- **Numerals/metrics** (optional): Inter (600) for consistency

### Sizing Scale

| Element | Size (px) | Line Height (px) |
|---------|-----------|------------------|
| H1 | 40 | 48 |
| H2 | 32 | 40 |
| H3 | 24 | 32 |
| Body | 16 | 24 |
| Small | 14 | 20 |

## Layout & Spacing

- **Base spacing unit**: 4px
- **Container max width**: 1200–1280px
- **Section padding**: 24–40px vertical (responsive)

## Radii

| Element | Radius |
|---------|--------|
| Cards | 16px |
| Buttons/Inputs | 12px |
| Pills/Badges | 999px (fully rounded) |

## Elevation (Shadows)

| Level | CSS Box Shadow |
|-------|----------------|
| Card | `0 1px 2px rgba(2,6,23,0.06), 0 8px 24px rgba(2,6,23,0.08)` |
| Popover | `0 12px 36px rgba(2,6,23,0.16)` |

## Gradients

### Primary Gradient (Navy → Teal)

```css
linear-gradient(135deg, #003560 0%, #069B9A 100%)
```

### Accent Gradient (Teal → Emerald)

```css
linear-gradient(135deg, #069B9A 0%, #027343 100%)
```

## Component Defaults

### Buttons

| Variant | Background | Text | Hover |
|---------|------------|------|-------|
| Primary | Teal `#047474` | White | Slightly darker (`#046363`) |
| Secondary | White | Navy | `slate-50` background |
| Tertiary | Transparent | Teal | Light teal background |

### Cards

- White surface
- Subtle border (`#E2E8F0`)
- Soft shadow (card elevation)
- Optional gradient header stripe

### Inputs

- White background
- Border `#E2E8F0`
- Focus ring: Teal (300–400)
- Error ring: Red

## Motion

- **Transition duration**: 150–220ms
- **Easing**: ease-out
- **Micro-interactions**: hover lift (1–2px), soft shadow increase

## Quick UI Defaults (Tailwind Classes)

```
Primary CTA buttons:   bg-brand-teal-700 text-white hover:bg-brand-teal-800
Links:                 text-brand-teal-700 hover:text-brand-teal-800 underline-offset-4
Headings:              text-brand-navy-500
Success badges:        bg-brand-emerald-50 text-brand-emerald-700
Featured/highlight:    bg-brand-gold-100 text-slate-900
```

## Brand Color Scales

### Navy

| Step | HEX |
|------|-----|
| 50 | `#e0e7ec` |
| 100 | `#bfccd7` |
| 200 | `#99aebf` |
| 300 | `#6686a0` |
| 400 | `#335d80` |
| 500 | `#003560` |
| 600 | `#002f54` |
| 700 | `#002848` |
| 800 | `#00213c` |
| 900 | `#00192e` |

### Teal

| Step | HEX |
|------|-----|
| 50 | `#e1f3f3` |
| 100 | `#c1e6e6` |
| 200 | `#9bd7d7` |
| 300 | `#6ac3c2` |
| 400 | `#38afae` |
| 500 | `#069b9a` |
| 600 | `#058888` |
| 700 | `#047474` |
| 800 | `#04605f` |
| 900 | `#034a4a` |

### Emerald

| Step | HEX |
|------|-----|
| 50 | `#e0f1ea` |
| 100 | `#c0e3d6` |
| 200 | `#99d2be` |
| 300 | `#66ba9f` |
| 400 | `#358f69` |
| 500 | `#027343` |
| 600 | `#02653b` |
| 700 | `#025632` |
| 800 | `#01472a` |
| 900 | `#013720` |

### Gold

| Step | HEX |
|------|-----|
| 50 | `#fcf6e4` |
| 100 | `#faedc7` |
| 200 | `#f6e2a5` |
| 300 | `#f2d379` |
| 400 | `#edc54c` |
| 500 | `#e9b61f` |
| 600 | `#cda01b` |
| 700 | `#af8817` |
| 800 | `#907113` |
| 900 | `#70570f` |
