# MPB Health Color Reference Guide

Quick reference for developers working with the MPB Health color palette in Tailwind CSS.

## Primary Blue (Brand Color)

Use for: Main CTAs, links, brand elements, primary UI elements

```tsx
// Buttons
<button className="bg-primary-800 hover:bg-primary-700 text-white">
  Primary Button
</button>

// Links
<a className="text-primary-800 dark:text-primary-500 hover:text-primary-900">
  Link Text
</a>

// Backgrounds (light)
<div className="bg-primary-50">Light background</div>
<div className="bg-primary-100">Slightly darker background</div>

// Status badges (info/new)
<span className="bg-primary-100 text-primary-900 dark:bg-primary-950 dark:text-primary-200">
  New
</span>

// Gradients
<div className="bg-gradient-to-r from-primary-700 to-primary-800">
  Gradient background
</div>
```

## Neutral Gray (Text & Backgrounds)

Use for: Body text, cards, borders, secondary elements

```tsx
// Text hierarchy
<h1 className="text-neutral-900 dark:text-white">Main heading</h1>
<p className="text-neutral-700 dark:text-neutral-300">Body text</p>
<span className="text-neutral-600 dark:text-neutral-400">Muted text</span>
<small className="text-neutral-500">Secondary text</small>

// Backgrounds
<div className="bg-neutral-50 dark:bg-neutral-800">Card background</div>
<div className="bg-neutral-100 dark:bg-neutral-700">Hover background</div>

// Borders
<div className="border border-neutral-200 dark:border-neutral-700">
  Bordered element
</div>

// Dividers
<hr className="border-neutral-300 dark:border-neutral-600" />
```

## Accent Red (Errors & Alerts)

Use for: Error messages, destructive actions, urgent alerts

```tsx
// Error messages
<p className="text-accent-600 dark:text-accent-400">Error message</p>

// Destructive buttons
<button className="bg-accent-600 hover:bg-accent-700 text-white">
  Delete
</button>

// Alert backgrounds
<div className="bg-accent-50 border border-accent-200 dark:bg-accent-900/20">
  Alert content
</div>

// Status badges
<span className="bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-200">
  Urgent
</span>
```

## Success Green (Confirmations)

Use for: Success messages, completion states, positive actions

```tsx
// Success messages
<p className="text-success-600 dark:text-success-400">Success!</p>

// Success buttons
<button className="bg-success-600 hover:bg-success-700 text-white">
  Confirm
</button>

// Success backgrounds
<div className="bg-success-50 border border-success-200 dark:bg-success-900/20">
  Success content
</div>

// Status badges
<span className="bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200">
  Completed
</span>
```

## Common Patterns

### Cards
```tsx
<div className="glass-card p-6 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg">
  Card content
</div>
```

### Forms
```tsx
<input 
  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:border-primary-800 focus:ring-2 focus:ring-primary-800/40"
/>
```

### Navigation (Active State)
```tsx
<Link 
  className={isActive 
    ? 'neon-button' 
    : 'text-neutral-700 dark:text-neutral-300 hover:bg-white/10'
  }
>
  Nav Item
</Link>
```

### Stat Cards with Gradient
```tsx
<div className="stat-card bg-gradient-to-br from-primary-500 to-primary-700 text-white p-6 rounded-xl">
  <div className="text-sm text-primary-200 mb-1">Label</div>
  <div className="text-3xl font-bold">Value</div>
</div>
```

### Hero Sections
```tsx
<div className="gradient-bg min-h-screen">
  <!-- Uses championship-theme.css gradient -->
</div>

<!-- Or specific hero variants: -->
<div className="hero-service">Service page hero</div>
<div className="hero-work">Work/Task page hero</div>
<div className="hero-analytics">Analytics page hero</div>
```

## Dark Mode Tips

1. Always test in both light and dark modes
2. Use `dark:` prefix for dark mode overrides
3. Primary colors automatically adjust (primary-800 → primary-500 in dark)
4. Backgrounds invert (neutral-50 → neutral-800)
5. Text adjusts for contrast (neutral-900 → white)

## Color Scale Quick Reference

| Use Case | Light Mode | Dark Mode |
|----------|------------|-----------|
| Primary CTA | `primary-800` | `primary-700` |
| Secondary CTA | `primary-600` | `primary-500` |
| Link | `primary-800` | `primary-500` |
| Link Hover | `primary-900` | `primary-300` |
| Body Text | `neutral-700` | `neutral-300` |
| Muted Text | `neutral-600` | `neutral-400` |
| Card BG | `white` or `neutral-50` | `neutral-800` |
| Border | `neutral-200` | `neutral-700` |
| Error Text | `accent-600` | `accent-400` |
| Success Text | `success-600` | `success-400` |

## Gradients

```tsx
// Primary gradient (most common)
className="bg-gradient-to-r from-primary-700 to-primary-800"

// With hover
className="bg-gradient-to-r from-primary-700 to-primary-800 hover:from-primary-800 hover:to-primary-900"

// Subtle background
className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-900/10"

// Multi-color (dashboards)
className="bg-gradient-to-r from-primary-800 to-success-600"
```

## Shadows

```tsx
// Standard shadow
className="shadow-lg"

// Colored shadow (primary blue glow)
className="shadow-lg shadow-primary-800/30 hover:shadow-xl hover:shadow-primary-900/40"

// Glass effect shadow
className="shadow-[var(--shadow-glow)]"
```

## Status Color Mapping

- **New/Open**: Primary blue
- **In Progress**: Yellow/Orange
- **Pending**: Yellow
- **Resolved/Success**: Green
- **Closed/Done**: Neutral gray
- **Error/Failed**: Accent red
- **Warning**: Orange
- **Info**: Primary blue

---

**Last Updated**: After MPB Health color palette migration
**Maintainer**: Development Team
