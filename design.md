# Reinspect Menu Design System (Cursor-Inspired)

## 1. Visual Theme & Atmosphere

Reinspect menus should feel like a premium debugging instrument: calm, precise, and clearly separate from the host app. The style direction is subtle brand expression (intensity 1-2/5), with visual confidence coming from spacing, typography, and hierarchy instead of loud color blocks.

The menu layer uses brand-tinted neutrals and a single restrained accent family ("Signal Blue") to keep identity stable across every host environment. Runtime component colors still play a core role, but as local semantic accents only. They should never become full-menu background colors or dominate primary navigation chrome.

This creates a dual-personality system:
- Global layer language: stable, professional, predictable.
- Local runtime signals: dynamic, contextual, component-specific.

The result should read as "Reinspect overlay" at first glance, regardless of whether the host app is light, dark, colorful, or monochrome.

**Key characteristics:**
- Subtle brand tinting in all neutral surfaces (light and dark)
- One core brand accent family (Signal Blue) for tabs, focus, primary actions
- Runtime component colors constrained to chips, badges, selected highlights, and small accents
- Strong scan-first hierarchy for dense controls and settings
- Compact but breathable spacing with a 4px base scale
- Distinct dual-theme implementation (light and dark as first-class, not inverted clones)

## 2. Color Palette & Roles

### Core strategy
- Keep global menu UI stable with brand-tinted neutrals.
- Use brand accents for navigation and interaction affordances.
- Map runtime component color into safe derived tokens:
  - `--runtime-soft`: low-contrast fill
  - `--runtime-border`: medium-contrast border
  - `--runtime-strong`: high-contrast text/accent

### Primary tokens (light theme)

| Token | Value | Role |
|------|------|------|
| `--menu-bg` | `oklch(0.975 0.008 248)` | Base menu surface |
| `--menu-surface` | `oklch(0.956 0.010 248)` | Nested surface |
| `--menu-surface-strong` | `oklch(0.925 0.014 248)` | Selected/raised surface |
| `--menu-text` | `oklch(0.255 0.020 248)` | Primary text |
| `--menu-text-muted` | `oklch(0.460 0.018 248)` | Secondary text |
| `--menu-border` | `oklch(0.700 0.015 248 / 0.45)` | Standard border |
| `--menu-border-strong` | `oklch(0.610 0.020 248 / 0.55)` | Active border |

### Primary tokens (dark theme)

| Token | Value | Role |
|------|------|------|
| `--menu-bg` | `oklch(0.205 0.010 248)` | Base menu surface |
| `--menu-surface` | `oklch(0.235 0.012 248)` | Nested surface |
| `--menu-surface-strong` | `oklch(0.275 0.014 248)` | Selected/raised surface |
| `--menu-text` | `oklch(0.945 0.006 248)` | Primary text |
| `--menu-text-muted` | `oklch(0.775 0.010 248)` | Secondary text |
| `--menu-border` | `oklch(0.520 0.014 248 / 0.45)` | Standard border |
| `--menu-border-strong` | `oklch(0.610 0.016 248 / 0.65)` | Active border |

### Brand accents

| Token | Value | Role |
|------|------|------|
| `--brand-400` | `oklch(0.710 0.105 252)` | Hover accent, soft highlights |
| `--brand-500` | `oklch(0.645 0.122 251)` | Primary accent |
| `--brand-600` | `oklch(0.575 0.120 250)` | Active/pressed accent |

### Semantic colors

| Token | Value | Role |
|------|------|------|
| `--semantic-error` | `oklch(0.620 0.165 20)` | Errors, invalid input |
| `--semantic-success` | `oklch(0.670 0.115 158)` | Success/valid states |
| `--semantic-warning` | `oklch(0.760 0.120 78)` | Caution states |

### Runtime color bridge (component name colors)

Given `--runtime-color` (from component hash), derive:

```css
--runtime-soft: color-mix(in oklch, var(--runtime-color) 16%, var(--menu-surface));
--runtime-border: color-mix(in oklch, var(--runtime-color) 42%, var(--menu-border));
--runtime-strong: color-mix(in oklch, var(--runtime-color) 68%, var(--menu-text));
```

Use `--runtime-*` only for:
- Component chips and badges
- Selected labels tied to a component
- Per-component action emphasis

Do not use runtime colors for:
- Full menu backgrounds
- Core tab chrome
- Global primary action buttons

## 3. Typography Rules

### Font family
- **UI / labels / controls**: `Geist Sans`, fallback `system-ui, -apple-system, Segoe UI, sans-serif`
- **Code / inline technical content**: `Geist Mono`, fallback `ui-monospace, SFMono-Regular, Menlo, monospace`

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Usage |
|------|------|------|--------|-------------|----------------|------|
| Menu Title | Geist Sans | 18px | 600 | 1.20 | -0.01em | Component/context menu title |
| Section Title | Geist Sans | 13px | 600 | 1.25 | 0 | Panel headings |
| Primary Label | Geist Sans | 12px | 500 | 1.35 | 0 | Row labels, action titles |
| Body / Description | Geist Sans | 12px | 400 | 1.45 | 0 | Helper text, descriptions |
| Caption | Geist Sans | 11px | 500 | 1.35 | 0.01em | Metadata, status hints |
| Tab / Button Label | Geist Sans | 12px | 600 | 1.10 | 0 | Tabs, segmented controls |
| Inline Code | Geist Mono | 11px | 500 | 1.35 | -0.01em | Component names, tokens |
| Code Input | Geist Mono | 12px | 400 | 1.50 | 0 | Regex, raw props, code-like values |

### Typographic principles
- Prioritize scanability over expressiveness.
- Keep labels compact and predictable.
- Use weight changes sparingly; hierarchy should come from size, spacing, and placement first.
- Keep long helper text at max readable width where possible in larger panels.

## 4. Component Stylings

### Menu containers
- **Context menu shell**: elevated surface with soft gradient-free fill, 1px tinted border, 16px radius.
- **Settings popover**: slightly smaller radius (12px) and same elevation language.
- **Sections**: grouped via spacing and subtle internal surfaces, not heavy separators.

### Tabs and segmented controls
- Background: `--menu-surface`
- Active state: border + fill shift to `--menu-surface-strong` with `--brand-500` accent text/border
- Inactive state: muted text with hover lift

### Action cards and toggles
- Base: neutral surface with subtle border
- Hover: border strengthens, background lifts one tone
- Active: use brand accent ring + optional `--runtime-soft` when action is component-scoped

### Inputs and filters
- Input background stays neutral (stable)
- Focus uses brand ring with clear contrast
- Error states use semantic error token for border/text, with concise inline messaging

### Runtime component indicators
- Chips, "Selected", and component tags should use `--runtime-soft` + `--runtime-border`.
- Component names in code style should use `Geist Mono` with balanced contrast.

### Button system
- **Primary**: brand-filled (`--brand-500`), high-contrast text
- **Secondary**: neutral filled with strong border
- **Ghost**: transparent with hover surface tint
- **Icon button**: 32px square target minimum, consistent radius and focus ring

## 5. Layout Principles

### Spacing scale (4px base)
- `--space-1: 4px`
- `--space-2: 8px`
- `--space-3: 12px`
- `--space-4: 16px`
- `--space-5: 24px`
- `--space-6: 32px`

### Structure
- Header block: title + dismiss affordance
- Navigation block: tabs/segmented panel switch
- Content sections: grouped by task, each with clear heading and local actions
- Footer/action rows only when necessary

### Rhythm rules
- Tight grouping within a control row (4-8px)
- Medium spacing between related rows (8-12px)
- Larger spacing between sections (16-24px)
- Use `gap` for sibling spacing; avoid ad-hoc margin stacks

### Radius scale
- 8px: inputs and compact controls
- 10-12px: cards, grouped interactive rows
- 16px: major context menu shells
- Full pill: chips and status badges

## 6. Depth & Elevation

| Level | Treatment | Use |
|------|-----------|-----|
| Level 0 | Flat + border only | Internal rows, static surfaces |
| Level 1 | Soft shadow + subtle border | Interactive cards, tabs |
| Level 2 | Medium shadow + border ring | Settings popover |
| Level 3 | Strongest menu shadow stack | Primary component context menu |
| Focus | Dedicated focus ring + inner border contrast | Keyboard navigation |

### Shadow philosophy
- Shadows should communicate layering over arbitrary host UIs.
- Keep shadows diffused, not sharp.
- Always pair elevation shadow with a tinted border for edge clarity.

## 7. Interaction & Motion

### Motion rules
- Color/border transitions: 120-160ms `ease-out`
- Transform/elevation transitions: 140-180ms `ease-out`
- Active lift: max `translateY(-1px)` for selected cards/buttons
- Reduced motion: remove transform and pulse, keep state changes via color/contrast

### Hover/focus/active behavior
- Hover should improve affordance, not alter layout.
- Focus-visible must be obvious and theme-consistent.
- Active states should combine at least two signals (color + border, or color + icon/text weight).

### Feedback principles
- Immediate local feedback for toggles and tab switches.
- Error feedback appears adjacent to the problematic field.
- Selection feedback is persistent and scannable.

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Behavior |
|------|-------|----------|
| Compact | `< 480px` | Single-column controls, reduced horizontal padding |
| Default | `480px-900px` | Standard menu layout |
| Wide | `> 900px` | Allow wider panel internals and improved code/value readability |

### Menu responsiveness
- Context menu width: `min(560px, calc(100vw - 24px))`
- Settings width: `min(420px, calc(100vw - 22px))`
- Keep vertical scrolling inside menu containers, with sticky clarity on key headers if needed

### Touch and accessibility
- Minimum actionable target: 32px for icon controls, 36px preferred for primary actions
- Maintain keyboard parity for all actions
- Preserve clear focus ring in both themes with WCAG AA contrast intent

## 9. Agent Prompt Guide

### Quick token reference
- `--menu-bg`: base menu surface
- `--menu-surface`: neutral control surface
- `--menu-text`: primary readable text
- `--menu-border`: default border
- `--brand-500`: primary accent for tabs/actions/focus
- `--runtime-color`: dynamic component color input
- `--runtime-soft / border / strong`: derived runtime-safe accents

### Example implementation prompts
- "Theme all Reinspect menus with stable brand-tinted neutrals and Signal Blue accents. Keep runtime component colors limited to chips, badges, and component-scoped active states."
- "Update menu typography to Geist Sans + Geist Mono with explicit 18/13/12/11 hierarchy and stronger scanability for dense controls."
- "Apply the 4px spacing scale to all menu sections, replacing ad-hoc values with semantic spacing tokens."
- "Implement dual-theme tokens (light/dark) with matching hierarchy and contrast, not simple inversion."
- "Refactor context menu, settings popover, tabs, filter rows, and action cards to use shared theme tokens and consistent interactive states."

### Iteration checklist
1. Menus are clearly Reinspect-owned overlays in both themes.
2. Global UI remains stable even when runtime component colors vary wildly.
3. Scanability improves through hierarchy and spacing, not heavier decoration.
4. Focus-visible and keyboard behavior remain clear and consistent.
5. Active/selected states are obvious without increasing brand intensity above 2/5.

