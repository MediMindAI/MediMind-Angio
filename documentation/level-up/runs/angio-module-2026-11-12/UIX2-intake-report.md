# UIX2 — intake `/` (ui-excellence Fix, MODE: RESTYLE, round 2)

## Touched files (fence respected)
- `src/components/layout/EncounterIntake.tsx`
- `src/components/layout/EncounterIntake.module.css`
- `EncounterIntake.test.tsx`: not modified (all assertions still hold)

Layout and structure are preserved: the study picker isn't moved, the summary deck stays, and no fields are folded into a disclosure. The round-1 work (resume button, discard naming, scroll-into-view, DD.MM.YYYY date) is intact.

## Fixes
1. **status-color-reservation**
   - Required asterisk is now `--emr-text-secondary`.
   - Visit-date clear × is now a muted ghost icon (`--emr-text-secondary`, transparent background, `--emr-bg-hover` + `--emr-primary` on hover). It looks the same in both themes.
   - Deleted the red box under the study grid (`studyHelperWarn`), which repeated "აირჩიეთ მინიმუმ ერთი კვლევა".
   - Deleted the red not-ready summary chip. Each blocker now shows once, in the existing neutral hint beside the disabled CTA. The summary only renders the ready pill.
2. **section-headers**
   - All four section decks and the summary use a slim header: a 4×15 gradient tick, a `--emr-font-md`/600 title, and an `--emr-border-light` hairline.
   - Removed the tinted band, the left rail, the header icon tiles, and the "ნაბიჯი N" eyebrows. The summary's "Live preview" eyebrow and gradient slab are gone too.
   - The step-done tick is now a solid `--emr-primary` disc instead of success green.
3. **cards-surfaces**
   - Every deck is borderless at `--emr-border-radius-xl` with `--emr-shadow-card`.
   - Removed the non-interactive hover shadow.
   - Metrics show shadows on 5/5 decks at 1440, 768, 375 and dark (was 1/5).
4. **dark mode**
   - Stepper: pending is outlined, current is outlined with a white edge and ring, completed is solid `--emr-primary` with a white ✓. Same in both themes.
   - The active theme-toggle glyph is pinned to `--emr-primary`, so it's visible on the white pill.
   - The hero uses `--emr-gradient-add-button`. In light this resolves to `--emr-gradient-primary`; in dark it keeps the navy brand gradient (`--emr-gradient-primary` itself turns slate in dark). The header tick uses the same token so it stays visible in dark.
   - Study-card icon tiles are now `--emr-bg-hover` with `--emr-text-secondary` glyphs. Blue appears only when a card is checked (solid `--emr-primary` tile and check circle instead of success green).
   - The summary patient tile is now neutral `--emr-bg-hover`. It was the last decorative blue mark behind the dark collision.

**Why there are scoped `!important` overrides.** The red asterisk and red × come from wrapper styles: `EMRFieldWrapper` and the canonical `EMRDatePicker`'s inline-styled clear button. The global dark-mode rule in `theme.css` also forces every `svg.tabler-icon` to white with `!important`. All three are outside the fence, so the intake CSS module overrides them in scoped rules (`:global(.tabler-icon)`, `[data-testid$='-clear']`). Follow-up: fix the date-picker clear × and the required colour centrally in the wrappers and tokens, then delete these overrides.

## Tests
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors (14 pre-existing warnings, none in touched files).
- `npx vitest run src/components/layout/EncounterIntake.test.tsx`: 9/9 passed. The first run had 1 failure that passed on two reruns; that matches the documented heavy-form-tree flake.
- Self-audit: no forbidden blues, no purple/orange/amber/yellow/warning tokens, no `backdrop-filter`, no dark-mode selectors, no hex. Hardcoded `rgba()` went from 16 to 9; all 9 remaining are pre-existing hero literals.

## hardFails: before (metrics-after) → after (metrics-after2)
| variant | before | after |
|---|---|---|
| default (1440 light) | empty-state-parity 1.18, density-tier-overflow 16 | empty-state-parity 1.00, density-tier-overflow 16 |
| 768 light | empty-state-parity 1.18, density-tier-overflow 16 | empty-state-parity 1.00, density-tier-overflow 17 |
| 375 light | empty-state-parity 1.25 | **none** |
| dark 1440 | status-color-collision (4 contexts / 10 marks), empty-state-parity 1.18, density-tier-overflow 16 | empty-state-parity 1.00, density-tier-overflow 16 (**collision cleared**: the only remaining blue is the hero and the CTA, in 2 contexts) |

The remaining hard fails belong to the queued DESIGN-DECISIONs (collapsing the empty summary deck and folding the optional fields into a disclosure), which are out of scope for RESTYLE. At 768 the action count went from 16 to 17 because the page got shorter (red box removed), so one more existing control now sits above the fold.

## Proof (Georgian, context `uix-intake`, closed at end)
- Screens: `screens-after2/intake-default.png`, `intake-768.png`, `intake-375.png`, `intake-dark.png`. These are full-page captures, so the fixed action bar appears mid-page; that's a capture artifact.
- Metrics: `metrics-after2/intake-{default,768,375,dark}.json`.
- Also checked the selected state live in dark: carotid checked, solid primary check and tile, white glyph, ready pill shown, blocker hint gone.

## Noted, not fixed (outside the finding list)
- Below 576px the hero controls' bottom edge (64px) overlaps the hero eyebrow badge's top edge (58px) by 6px. The cause is hero padding and control sizing that this pass didn't change.
- `ThemeToggle.module.css` still uses `backdrop-filter`. The file is outside the fence.
- The ready pill still uses success green with an infinite pulse (perf rule: animations ≤200ms). It's outside the finding list.
