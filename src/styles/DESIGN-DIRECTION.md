# MediMind Design Direction — "Command" (locked 2026-06-11)

The platform-wide visual identity, chosen from a 20-direction bake-off
(`~/Desktop/medimind-ui-themes/00-compare.html`, theme `command-*.html`).
**This document is the single source of truth for how MediMind looks.**
Style changes happen in exactly two central places:

1. **Tokens** — `packages/app/src/emr/styles/theme.css` (1,500+ `--emr-*` vars)
2. **Wrappers** — `components/common/` + `components/shared/EMRFormFields/`
   + the Mantine theme bridge in `packages/app/src/index.tsx` (`createTheme.components`,
   which centrally styles raw Mantine visuals not yet converted to wrappers)

Page code NEVER hardcodes colors, shadows, radii, or font sizes.

## Identity in one sentence

Navy enterprise: the brand gradient (`#1a365d → #2b6cb0 → #3182ce`) as a
commanding chrome accent, white "decks" floating on soft navy-tinted shadows,
decisive solid-navy interaction states, generous-but-dense data surfaces.

## The rules

### Cards / surfaces ("decks")
- Background `var(--emr-bg-card)`, **border-radius 12px** (`--emr-border-radius-xl`),
  shadow `var(--emr-shadow-card)` (soft, navy-tinted), **no outer border** on
  primary content cards (hairline borders stay INSIDE cards for row separation).
- Hover (interactive cards only): `--emr-shadow-card-hover`.
- KPI/stat cards: 3px **gradient top ribbon** (`--emr-gradient-primary`);
  error/critical variants use an error ribbon.

### Section headers
- Slim header row: title `--emr-font-md`/600 preceded by a **4×15px gradient
  tick bar** (radius 2px, `--emr-gradient-primary`). No full-width tinted band.
- Header separated from body by a hairline of `--emr-bg-hover`-level subtlety.

### Buttons
- Primary: `var(--emr-gradient-primary)` background (UNCHANGED — already the rule),
  shadow `0 3px 10px` primary-alpha.
- Secondary: white deck + hairline border; hover = navy border + navy text.
- Ghost: muted text, navy on hover. Radius 8px (`--emr-border-radius-lg`).

### Badges / status
- Informational ("info") badges: **solid navy** `--emr-primary` with white text.
- Success solid green, error solid red — solid chips, radius 6px, weight 700.
- Soft/tinted badges remain for low-emphasis metadata (neutral gray).

### Tables
- Header row: background `color-mix(primary 5%)`, text `--emr-primary`, 10px
  uppercase 700 letterspaced labels.
- Selected row: primary 6% tint + `inset 3px 0 0 var(--emr-primary)` rail.
- Critical row: error 4% tint + error rail. Row hover `--emr-bg-hover`.

### Forms
- Inputs: `--emr-bg-input` fill, hairline border, radius 8px.
- Focus: navy border + `0 0 0 3px` primary-alpha-14 ring.
- Checked states (checkbox/radio/switch/pagination-active): **solid `--emr-primary`**.
- Labels: 10.5px uppercase 700 letterspaced `--emr-text-secondary`.

### Alerts / notices
- Borderless deck + **4px solid left rail** in the semantic color + card shadow.
- Calm body text; bold first line.

### Navigation chrome
- The brand gradient owns the nav chrome (current 4-row top nav keeps its
  layout — Command is a *style*, the sidebar in the mockup is NOT part of this
  migration). Active nav items: white-on-navy inversion.

### Color discipline (unchanged, re-affirmed)
- Only theme blues `#1a365d / #2b6cb0 / #3182ce / #bee3f8`, red = error,
  green = success. NEVER purple/orange/amber/yellow, never Tailwind blues.
- Dark mode via semantic vars only (`--emr-bg-card` etc.) — never gray-scale
  numbers for surfaces, never dark hexes in component CSS.

### Performance constraints (hospital PCs)
- No `backdrop-filter`, no large animated shadows, no animation beyond
  150–200ms background/color/transform transitions.

## Reference artifacts
- Live mockups: `~/Desktop/medimind-ui-themes/command-{worklist,overview,registration,bedboard,analytics}.html`
- Theme source: `~/Desktop/medimind-ui-themes/_themes3.mjs` (`command` entry)

## Enforcement
- `node scripts/audit/ui-library-sweep.mjs` — orphan report
  (raw Mantine visual imports + hardcoded hex) → `audit-findings/ui-orphans-<date>.md`
- ESLint `no-raw-mantine-visual` (see `eslint-rules/`) keeps new code clean.
