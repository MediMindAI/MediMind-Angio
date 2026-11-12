# UIX3 — UI-X lane round 3 (MODE: RESTYLE)

Run `angio-module-2026-11-12`. Visual treatment only. Behaviour, translations, FHIR/PDF output and permissions are unchanged. **No new i18n keys.** Built on the uncommitted work in the tree; nothing was reverted. The orchestrator's `.assessmentLayout` grid line in `ArterialLEForm.module.css` is kept.

## Fixes

| # | Fix | Status | Files |
|---|---|---|---|
| 1 | Action bar at 375px fits on one row | DONE | `form/FormActions.tsx`, `form/FormActions.module.css` |
| 2a | Dark tick bars use the brand gradient | DONE (token) | `styles/theme.css` (dark block) |
| 2b | No outer deck border in dark | DONE (wrappers) | `common/EMRContentSection.tsx`, `common/EMRCollapsibleSection.tsx` |
| 2c | Dark selected tab/segment = solid primary + white text | BLOCKED by fence (see below) | — |
| 3 | Arterial phone side switch uses R/L chips, selected = solid `--emr-primary` | DONE | `arterial-le/ArterialLEForm.tsx` + `.module.css` |
| 4 | ABI/TBI tiles stack below 480px | DONE | `arterial-le/SegmentalPressureTable.module.css` |
| 5 | Carotid R/L chips are neutral soft chips | DONE | `carotid/CarotidSegmentTable.module.css` |

### 1. Action bar at 375px
- At ≤576px, save draft, preview and print become 44×44 icon-only secondary buttons. CSS hides the label span. Each button keeps the same Georgian text as `aria-label` (existing keys `venousLE.actions.saveDraft` / `previewPDF` / `printPDF`), plus an `EMRTooltip` that is active only on phones.
- Download PDF keeps its full label as the single gradient primary. On phones its padding is 12px and its font is `--emr-font-sm`.
- The bar's side padding is 8px and the gap is 6px. The bar sits inside a 24px page gutter, so it only has about 311px.
- Desktop is unchanged: widths 198/136/118/189 match the baseline.
- Live result: the four buttons share one row and scrollWidth = 375 on venous, arterial, carotid and iliac. Bar height went from 284px to 150–168px. The remaining height is the save-status line plus the existing export note, which is behaviour and was kept.

### 2. Dark mode
- **Tick bars.** Dark `--emr-gradient-primary` was a grey slate gradient. It is now the brand gradient, the same value dark `--emr-gradient-add-button` (the primary button) already used. This one token fixes every tick bar, including those in the form-module CSS.
- **Side effect.** Anything else painted with `--emr-gradient-primary` in dark is now navy too: EMRViewToggle active segments, the EMRCheckbox checked fill, and other gradient chrome. AppShell is not mounted. Light mode is unchanged.
- **Deck border.** The cause is the global rule in `theme.css` that sets `.mantine-Paper-root { border-color: var(--emr-border-color) !important }` in dark, which repaints the wrapper's transparent border. In dark, EMRContentSection (non-outlined) now sets `border-style: none`. EMRCollapsibleSection, used for CEAP/SVP/NASCET as top-level decks, swaps its hairline for `--emr-shadow-card` in dark only. Live check: `emr-content-section` border-style is `none`.

### 2c. BLOCKED: selected item text in dark (outside the fence)
- **Cause.** In dark, `--emr-text-inverse` is `#0f172a`, which is near-black. I can't flip that token, because `EMRTooltip` uses it as dark text on its light dark-mode bubble (`--emr-text-primary` background), and EMRTooltip is used in five study components.
- **Lines needed** (all outside the fence):
  - `common/EMRTabs.module.css` `.tab--pills.tab--active`: change `color` to `var(--emr-text-white)`. This is the venous/carotid side tabs, which are already solid `--emr-primary`.
  - `common/EMRViewToggle.tsx` active segment: `background: 'var(--emr-primary)'`, `color: 'var(--emr-text-white)'`. This covers the drawing toolbar and the carotid/arterial view toggles.
  - `layout/EncounterContextBanner.module.css` `.chipActive`: `background: var(--emr-primary)`, `color: var(--emr-text-white)`. Today this is slate with dark text.
- **Contrast caveat.** In dark, `--emr-primary` is `#3182ce`. White text on it measures about 3.97:1, below AA (4.5:1) for 12–13px labels. The current dark text measures about 5.3:1. If white text is required, `--emr-secondary` (`#2b6cb0`, about 5.6:1 with white) is the AA-safe solid background. A person should pick.

### 3. Arterial phone side switch
- EMRViewToggle is replaced here only by two `UnstyledButton`s (a layout primitive) with `aria-pressed`.
- Each shows the same R / L chip as the segment cards, sized up. The full side name (`arterialLE.tabs.right/left`, existing keys) is the `aria-label`.
- The selected option is solid `--emr-primary`, and its chip turns into a white-alpha chip.
- Test IDs are unchanged (`arterial-phone-side-toggle[-right|-left]`). The existing switch test passes.

### 4. ABI tiles
At ≤480px, `.badgeRow { flex-basis: 100% }`. Live check at 375: each tile is 303px wide and "საშუალო პად" ends 11px inside its tile. Not clipped in light or dark.

### 5. Carotid laterality chips
Both sides use `--emr-bg-hover` background, `--emr-text-secondary` text and an inset hairline `--emr-border-color`. These are semantic tokens, so the chips are neutral grey in light and dark.

## Gates
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors. The 14 warnings are pre-existing.
- Vitest, 7 files (FormActions, EMRContentSection, EMRCollapsibleSection, ArterialLEForm, SegmentalPressureTable, CarotidForm, theme.test): 36 pass, 2 fail.
  - Both failures are the same pre-existing assertion in ArterialLEForm/CarotidForm, "renders the EncounterContextBanner with encounter identity". It expects `2026-04-25` but gets `25.04.2026 · 36 y`.
  - The cause is uncommitted work in `EncounterContextBanner.tsx`, which is outside this lane and not touched here.
- Self-audit: no `@mantine/dates`, forbidden blues, purple/orange/yellow, `backdrop-filter`, hardcoded hex, or dark overrides in the touched CSS modules. The only hex added is the brand gradient inside `theme.css`. `npm run ui:orphans` lists none of the touched files.

## Evidence (`screens-after2/`)
- Before: `uix3-before-arterial-375-bar.png`, `uix3-before-venous-dark.png`
- 375 bar, light, Georgian: `uix3-375-bar-{venousLEBilateral,arterialLE,carotid,iliacPelvicVenous}.png`
- Arterial 375 switch and ABI: `uix3-arterial-375-switch-{light,dark}.png`, `uix3-arterial-375-abi-{light,dark}.png`
- Dark 1440 (gradient ticks, borderless decks, neutral chips): `uix3-dark-venous-1440.png`, `uix3-dark-carotid-1440.png`
- Light carotid 1440 (desktop bar unchanged, neutral chips): `uix3-light-carotid-1440.png`

Browser: context `uix3` only, closed at the end. Test encounter `16e63047-…` was created through the intake page in that context.
