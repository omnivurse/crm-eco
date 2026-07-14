# Design Memory — Double Helix Hub

Durable style rules for the suite (CRM · Admin · Member Portal). Source of truth for tokens is `packages/ui/src/styles/theme.css` + `packages/ui/tailwind.preset.ts`; this file records the *decisions and conventions* on top of them.

## Brand tone
- **Adjectives:** premium, trustworthy, clean, healthcare-appropriate.
- **Density:** comfortable (balanced spacing, easy scanning) — not cramped, not airy.
- **Avoid:** clutter, competing accents, ad-hoc shadows/radii, "SHARING ENTITY" labels on insurance data.

## Color
- **Brand / interactive:** cyan `#06b6d4` (`--primary`). Use for links, primary buttons, focus rings, selection — sparingly.
- **Coverage accent:** emerald `#10b981` — reserved for coverage/membership surfaces (the snapshot, plan cards). Semantic, not decorative.
- **Admin accent:** violet `#6d47d9` for admin-only chrome differentiation.
- **Semantic (separate from accent):** success=emerald, pending/warning=amber `#f59e0b`, critical=rose `#be123c`.
- **Neutrals:** cool slate, biased slightly toward cyan (chosen, not default grey). Ground `#f5f8fb` / dark `#060b16`; ink `#0b1220` / `#eaf0f8`.
- **Both themes are first-class.** Style through tokens; give dark the same care (don't invert).

## Layout & spacing
- **Radius:** buttons/inputs 8px (`--radius`); cards 12px (`--radius-card`); heroes 16px.
- **Elevation:** two-layer soft shadow (`--shadow-sm/md/lg`); avoid heavy single-drop shadows.
- **Borders:** hairline (`--border` / `--line`); use a header strip + divider for card hierarchy rather than boxing everything.
- **Grid + gap** for sibling groups; wide content scrolls inside its own `overflow-x:auto`.

## Typography
- **Headings:** Plus Jakarta Sans, 700–800, tight tracking (`-0.02em`) on large sizes; `text-wrap: balance`.
- **Body:** Inter, ~13–15px.
- **Labels:** ~10.5px, 700, uppercase, `tracking` ~0.1em, muted/faint color.
- **Data (money, IDs, metrics):** monospace + `font-variant-numeric: tabular-nums`.

## Interaction patterns
- **Confirms/prompts:** branded dialogs only — `confirmDialog()` / `promptDialog()` from `@crm-eco/ui`. Never native `window.confirm`/`prompt`.
- **Feedback:** `sonner` toasts for async results; inline errors that say what's wrong and how to fix it.
- **Inline editing:** click-to-edit field cells (record detail); preserve when restyling containers.
- **Linking:** multi-select, additive (never overwrites); one relationship per batch.
- **Status:** encode in *form* (pill/chip/dot) as well as text, so state reads at a glance.

## Accessibility rules
- Focus: visible `:focus-visible` 2px ring + offset (defined in theme.css).
- Semantic HTML; icons decorative next to real text labels.
- Contrast AA in both themes; touch targets ≥ 44px.
- Respect `prefers-reduced-motion`.

## Repo conventions
- **Styling:** Tailwind + shadcn HSL tokens; shared primitives in `packages/ui/src/components` imported via `@crm-eco/ui/components/*`.
- **Existing primitives:** `Button` (variants incl. `destructive`), `Input`, `AlertDialog`, `Dialog`, `ConfirmDialogHost`/`confirmDialog`, `PromptDialogHost`/`promptDialog`, `StatusBadge`/`statusToTone`.
- **Status colours = one shared tone system** in `@crm-eco/ui` (`StatusBadge` + `statusToTone`, `--tone-*` tokens in `theme.css`). CRM, Admin, and Portal all route status / stage / priority pills through it — one hue = one meaning, everywhere. The CRM `@/components/ui/status-badge` now re-exports it.

---
*Established via the Design Lab exploration. Update as directions land.*
