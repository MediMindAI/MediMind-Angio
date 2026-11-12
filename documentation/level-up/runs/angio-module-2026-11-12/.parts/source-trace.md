# ux-source-tracer — angio-module-2026-11-12

Inputs: `qa-reports/ux/runs/angio-module-2026-11-12-{sono,phys}/scoreboard.json`, `findings.jsonl` (U-1000…U-1037),
`critic/*.json`, `M-real-report.md`. No knowledge graph exists in this repo (`scripts/gq.sh` and `graphify-out/` are both
absent), so the tracing used targeted greps. Live checks ran in a private Playwright context (`ux-tracer`, now closed)
against :3001. They created 2 throwaway encounters in that context's storage only. No source was touched.

Scope: 21 open ledger rows + 6 cross-screen critic patterns (X-*) = **27 findings**. Walk task ids are mapped to
their ledger rows. U-1000 and U-1025 are fixed and were not traced.

---

## X-BTN (+ U-1031 colour) — 7–12 "equal primary" solid-navy buttons on every study screen; destructive confirm the same blue as Cancel

**Runtime evidence:** critic, all 4 study screens × 4 variants: "about 8–12 solid navy primary-weight buttons" (e.g.
`critic/venous-le.json` default-1440, P1). U-1031: "Delete same blue as Cancel".

**(a) Already exists?** CONFIRMED — **yes, fully built and hidden.** Most of these buttons already ask for a quiet
variant: `BackToStudiesButton.tsx:43` `secondary`, `TemplatePicker.tsx:47` `secondary`, bulk actions
`SegmentAssessmentCard.tsx` `ghost`, `FormActions.tsx:506` `subtle` / `:542` `secondary`, `ConfirmDialog.tsx:85`
`ghost` / `:89` `danger`. `VenousLEForm.tsx:1301` already passes `destructive`. The variant styles exist in
`EMRButton.module.css` (`.secondaryButton` :31, `.ghostButton` :89, `.dangerButton`). They lose the CSS cascade, so
they never show.
**(b) Cause:** CONFIRMED — `src/main.tsx:4` vs `:7-8`
```ts
import App from './App';                       // :4  evaluates every component CSS module first
// Mantine first so theme.css overrides on equal specificity (Wave 4.4).
import '@mantine/core/styles.css';             // :8  injected AFTER the modules
```
Live DOM: `style[data-vite-dev-id]` index of `EMRButton.module.css` = 1, `@mantine/core/styles.css` = 74. Rules matching
the bulk "Clear" ghost button: `._ghostButton_18lm0_89 => transparent` (sheet 1), then
`.m_77c9d27d => var(--button-bg, var(--mantine-primary-color-filled))` (sheet 74), which wins on equal specificity. Every
`secondaryButton` / `ghostButton` / `dangerButton` on the venous page computes to `rgb(43,108,176)`. Even
`+ კვლევის დამატება` (`primaryButton`) loses its gradient (`background-image: none`). New-case dialog: Cancel (ghost) and
"წაშლა და ახლის დაწყება" (danger) both measure `rgb(43,108,176)`. `EMRButton.tsx:395-419` never passes a `variant` to
Mantine's Button, so Mantine's default `filled` background is always present to win.
- Defect: stylesheet order (main.tsx:4 before :8). One line.
- Amplifier: `EMRButton` lets Mantine's `filled` variant render underneath every semantic variant.

The theme-dependent difference the critic logged ("dark: quiet slate, light: solid navy") is a side effect of the same
leak, because Mantine's filled colour resolves differently per scheme. HYPOTHESIS: other EMR wrappers whose module CSS
competes with a Mantine root rule are hit by the same order bug (candidate: the critic's "input inside an input" on
empty MultiSelects, `critic/iliac-pelvic-venous.json` dark P3). Kill-criterion: list the matched rules for an empty
`EMRMultiSelect` input. If no `@mantine/core` rule overrides a `.module.css` rule, kill it.
**(c) Sibling pattern:** CONFIRMED — the intended design is already in `EMRButton.module.css`. Nothing new to design.
**Merges with:** U-1031 (colour part only; the wording, and the title word being the same as the Cancel label, is
content), critic "boldness spent once" on all 4 study screens, intake dark-vs-light structure parity.
**Effort signal:** S — one import-order change (or wrap Mantine in a CSS `@layer`). Blast radius is high: 77
`<EMRButton>` call sites in 31 files, and potentially 48 wrapper modules, will start rendering as designed. The UI-X lane
should re-shoot every screen afterwards.

---

## X-ELEV — white page = white card (decks not separable), every screen

**Runtime evidence:** critic, every screen: `pageBg rgb(255,255,255) == cardBg rgb(255,255,255)`, contrast 1.0
(`critic/venous-le.json` P1, `critic/carotid.json` 768/375 P1, `critic/intake.json` 375 P1).

**(a) Already exists?** CONFIRMED — the target value exists in the reference: `src/styles/reference-screenshots/deep-dive.html:67`
`--paper:#e7ebf1` (page) vs `:68` `--sheet:#ffffff` (deck). The Command deck style (no border, `--emr-shadow-card`)
exists in `EMRContentSection.module.css:26-30` `.lightDefault`.
**(b) Cause:** CONFIRMED — `src/styles/theme.css:149-150`
```css
  --emr-bg-page: #ffffff;
  --emr-bg-card: #ffffff;
```
Page wrappers all resolve to this token: `AppShell.module.css:166`, `VenousLEForm.module.css:4`, `mantineTheme.ts:157`
`--mantine-color-body`. Dark already differs (`theme.css:1569-1570`, `#0f172a` vs `#1e293b`), which is why the dark
variants pass.
- Defect: light page token equals the card token.
- Amplifier: older decks use a hairline border + `--emr-shadow-sm` instead of `--emr-shadow-card`:
  `RecommendationsBlock.module.css:9-12`, `ImpressionBlock.module.css:11-14`, `StudyHeader.module.css:4-7`. Their only
  separation from the page is a faint outline.
**(c) Sibling pattern:** CONFIRMED — `EMRContentSection.module.css:26-30` (deck = card bg + transparent border +
`--emr-shadow-card`). `SegmentAssessmentCard.module.css:4-6` already follows it.
**Merges with:** critic elevation-contrast on intake, venous, arterial, carotid, iliac (all light variants).
**Effort signal:** S — one token. Risk: 46 `var(--emr-bg-page)` uses outside theme.css. Some are inset fills inside
cards (`CEAPPicker.module.css:161,249`, `RecommendationsBlock.module.css:103,113`, `SVPPicker.module.css:100,125`,
`ImpressionBlock.module.css:91`, `DrawingToolbar.module.css:16`). They would turn grey, which reads as "sunken"
(probably intended) but needs a visual pass.

---

## X-DOT + U-1017 + U-1036 — save indicator: red dot next to "last saved", green dot next to "not saved yet", "not saved yet" after reload, save failures invisible

**Runtime evidence:** critic venous/arterial: red dot beside `ბოლოს შენახული`. Critic carotid/iliac: green
`--emr-success` dot beside `ჯერ არ შენახულა`. U-1036 / U-1017: "not saved yet" after reload although LS+IDB hold the
draft. Autosave failure goes only to `console.warn`.

**(a) Already exists?** CONFIRMED — the truth is already persisted. `EncounterContext.tsx:137-140` stamps
`updatedAt` on every write (`types/encounter.ts:79`), but no form reads it for the indicator. There is no shared
save-state hook. Each of the 4 forms keeps its own `lastSavedAt` / dirty pair.
**(b) Cause:** CONFIRMED — four separate defects behind one indicator, `src/components/form/FormActions.tsx:536`
```tsx
<span className={`${classes.dot} ${hasUnsavedChanges ? classes.dotDirty : classes.dotClean}`} aria-hidden />
```
1. The "dirty" colour is red. `.dotDirty { background: var(--emr-warning) }` (`FormActions.module.css:52-56`) and
   `theme.css:210` `--emr-warning: #c53030`. The "clean" colour is `--emr-success` green (`:47-50`).
2. Venous is dirty permanently. Two effects on `[state]` in declaration order: the persist effect sets `setDirty(false)`
   (`VenousLEForm.tsx:776-789`), then the dirty effect sets `setDirty(true)` (`:836-843`), so the last write is always
   `true`. Live: `_dotDirty_` + `rgb(197,48,48)` + "ბოლოს შენახული: 16:19:18" at the same moment.
3. Carotid and iliac are always "clean": `hasUnsavedChanges={false}` is hard-coded (`CarotidForm.tsx:796`,
   `IliacPelvicVenousForm.tsx:645`).
4. After reload the text is wrong: every form starts at `useState<Date | null>(null)` (`VenousLEForm.tsx:760`,
   `ArterialLEForm.tsx:368`, `CarotidForm.tsx:385`, `IliacPelvicVenousForm.tsx:334`), so it shows
   `venousLE.actions.neverSaved` (`FormActions.tsx:485-487`).
- Defect (U-1017, data-safety): `EncounterContext.tsx:141-143` `saveEncounter(...).catch(err => console.warn(...))`, plus
  the LS quota failure at `encounterStore.ts:100-102`. A failed save never reaches the UI.
- Amplifier: every form sets `lastSavedAt = new Date()` synchronously right after `setStudyState` (e.g.
  `VenousLEForm.tsx:783-784`), before the async IDB write settles. The indicator says "saved" even when the write
  failed.
**(c) Sibling pattern:** CONFIRMED (partial) — `EncounterContext.persist` (`:137-145`) is already the single funnel
for every write. It is the one place that knows both `updatedAt` and the failure. No form has a correct indicator to
copy.
**Merges with:** U-1017, U-1036, critic status-colour findings on venous/arterial/carotid/iliac (all variants). Also
part of the arterial autosave loop (see U-1003).
**Effort signal:** S–M — the data exists (`updatedAt`) and the funnel exists (`persist`). Missing: exposing
`{updatedAt, saveError}` from the context and reading it in `FormActions` (1 shared component, 4 callers) instead of 4
local pairs.

---

## U-1003 — two tabs on one encounter: stale tab silently erases the other tab's edit

**Runtime evidence:** M-real: tab B carotid note saved, tab A edits PSV, B's note is gone after reload, no warning.

**(a) Already exists?** CONFIRMED — no. The only `storage` listener in `src/` is the colour-scheme manager
(`styles/mantineTheme.ts:205-210`).
**(b) Cause:** CONFIRMED — `src/services/encounterStore.ts:139-146`
```ts
export async function saveEncounter(draft: EncounterDraft): Promise<void> {
  const stamped: EncounterDraft = { ...draft, updatedAt: new Date().toISOString() };
  await set(keyEncounter(stamped.encounterId), stamped, store());
  writeSyncRaw(stamped);
```
Each write replaces the whole draft from that tab's in-memory copy (`EncounterContext.tsx:191-201`
`setStudyState` → `persist`). Nothing compares against the stored `updatedAt` first.
- Defect: whole-draft last-writer-wins with no freshness check.
- **Amplifier (found during this trace, CONFIRMED live):** an idle arterial form rewrites the whole encounter about
  every 520 ms, forever. Sampled LS `updatedAt` at 0.7 s intervals with no input: `…17.380Z, 17.909Z, 18.963Z,
  19.486Z, 20.008Z, 21.055Z`. Cause: `ArterialLEForm.tsx:374-389`
  ```ts
  useEffect(() => {
    if (!encounter) return; ...
    setHasUnsavedChanges(true);
    const handle = setTimeout(() => { setStudyState('arterialLE', state); ... }, 500);
  }, [encounter, setStudyState, state]);
  ```
  `setStudyState` always returns a new `encounter` (no identity guard, `EncounterContext.tsx:193-201`), so the effect
  re-arms itself. A tab left idle on arterial overwrites the other tab's edits within 0.5 s, keeps writing to IDB and LS,
  and flips the save dot every half second. It also contradicts the CLAUDE.md "no debounce" rule (a 500 ms window of
  unpersisted input).
**(c) Sibling pattern:** CONFIRMED — for the loop: `CarotidForm.tsx:396-406` / `IliacPelvicVenousForm.tsx:335-345`
`lastPersistedRef` guard ("persist only if `state` actually changed by reference"). Venous (`VenousLEForm.tsx:776-789`)
depends on `[state]` only and does not loop. For cross-tab: `mantineTheme.ts:205-210` (a working `storage` subscription
to copy).
**Merges with:** X-DOT (arterial dot flicker). Standing check "Idempotency, two tabs".
**Effort signal:** S for the loop (copy a 4-line guard). M for cross-tab detection (new listener + banner or merge
policy, no sibling for the merge itself).

---

## U-1033 + U-1011 — venous PDF table prints "—" for recorded reflux/compressibility (diagram red, table silent)

**Runtime evidence:** walk-phys `pdfs/t9-download.pdf`: R GSV set to reflux, PDF table prints `—`, diagram red.
M-real: CFV partial compressibility (DVT sign) absent from the PDF.

**(a) Already exists?** CONFIRMED — partly. A categorical-column PDF table exists for the iliac study. Labels for every
competency value already exist (`buildReportLabels.ts:142-146`).
**(b) Cause:** CONFIRMED — `src/components/pdf/sections/FindingsTable.tsx:128-133`
```ts
    const { refluxDurationMs, apDiameterMm, depthMm } = f;
    const anyValue =
      refluxDurationMs !== undefined ||
      apDiameterMm !== undefined ||
      depthMm !== undefined;
    if (!anyValue) continue;
```
The table has only Segment / Reflux s / AP / Depth columns (`:171-204`). `competencyOverride`, `compressibility` and
`thrombosis` are never read, so a categorical-only row is dropped and a mixed row shows only numerics.
- Defect: the venous PDF table is numeric-only by construction.
- Amplifier: the diagram still paints the segment red (`deriveCompetency` honours the override, `venous-le/config.ts:286`),
  so the page looks complete and the omission is invisible.
- **Same omission in FHIR (CONFIRMED):** `services/fhirBuilder/observations/venous.ts:59-130` emits
  compressibility / thrombosis / phasicity / refluxDurationMs / apDiameterMm / depthMm and **no**
  `competencyOverride`. A clinician-set reflux or perforator exists only inside the QR JSON blob
  (`questionnaireResponse.ts:98-104`), with no Observation.
**(c) Sibling pattern:** CONFIRMED — `IliacPelvicVenousFindingsTable.tsx:102-112` (`hasData` counts categorical fields)
and `:120-121, :196-204` (`vlabel(ns, value)` → `labels.value[...]` per categorical column). For FHIR:
`observations/iliac.ts:180-185` (competency Observation with `isAbnormal`).
**Merges with:** U-1011, U-1033 (one cause). Also the U-1027 perforator code, which is also absent from FHIR.
**Effort signal:** M — the column pattern and labels exist. What to print is a clinical call (U-1011 flags sign-off),
and it touches the PDF section, `buildReportLabels` and the FHIR builder.

---

## U-1022 — venous table below desktop: 20 named categorical cards, then 20 **unnamed** numeric cards (the 1.8 s reflux card has no segment)

**Runtime evidence:** critic `venous-le` 768 + 375, P0: "abnormal card (1.8 s / 7.2 mm) is anonymous". Wrong-segment
entry risk.

**(a) Already exists?** CONFIRMED — the segment-name cell already exists in `ReflexTimeTable` and is suppressed:
`ReflexTimeTable.tsx:205-214` renders label + R/L badge `{!headless && (...)}`.
**(b) Cause:** CONFIRMED — `src/components/form/SegmentAssessmentCard.tsx:206-235`
```tsx
<Grid.Col span={{ base: 12, lg: 7 }}> <SegmentTable headless ... /> </Grid.Col>
<Grid.Col span={{ base: 12, lg: 5 }}> <ReflexTimeTable headless view={view} showAllRows ... /> </Grid.Col>
```
One segment's data lives in two independent tables placed side by side. At ≥lg the rows line up visually, so the
second table can omit names (`headless`). Below Mantine `lg` (1200px) the columns stack, and both tables collapse to cards
at ≤768px (`ReflexTimeTable.module.css:187-212`, `SegmentTable.module.css:221-275`). Result: two stacks, and the second
has no names.
- Defect: one record split across two components joined only by visual row alignment.
- Amplifier: `headless` drops the only identity on the numeric rows. Aria-labels still carry `fullId`
  (`ReflexTimeTable.tsx:218`), so screen readers are fine and the sighted user is not.
**(c) Sibling pattern:** CONFIRMED — `ArterialSegmentTable` and `CarotidSegmentTable` keep categorical and numeric fields
in ONE row per segment, with a side badge (`ArterialSegmentTable.tsx:186`, `CarotidSegmentTable.tsx:185`), so their
cards stay named.
**Merges with:** X-TABLE (venous instance). Also feeds X-DIAG (the stacked numeric block pushes the diagram further down).
**Effort signal:** S to name the numeric cards (un-suppress existing markup below lg). M for one card per segment
(merging the two tables, which is the arterial/carotid shape).

---

## U-1037 — L/R badge hidden on long GSV rows: two rows look identical

**Runtime evidence:** walk-phys, venous bilateral read. Live at 1440: `gsv-prox-thigh-right`, `gsv-mid-thigh-right`,
`gsv-dist-thigh-right` badges start at x=138–144 while the next column starts at x=138.

**(a) Already exists?** CONFIRMED — the badge is rendered (`SegmentTable.tsx:267-270`). It is covered, not missing.
**(b) Cause:** CONFIRMED — `src/components/form/SegmentTable.module.css:108` + `:168-182`
```css
  grid-template-columns: 88px repeat(6, minmax(0, 1fr));
  ...
.segmentButton { display: inline-flex; ... white-space: nowrap; }
```
The fixed 88px first column, a `nowrap` short label (`GSV Prox Thigh`) and a trailing badge make the badge overflow
into the next grid cell, which paints over it.
- Defect: fixed 88px label column + nowrap + badge after the label.
- Amplifier: the full Georgian name is only in the tooltip / aria-label (`SegmentTable.tsx:260-265`).
**(c) Sibling pattern:** CONFIRMED — `ArterialSegmentTable.module.css:66` gives the label column `180px`
(`CarotidSegmentTable.module.css:62` gives `200px`).
**Merges with:** none (the venous X-TABLE sibling is a different cause).
**Effort signal:** S — one CSS value, or put the badge before the label.

---

## X-TABLE — arterial / carotid / iliac segment tables below desktop: 21–34 equal empty cards; iliac cards carry no side

**Runtime evidence:** critic `iliac-pelvic-venous` 768/375 P2: "side carried only by a small grey pill above the first
card… mid-scroll the clinician cannot tell right from left". Arterial 768: 34 cards, diagram at y≈15,300. Carotid 768:
24 cards × 560px.

**(a) Already exists?** CONFIRMED — the iliac side text is already built for aria only:
`IliacCavalTable.tsx:98-99` `fullLabel = "${segLabel} (${side})"`. Separately, `shared/EMRTable/EMRTable.tsx` (982 lines)
supports `sticky: 'left'` columns (`EMRTableTypes.ts:71`, `EMRTable.tsx:143`) and has zero study callers.
HYPOTHESIS: EMRTable can host inline form inputs. Kill-criterion: it has no cell-renderer slot for editable controls.
**(b) Cause:** CONFIRMED — iliac `src/components/studies/iliac-pelvic-venous/IliacCavalTable.tsx:103`
```tsx
<div className={`${classes.cell} ${classes.segmentCell}`}>{segLabel}</div>
```
The visible label omits the side. `fullLabel` (`:98-99`) goes only into `aria-label`. All three tables use the same
collapse: a fixed-column grid with `min-width` 890/940/990px, then `@media (max-width: 992px)` turns every row into a
full card with `data-label` captions (`ArterialSegmentTable.module.css:205-234`, `CarotidSegmentTable.module.css:154-182`,
`IliacCavalTable.module.css:106-155`). Empty rows keep full footprint.
- Defect (safety, iliac): visible side label missing per row.
- Amplifier (density, all three): the card collapse has no "empty row" compaction. There is no shared table component,
  so the same CSS block is copied 4 times.
**(c) Sibling pattern:** CONFIRMED — `ArterialSegmentTable.tsx:186` / `CarotidSegmentTable.tsx:185` side badge
(`segmentSide` / `vesselSide` with `data-side`).
**Merges with:** U-1022 (same symptom family, different cause per table). No single shared fix point: 4 separate
`*.module.css` copies.
**Effort signal:** S for the iliac side label (markup exists). M for compact collapse (4 copies, or adopting EMRTable,
which is hypothesis-gated).

---

## U-1014 (study forms) — sticky action bar pushes the page to 556–580px at 375; PDF buttons off-screen

**Runtime evidence:** M-real `screenshots/m375-arterialLE.png`. Critic iliac 375 P1. Live: `scrollWidth` 556 (venous)
and 580 (arterial).

**(a) Already exists?** CONFIRMED — wrapping is already declared (`flex-wrap: wrap` on `.inner` and `.buttons`). It
never triggers.
**(b) Cause:** CONFIRMED — `src/components/form/FormActions.module.css:69-76`
```css
.buttons {
  display: inline-flex;
  ...
  flex-shrink: 0;
  flex-wrap: wrap;
```
`flex-shrink: 0` sizes the group to its max-content width (live: 544px = 198 + 135 + 191 + gaps). Its own
`flex-wrap` therefore never has a narrower box to wrap in, and the group widens the document. The only other overflow
root on venous: the `SegmentAssessmentCard` header `Group wrap="nowrap"` (498px), a minor second contributor.
- Defect: `flex-shrink: 0` on the button group.
- Amplifier: the bar is `position: sticky` inside the page, so it stretches with the overflow and drags the whole
  document sideways.
**(c) Sibling pattern:** CONFIRMED — `FormActions.module.css:16-25` `.inner` (shrinkable flex row with `flex-wrap`).
**Merges with:** critic 375 overflow on venous, arterial, carotid, iliac (one shared component, 4 callers). The intake
half of U-1014 is a separate cause, next section.
**Effort signal:** S — one CSS declaration in one shared file.

## U-1014 (intake) — intake sticky footer clips the primary CTA at 375

**Runtime evidence:** M-real `screenshots/m375-intake.png`. Live: `.actionRowRight` 229px wide ends at x=513 on a
375 viewport.

**(a) Already exists?** CONFIRMED — a `max-width: 576px` block already relaxes the CTA (`EncounterIntake.module.css:1071-1080`).
The outer row is not covered by it.
**(b) Cause:** CONFIRMED — `src/components/layout/EncounterIntake.module.css:1003-1012` + `:1039-1040`
```css
.actionRowInner { ... display: flex; justify-content: space-between; gap: 16px; }   /* no flex-wrap */
.actionRowResume { ... white-space: nowrap; flex-shrink: 0; }
```
The long Georgian resume button ("მიმდინარე ვიზიტის გაგრძელება") cannot shrink or wrap, so it shoves the CTA group
off-screen.
- Defect: outer row has no `flex-wrap`, and the resume button is non-shrinking.
- Amplifier: the resume button itself is a no-op (U-1016), so the element that breaks the layout does nothing.
**(c) Sibling pattern:** CONFIRMED — `FormActions.module.css:24` `.inner { flex-wrap: wrap }`.
**Merges with:** U-1016 (the same button).
**Effort signal:** S.

---

## X-DIAG — anatomy diagram sits 1,500–3,000px below the table it visualises (all 4 study forms)

**Runtime evidence:** critic: venous "diagram starts only after the full 22-row segment table"; arterial "starts
around y2780" next to a "1,600px empty left column"; carotid "~2,780px down"; iliac "~1,500px further down".

**(a) Already exists?** CONFIRMED — the side-by-side layout was **specified but never built**:
`VenousLEForm.tsx:9-12` header diagram shows `AnatomyView L/R │ SegmentTable` in one row. The arterial grid already has
a short left column (`ArterialLEForm.tsx:770-783`, pressures `lg:5` beside the table `lg:7`) that leaves the empty
space the critic measured.
**(b) Cause:** CONFIRMED — `src/components/studies/venous-le/VenousLEForm.tsx:1200-1247`
```tsx
<SegmentAssessmentCard ... />
<EMRContentSection title={t('venousLE.anatomy.title')} ...>
  <Stack gap="sm"><AnatomyDiagramSection ... />
```
The diagram is the next `Stack` item after the table in every form: arterial `:841` (after the Grid at `:770-783`),
carotid `:743` (after the table at `:721`), iliac likewise. No form has a sticky diagram column.
- Defect: layout composition per form (vertical stack).
- Amplifier: venous splits the table in two (U-1022) and arterial's `min-width: 890px` table (U-1015) makes the table
  block taller and wider, which pushes the diagram further away.
**(c) Sibling pattern:** NONE in the app. The reference `src/styles/reference-screenshots/deep-dive.html` is the only
two-column precedent. `AnatomyDiagramSection` is shared (4 callers), so the diagram itself needs no change. Only each
form's layout does.
**Merges with:** critic "ONE focal element" on venous, arterial, carotid, iliac (4 forms, 4 layout edits, 1 shared
diagram component).
**Effort signal:** M — 4 per-form layout edits. Arterial is closer to S (move the diagram into the existing `lg:5`
column under the pressures).

---

## X-RECS — empty Recommendations deck is the loudest card on the page

**Runtime evidence:** critic venous / arterial / carotid all variants, empty-state-parity: 223px empty vs 137px
populated (1.63×). "gradient top ribbon, icon tile, gradient add button, dashed box".

**(a) Already exists?** CONFIRMED — one shared component: `RecommendationsBlock` (callers: `VenousLEForm.tsx:1263`,
`ArterialLEForm.tsx`, `CarotidForm.tsx`).
**(b) Cause:** CONFIRMED — `src/components/form/RecommendationsBlock.tsx:82-103` + `RecommendationsBlock.module.css:22-28, 94-100`
```tsx
<EMRButton variant="primary" size="xs" icon={IconPlus} ...>   {/* :82-90 */}
{items.length === 0 ? (<div className={classes.empty}><IconClipboardList size={24} .../>  {/* :94-103 */}
```
The pre-Command card style: a 3px gradient ribbon (`.card::before`, module :22), a padded centred empty block
(`.empty { padding: 28px 24px }` :94-100), and a primary add button.
- Defect: empty state sized like content, plus the ribbon (reserved for KPI cards).
- Amplifier: X-BTN. Today every button is solid blue anyway, so the add button's `primary` competes equally.
**(c) Sibling pattern:** CONFIRMED — the Command deck `EMRContentSection` with `showAccent={false}` (venous anatomy
section, `VenousLEForm.tsx:1218-1222`).
**Merges with:** X-ELEV amplifier (same component uses border + shadow-sm). One file covers 3 screens.
**Effort signal:** S.

---

## U-1028 + walk d5c84bc79cf3 — banner "+ add study" menu clipped (options unclickable); right-leg-only venous study unreachable

**Runtime evidence:** walk-sono: dropdown options invisible / unclickable. `d5c84bc79cf3` FAILED_DISCOVERABILITY:
intake card has no laterality, and the in-form R/L/bilateral control only filters the table.

**(a) Already exists?** CONFIRMED — **right / left venous study types are plumbed end to end:** `types/study.ts:34-35`,
route allow-list `EncounterStudyWrapper.tsx:54-55, 73-74`, CPT `vascular-cpt.ts:123-124` (93971), FHIR
`fhir-systems.ts:108-112`, `fhirBuilder/context.ts:76`, projection `encounterProjection.ts:178`, banner menu entries
`EncounterContextBanner.tsx:53-62`. The only UI entry point is the clipped menu.
**(b) Cause:** CONFIRMED — two defects.
1. Clipping: `src/components/layout/EncounterContextBanner.module.css:34` `.banner { … overflow: hidden; }` contains an
   absolutely positioned in-flow menu (`.menuDropdown { position: absolute; top: calc(100% + 8px) }` :305-309; JSX
   `EncounterContextBanner.tsx:267-292`).
2. Indistinguishable labels: all three venous entries use `translationKey: 'studies.venousLE.short'`
   (`EncounterContextBanner.tsx:48-62`). In ka that key exists ("ქვ. კიდურების ვენები"), so the `(R)` / `(L)` fallbacks
   never show.
- Also CONFIRMED: `VenousLEForm` knows only bilateral. `STUDY_ID = 'venousLEBilateral'` (`:151`) and it persists into
  `setStudyStateRef.current('venousLEBilateral', …)` (`:783`).
  HYPOTHESIS: adding `venousLERight` mounts the bilateral form, which writes into the `venousLEBilateral` slot. The
  `venousLERight` slot stays empty, so `isStudyComplete` is false forever and multi-study exports stay disabled (ties to
  U-1002). Kill-criterion: add `venousLERight` to an encounter, enter one finding, inspect `encounter.studies`. If a
  `venousLERight` key holds the finding, kill it.
**(c) Sibling pattern:** CONFIRMED — `IliacPelvicVenousForm.tsx:445-458` uses Mantine `<Menu>`, which portals its
dropdown out of overflow containers.
**Merges with:** walk d5c84bc79cf3, U-1002 (hypothesis link).
**Effort signal:** S for the clip and the labels. M for real single-leg studies (the form must honour the route's
study type).

---

## U-1031 — "+ ახალი კვლევა" (new study) opens "erase all current data"

**Runtime evidence:** walk-sono a93706776962 / d5c84: a button that looks like "add" opens a destructive dialog. The
dialog title says "new study", and Cancel is labelled `გაუქმება`.

**(a) Already exists?** CONFIRMED — the destructive styling is built: `ConfirmDialog.tsx:89`
`variant={destructive ? 'danger' : 'primary'}`, and `VenousLEForm.tsx:1301` passes `destructive`. It is blue only
because of X-BTN.
**(b) Cause:** CONFIRMED — `src/components/studies/venous-le/VenousLEForm.tsx:1188-1197` +
`translations/venous-le/ka.json` `venousLE.actions.newCase = "+ ახალი კვლევა"`
```tsx
<button className={classes.newCaseButton} onClick={handleNewCaseRequest} ...>
  <IconPlus size={16} stroke={2.25} /><span>{t('venousLE.actions.newCase', '+ New case')}</span>
```
The action is `RESET` of the current study (`:1120-1127`). The label "+ new study" matches the banner's
"+ კვლევის დამატება" pattern, and the gradient styling (`VenousLEForm.module.css:82`) makes it look additive. The doubled
`+` (icon + literal) is the same line. The pattern is copied into arterial and carotid (`newCaseButton` in
`ArterialLEForm.tsx`, `CarotidForm.tsx`).
- Defect: wording / affordance (a content decision).
- Amplifier: X-BTN cascade (danger renders blue).
**(c) Sibling pattern:** CONFIRMED — `OngoingVisitsPanel.tsx:322, 334` / `StudyPicker.tsx:390, 402` (destructive
dialogs that name the action as discard).
**Merges with:** X-BTN (colour only).
**Effort signal:** S (copy + one CSS class). The label is a product decision.

---

## U-1030 + walk 85025cca62ba — pelvic study has no "all normal": ~84 clicks for a normal study

**Runtime evidence:** walk-sono FAILED_DISCOVERABILITY at threshold, 19 clicks and still incomplete.

**(a) Already exists?** CONFIRMED — **the data is built.** The U-1025 fix added
`iliac-pelvic-venous/templates.ts:21-22`
```ts
const NORMAL_CAVAL: IliacCavalFindings = Object.fromEntries(
  ILIAC_CAVAL_ROW_ORDER.map((id) => [id, { patency: 'patent', filling: 'full', competency: 'competent' }])
```
(not exported). The normal template now fills all 21 rows, so the template path (≈3 clicks) is now a working "all normal"
that also writes the conclusion.
HYPOTHESIS: a re-walk now passes via the template. Kill-criterion: re-run 85025cca62ba. If the walker still cannot find
it within budget, kill it.
**(b) Cause:** CONFIRMED — `IliacCavalTable.tsx` / `IliacPelvicVenousForm.tsx` expose no bulk-normal action (grep for
`allNormal|SET_ALL_NORMAL` returns nothing in `iliac-pelvic-venous/`). Venous has one.
- Defect: missing bulk action.
- Amplifier: before U-1025 the template wrote a normal conclusion over an empty table (fixed).
**(c) Sibling pattern:** CONFIRMED — venous `SET_ALL_NORMAL` reducer `VenousLEForm.tsx:300-315` + handler `:898-900` +
button in `SegmentAssessmentCard` (testid `bulk-set-all-normal`).
**Merges with:** none.
**Effort signal:** S — export `NORMAL_CAVAL`, add one button and one reducer case.

---

## U-1027 — option labelled "პერფორანტი" (perforator) is stored and exported as `inconclusive`

**Runtime evidence:** walk-sono, venous competency select.

**(a) Already exists?** CONFIRMED — the relabel was deliberate: `venous-le/config.ts:294-296` "The `inconclusive`
competency slot is shown as 'Perforator' (2026-10-07 feedback)".
**(b) Cause:** CONFIRMED — `translations/venous-le/ka.json` `venousLE.competency.inconclusive = "პერფორანტი"` (and core
`competency.inconclusive`). The enum keeps `'inconclusive'` (`venous-le/config.ts:81, 94`, `SegmentTable.tsx:47`,
`AnatomyLegend.tsx:42`). The FHIR extension documents the code as
`normal|ablated|incompetent|inconclusive` (`fhir-systems.ts:375`). Colour: `theme-colors.ts:118`
`inconclusive: { fill: '#2563eb' }`, the Tailwind blue-600 the critic flagged.
- Defect: UI label and stored code mean different things.
- Amplifier: none in FHIR today, because venous never exports `competencyOverride` (see U-1033). It will become live the
  moment that gap is fixed.
**(c) Sibling pattern:** NONE — no study has a separate perforator value. Clinical decision.
**Merges with:** U-1033 (FHIR gap), critic "Tailwind blue perforator" (same token).
**Effort signal:** M — a new enum value touches config, the table, the legend, colours, translations, PDF and FHIR.
Clinical sign-off required.

---

## U-1026 — arterial "normal" template's TBI 0.85 is graded "mild PAD"

**Runtime evidence:** walk-sono 9acf2a952037.

**(a) Already exists?** CONFIRMED — no separate TBI banding exists.
**(b) Cause:** CONFIRMED — `src/components/studies/arterial-le/abiCalculator.ts:28-30, 96-97`
```ts
  readonly band: AbiBand;             // same bands apply
  ...
  const tbi = toe / brachial;
  return { tbi, band: bandForRatio(tbi) };
```
TBI is graded with ABI bands (0.90–1.29 normal). The template's `toeR/L: 110`, `brachialR/L: 130`
(`arterial-le/templates.ts:103-116`) gives 0.846, which grades "mild".
- Defect: the calculator applies ABI cut-offs to TBI. This affects every TBI, not only the template.
- Amplifier: the template exposes it on the "normal" path.
**(c) Sibling pattern:** NONE.
**Merges with:** none.
**Effort signal:** S in code. The cut-off is a clinical decision (founder list).

---

## U-1023 — arterial pressures table lists L before R (everything else is R first)

**Runtime evidence:** critic arterial-le, laterality risk.

**(a) Already exists?** CONFIRMED — the PDF version of the same table is already R first:
`components/pdf/sections/SegmentalPressureTable.tsx:219-223` (R row first).
**(b) Cause:** CONFIRMED — `src/components/studies/arterial-le/SegmentalPressureTable.tsx:108-113` and `:121-143`
```tsx
<div className={classes.sideHead} role="columnheader" data-side="left">L</div>
<div className={classes.sideHead} role="columnheader" data-side="right">R</div>
```
Column order is hard-coded L, R (header comment `:8` "left input · right input").
**(c) Sibling pattern:** CONFIRMED — PDF `SegmentalPressureTable.tsx:219`.
**Merges with:** none.
**Effort signal:** S.

---

## U-1021 + U-1024 — dark mode: unselected study cards show ✓; anatomy silhouette stays light and hides the R/L labels

**Runtime evidence:** critic `intake.json` dark-1440 P1. Critic venous / arterial dark P1–P2.

**(a) Already exists?** CONFIRMED — partial theming exists: AnatomyView already rewrites the silhouette stroke,
side-label fill and junction-dot fill for dark (`AnatomyView.tsx:179-207`).
**(b) Cause:** CONFIRMED — two causes.
1. ✓ (U-1021): `src/styles/theme.css:3728-3734`
   ```css
   :root[data-mantine-color-scheme="dark"] .tabler-icon { color: #ffffff !important; stroke: #ffffff !important; }
   ```
   This defeats the hide-by-colour unselected state `.studyCardCheck { color: transparent }`
   (`EncounterIntake.module.css:643-655`). The icon is always rendered (`EncounterIntake.tsx:884-890`). The same
   global rule is the prime HYPOTHESIS for the inverted stepper and the invisible moon icon. Kill-criterion: in dark,
   disable the rule in DevTools. If the stepper and moon do not change, kill it for them.
2. Silhouette (U-1024): `src/components/anatomy/AnatomyView.tsx:180-183` rewrites only `stroke` on
   `<g id="silhouette">`. The SVG ships `fill="#f7fafc"` (`public/anatomy/le-anterior.svg`,
   `le-arterial-anterior.svg`). Side labels are rewritten to `var(--emr-text-primary)` (`:195-198`), which is light in
   dark mode, so they become light-on-light and invisible. The side-label fix is correct only if the silhouette fill is
   also themed.
- Amplifier (U-1024): the black occlusion swatch has no hairline border.
**(c) Sibling pattern:** CONFIRMED — `AnatomyView.tsx:189-198` (the regex rewrite pattern, extended to `fill`). For the
✓: conditional render (`{checked && <IconCheck/>}`), with no exact in-repo instance cited.
**Merges with:** critic dark findings on intake, venous, arterial.
**Effort signal:** S each (one regex; one conditional or a scoped `:not()`). The global icon rule has a large blast
radius, so a scoped fix is safer.

---

## U-1002 + walk 3088c351aa84 (FAILED_BLOCKED, CRITICAL floor) — finished study cannot be exported while the visit's other study is empty

**Runtime evidence:** walk-phys: venous complete, carotid untouched, so both PDF buttons are disabled with an English
tooltip.

**(a) Already exists?** CONFIRMED — **per-study export is fully built.** `renderSingleStudyPdfBlob`
(`FormActions.tsx:327`, ~34 lines) renders the active study alone. It is used whenever `!isUnifiedMode`
(`:406-408`, `:453-455`). The code even carries the intended escape hatch as a TODO (`:500-502`).
**(b) Cause:** CONFIRMED — `src/components/form/FormActions.tsx:288-297` + `:493`
```ts
const unified = encounter.selectedStudyTypes.length >= 2;
const complete = encounter.selectedStudyTypes.every((type) => isStudyComplete(encounter, type));
...
const exportsDisabled = (isUnifiedMode && !allComplete) || exportsDisabledProp;
```
Any encounter with 2+ selected studies forces the combined PDF and gates it on all studies having a finding
(`isStudyComplete` `:95-110`).
- Defect: an all-or-nothing gate with no per-study path.
- Amplifier: the explanation is an English-only hover tooltip (`formActions.completeAllFirst` is missing from every
  locale, see U-1004) on a disabled button.
**(c) Sibling pattern:** CONFIRMED — `FormActions.tsx:406-408` (the non-unified branch). Also the alternative: filter
`studyForms` by `isStudyComplete` before `renderUnifiedPdfBlob` (`:361`).
**Merges with:** U-1004 (tooltip text), U-1028 (hypothesis: an empty `venousLERight` slot keeps this gate shut).
**Effort signal:** S — the renderer exists. Choosing which path to offer is a product decision.

---

## U-1029 (+ U-1035 part) — study form opens ~1200px down; "Edit" loads the patient below without scrolling

**Runtime evidence:** walk-sono: form opens with the banner off-screen. Walk-phys: Edit fills the form below the fold.

**(a) Already exists?** CONFIRMED — no. No `scrollTo`, `ScrollRestoration` or route-scroll hook in `src/`. The only
`scrollIntoView`s are `EMRFormErrorSummary.tsx:60` and `EMRTimeInput.tsx:404`. The app uses `BrowserRouter`
(`main.tsx:3`), so React Router's `<ScrollRestoration>` (data-router only) is not available.
**(b) Cause:** CONFIRMED — `EncounterIntake.tsx:437, 446` `navigate(\`/encounter/${id}/${firstStudy}\`)` after the user
has scrolled to the CTA at the bottom of a ~3,100px intake. The window scroll position survives the SPA route change.
`OngoingVisitsPanel.tsx:133-136` `handleEdit` navigates to `/?edit=` with the same problem.
- Defect: no scroll reset on navigation.
**(c) Sibling pattern:** CONFIRMED (partial) — `EMRFormErrorSummary.tsx:60` `element.scrollIntoView(...)` for the
Edit case. NONE for route-change reset.
**Merges with:** U-1035 (the Edit-scroll half).
**Effort signal:** S — one effect on `location.pathname` in the shell.

---

## U-1016 — intake footer "მიმდინარე ვიზიტის გაგრძელება" does nothing

**Runtime evidence:** M-real; walk-phys d45cf28e1a49 / walk-sono 332f579ec7b3 duplicate-path.

**(a) Already exists?** CONFIRMED — a working resume exists: `OngoingVisitsPanel.tsx:121-131` `handleResume(enc)`, and
`listEncounters` is already sorted newest-first (`encounterStore.ts:280-297`).
**(b) Cause:** CONFIRMED — `src/components/layout/EncounterIntake.tsx:467-469`
```ts
const handleResume = useCallback(() => {
  navigate('/');
}, [navigate]);
```
It navigates to `/` while already on `/` (button at `:1083-1091`).
**(c) Sibling pattern:** CONFIRMED — `OngoingVisitsPanel.tsx:121-131`.
**Merges with:** U-1014 intake (the same button breaks the 375 layout), U-1035 (the panel starts collapsed,
`OngoingVisitsPanel.tsx:100` `useState(false)`).
**Effort signal:** S.

---

## U-1015 + "off-viewport-control ×34" (10 walk tasks) — arterial table scrolls inside its card at 1440; occlusion column off-screen

**Runtime evidence:** M-real (890 vs 777px). The scorer logs `off-viewport-control HIGH 34 controls` on 10 tasks in both
runs.

**(a) Already exists?** CONFIRMED — no.
**(b) Cause:** CONFIRMED — `src/components/studies/arterial-le/ArterialSegmentTable.module.css:66-69`
```css
  grid-template-columns: 180px minmax(260px, 1fr) 90px 140px 120px 60px;
  min-width: 890px;
```
This sits inside the `lg: 7` column (`ArterialLEForm.tsx:777`), about 720–777px wide. The last column (occlusion checkbox,
60px) lands in the card's horizontal scroll region: 17 segments × 2 sides = 34 controls, which matches the scorer
count. The checkbox aria-label ends in English "occluded" (U-1015 text). Not traced further.
HYPOTHESIS: the event is attached to unrelated tasks (pelvic 802d04f6063d, venous 03a18f254204, carotid 831ea4f62f94),
all citing the `/arterialLE` URL, which is a walker screen-batch attribution artefact rather than 10 separate problems.
Kill-criterion: in the walks' `screens-*.json`, those tasks' screen records point at `/arterialLE`. If they point at
their own routes, kill it.
**(c) Sibling pattern:** CONFIRMED (partial) — `CarotidSegmentTable` sits full-width (`CarotidForm.tsx:721`, no
grid), so its `min-width: 940px` fits at 1440.
**Merges with:** X-DIAG (arterial layout), 10 scorer events (one cause).
**Effort signal:** S — trim the column widths or give the table the full row.

---

## U-1004 — English strings in the Georgian UI (13 jargon events across both walks)

**Runtime evidence:** "Complete all studies…", "IN PROGRESS", "Edit", "{age} y", "Anterior view" (arterial / pelvic),
"Surface", NASCET "Right ICA".

**(a) Already exists?** CONFIRMED — a parity checker exists (`scripts/check-i18n.ts`), but it checks only ka/en/ru key
parity (`:4-9`).
**(b) Cause:** CONFIRMED — the keys are absent from every locale (merged ka lookup returned `None` for
`formActions.completeAllFirst`, `encounter.listPage.eyebrow`, `encounter.list.edit`, `encounter.banner.ageYears`,
`anatomy.view.le-arterial-anterior`, `carotid.param.plaqueSurface`, `carotid.nascetSummary.rightIca`). `t(key, 'English
fallback')` then renders the fallback, e.g. `FormActions.tsx:496`.
- Defect: missing keys.
- Amplifier: `i18n:check` passes because missing-everywhere is still "in parity". There is no used-key scan.
**(c) Sibling pattern:** CONFIRMED — the per-study deep-merged locale files (`src/translations/<study>/ka.json`) are where
the keys go.
**Merges with:** U-1002 tooltip, U-1005 (PDF labels, same mechanism), U-1006 (the NASCET chip is a hard-coded English
fallback, `NASCETPicker.tsx:151`, not traced further).
**Effort signal:** S for the keys. M for a used-key scanner.

---

## Collapse summary

| # | Distinct cause | Shared fix point (file:line) | Findings it covers | Label |
|---|---|---|---|---|
| C1 | Component CSS modules load before Mantine; Mantine `filled` root wins | `src/main.tsx:4` vs `:8` (+ `EMRButton.tsx:395-419`) | X-BTN (4 study screens + intake), U-1031 colour | CONFIRMED (live rule trace) |
| C2 | Light page token = card token | `src/styles/theme.css:149-150` | X-ELEV (all 5 screens) | CONFIRMED |
| C3 | Save state computed per form, not from `persist` | `EncounterContext.tsx:137-145` → `FormActions.tsx:485-536` (4 callers) | X-DOT, U-1017, U-1036 | CONFIRMED |
| C4 | Arterial autosave re-arms on its own encounter change (no ref guard) | `ArterialLEForm.tsx:374-389` | U-1003 amplifier, X-DOT flicker | CONFIRMED (live) |
| C5 | Whole-draft last-writer-wins, no cross-tab check | `encounterStore.ts:139-146` | U-1003 | CONFIRMED |
| C6 | Venous PDF table numeric-only | `pdf/sections/FindingsTable.tsx:128-133` | U-1033, U-1011 | CONFIRMED |
| C7 | Venous FHIR never emits `competencyOverride` | `fhirBuilder/observations/venous.ts:59-130` | U-1033 (FHIR side), U-1027 latent | CONFIRMED |
| C8 | One segment split across two tables; numeric one `headless` | `form/SegmentAssessmentCard.tsx:206-235` + `ReflexTimeTable.tsx:205` | U-1022 | CONFIRMED |
| C9 | 88px label column + nowrap | `form/SegmentTable.module.css:108, 168-182` | U-1037 | CONFIRMED (live) |
| C10 | Iliac visible label lacks side; card collapse not compacted (×3 copies) | `IliacCavalTable.tsx:103` (+ 3 `*.module.css` media blocks) | X-TABLE | CONFIRMED |
| C11 | Button group `flex-shrink: 0` | `form/FormActions.module.css:73` | U-1014 forms, critic 375 ×4 screens | CONFIRMED (live) |
| C12 | Intake footer row no wrap + non-shrinking resume | `EncounterIntake.module.css:1003-1012, 1039-1040` | U-1014 intake | CONFIRMED (live) |
| C13 | Diagram stacked after table in each form | `VenousLEForm.tsx:1200-1247`, `ArterialLEForm.tsx:770-841`, `CarotidForm.tsx:721-743`, iliac | X-DIAG ×4 | CONFIRMED |
| C14 | Pre-Command empty state + ribbon | `form/RecommendationsBlock.tsx:94-103`, `.module.css:22, 94` | X-RECS ×3 screens | CONFIRMED |
| C15 | Banner `overflow: hidden` clips in-flow menu | `EncounterContextBanner.module.css:34` | U-1028 | CONFIRMED |
| C16 | R/L/bilateral share one label key; venous form hard-codes bilateral | `EncounterContextBanner.tsx:48-62`, `VenousLEForm.tsx:151, 783` | d5c84bc79cf3, (U-1002 hyp.) | CONFIRMED / HYPOTHESIS (slot effect) |
| C17 | "New study" label on a RESET action | `VenousLEForm.tsx:1188-1197` (+ arterial, carotid copies) | U-1031 wording | CONFIRMED |
| C18 | No bulk-normal action (data exists) | `iliac-pelvic-venous/templates.ts:21-22` | U-1030, 85025cca62ba | CONFIRMED |
| C19 | `inconclusive` relabelled "perforator" | `venous-le/config.ts:294-296`, `theme-colors.ts:118` | U-1027, critic Tailwind blue | CONFIRMED |
| C20 | TBI graded with ABI bands | `arterial-le/abiCalculator.ts:96-97` | U-1026 | CONFIRMED |
| C21 | Pressure columns L, R | `arterial-le/SegmentalPressureTable.tsx:108-143` | U-1023 | CONFIRMED |
| C22 | Global dark `.tabler-icon { color: #fff !important }` | `theme.css:3728-3734` | U-1021 (stepper/moon = hyp.) | CONFIRMED / HYPOTHESIS |
| C23 | Silhouette fill not themed | `anatomy/AnatomyView.tsx:180-183` | U-1024 | CONFIRMED |
| C24 | All-or-nothing unified export gate | `form/FormActions.tsx:288-297, 493` | U-1002, 3088c351aa84 | CONFIRMED |
| C25 | No scroll reset on navigation | shell (no file has one); `EncounterIntake.tsx:437, 446` | U-1029, U-1035 (part) | CONFIRMED |
| C26 | Resume navigates to `/` | `EncounterIntake.tsx:467-469` | U-1016 | CONFIRMED |
| C27 | Arterial table min-width 890 in a `lg:7` column | `ArterialSegmentTable.module.css:66-69` | U-1015, 34-control events ×10 tasks | CONFIRMED (attribution = hyp.) |
| C28 | Keys missing everywhere; checker parity-only | locale files; `scripts/check-i18n.ts:4-9` | U-1004 (+ U-1002 tooltip, U-1005 mechanism) | CONFIRMED |

**Highest-leverage collapses for the architect:**
- **C1 is one line and repaints every screen.** The "7–12 equal primary buttons" and the "danger confirm same blue as
  Cancel" are not design choices. The quiet variants are written and passed, and Mantine's stylesheet overrides them.
  Fix C1 before any `/ui-excellence` button work, or that work will be invisible.
- **C2 is one token** for the elevation finding on all five screens.
- **`FormActions` (1 file, 4 callers) holds three causes:** C3 indicator, C11 375 overflow, C24 export gate.
- **C4 is a newly found live defect.** An idle arterial tab rewrites the encounter every ~0.5 s, which turns U-1003 from
  "two tabs edited at once" into "any open arterial tab erases the other tab". Its 4-line fix already exists in
  `CarotidForm.tsx:396-406`.
- **C6 + C7:** a clinician-entered reflux or compressibility finding reaches neither the PDF table nor a FHIR Observation.
  It exists only as diagram colour and a QR JSON string.

**Already-built surfaces found (finished but hidden or unwired):**
1. EMRButton secondary/ghost/subtle/danger variants (`EMRButton.module.css`), hidden by C1.
2. `ConfirmDialog` `destructive` (already passed at `VenousLEForm.tsx:1301`), hidden by C1.
3. `renderSingleStudyPdfBlob` (`FormActions.tsx:327`, ~34 lines), unreachable in multi-study encounters.
4. `NORMAL_CAVAL` (`iliac templates.ts:21-22`), not wired to a bulk action.
5. Right/left venous study types (types, route, CPT 93971, FHIR, projection), unreachable (clipped menu, identical
   labels) and not honoured by the form.
6. ReflexTimeTable segment-label cell (`:205-214`), suppressed by `headless`.
7. Iliac `fullLabel` with side (`IliacCavalTable.tsx:98-99`), used only in aria.
8. `encounter.updatedAt` (stamped on every write), unused by the save indicator.
9. `OngoingVisitsPanel.handleResume` (`:121-131`), not used by the footer resume button.
10. PDF pressure table R-first order (`pdf/sections/SegmentalPressureTable.tsx:219`), the form not aligned with it.
11. HYPOTHESIS: `EMRTable` sticky-left columns (982 lines, zero study callers).

## Verdict: PASS — 27 findings traced, 28 distinct causes, 10 already-built surfaces found
