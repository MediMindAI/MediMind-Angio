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

### Composition, hierarchy & severity

(Ported from MediMind's `DESIGN-DIRECTION.md`, 2026-11-12.) The rules above govern how a
*component* looks. These govern how a *screen* reads — a page can satisfy every token rule
above and still be unusable. All five are enforceable: `scripts/ui/composition-metrics.mjs`
measures them mechanically, the `design-critic` agent judges what a measurement can't.
Gold-standard mockups live in `src/styles/reference-screenshots/`.

- **Elevation contrast.** A deck must be visually separable from the surface
  behind it — `--emr-bg-card` differing from `--emr-bg-page` *and* carrying
  `--emr-shadow-card`. Card-background === page-background with no shadow is a
  violation, not a flat-design choice. Applies in dark mode too, where the two
  tokens sit closest together.
- **Status-color reservation (the collision rule).** Severity colors
  (`--emr-success` / `--emr-error` and the info blue) signal *clinical severity
  and nothing else* — in angio: reflux / incompetence, stenosis grade, occlusion.
  A severity color may not also mark a primary action, a list bullet, a count chip,
  or decoration. One color = one meaning per screen. When a screen needs both "this
  is abnormal" and "this is the main action", the action keeps `--emr-gradient-primary`
  and the severity keeps the semantic color — never the reverse. **Red carrying four
  meanings on one screen (an incompetent segment, a validation error, a delete button,
  a "required" badge) is the canonical failure of this rule: when everything is red,
  nothing is.** The anatomy competency palette counts as severity.
- **No duplicate primary data.** A given data element (a NASCET %, a CEAP class,
  an ABI value, a segment's reflux time) may render as a full-weight primary display
  in exactly ONE place per screen. A second reference elsewhere must be visibly
  subordinate — a condensed chip, an inline value, a link — never a verbatim second
  card of equal size and weight. Duplication is not redundancy-for-safety; it costs
  the screen its hierarchy and teaches clinicians to skip regions.
- **Empty states collapse.** An empty-state deck renders at reduced footprint
  (compact padding, no forced min-height matching a populated sibling). A study with
  nothing recorded yet must *look* quieter than one full of findings — equal-size
  empty cards make a normal study look identical to a heavily abnormal one.
- **Density tiers.** Every screen declares which it is:
  - *Triage / scan* (encounter intake, study picker, encounter list) — bounded
    primary data points above the fold, one scannable ordering, severity legible
    at arm's length. Optimize for "what do I do next", not completeness.
  - *Deep dive* (per-study forms: venous LE, arterial LE, carotid, iliac-pelvic
    venous; the report preview) — may go dense, but still needs ONE focal element
    that wins on weight (usually the anatomy diagram or the segment table), with
    everything else deliberately receding. Boldness is spent once per screen,
    never distributed evenly across every card.
