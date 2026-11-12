# ux-ia-architect — simplification plan, run `angio-module-2026-11-12`

Scope: the whole angio app (intake, venousLE, arterialLE, carotid, iliacPelvicVenous, PDF report), with two personas walked in the Georgian UI at 1280×720.
Inputs: both scoreboards (`qa-reports/ux/runs/angio-module-2026-11-12-{sono,phys}/scoreboard.json`, 46 tasks, 272 friction events), the step-level walks for the tasks cited, the task models, `source-trace.md` (28 causes, each CONFIRMED or HYPOTHESIS), `findings.jsonl` (U-1000…U-1037), `critic/*.json` (5 screens × 4 variants), `M-real-report.md`, `decisions.md` (D1–D8, sign-off S1–S6).
Contracts: `ux-contracts.md` §1 budgets, §3.6 ranking, §3.8 schema, §4 constraints. Every move below was checked against all nine §4 constraints (summary at the end).

**How to read the order.** The first 7 moves are data-loss (S1) and clinical-safety (S2) moves. They sit **above** the ranking (SKILL Phase 2) and save 0 clicks, which is said plainly in each block. After them comes the §3.6 ranking: `safetyClass` (high-alert before routine), then `taskSeverity` as scored, then clicks saved per shift. Clicks never move a move across a band. Moves 021–027 are the cross-screen UI moves from the critics, listed for the UI-X lane and its fences.

**Headline numbers (from the scorer):** measured clicks/shift sonographer 279 vs budgeted 490, physician 340 vs 656. 7 tasks over budget, 2 failed discoverability, 3 failed blocked, 1 CRITICAL (safety floor on high-alert `3088c351aa84`). The top-10 moves save **181 clicks/shift**; 175 of them come from one move (UX-ANGIO-009). That is 175 of the 619 clicks measured across both shifts (279 + 340), about 28%.

## Part A — Classification (diagnosis before prescription)

Guideline rows are from `ux-guidelines.csv` (99 rows; see Method notes for its location). Severities are quoted as the scorer wrote them. `floorApplied` is honoured: `eec519062b89` is CRITICAL by the §3.5 safety floor, and it is not discounted for being 2×/shift. For `overload` and `no-document-structure` the matching composition rule from DESIGN-DIRECTION §"Composition, hierarchy & severity" is named so the design-critic and this plan use the same words.

### A.1 Walk events (all 272)

| # | Events (ids, count) | Scored severity | Guideline / heuristic | Composition rule | Plain-language pattern | → Move |
|---|---|---|---|---|---|---|
| A1 | `eec519062b89` blocked (3088c351aa84) | CRITICAL, floorApplied | CSV 90 · No Results ("dead ends frustrate users"); Nielsen: User control and freedom | — | A finished report is held back by an unfinished study in the same visit. | 008 |
| A2 | `bbe4636adb29` blocked (7ddfddbf4c8b) | HIGH | CSV 90 · No Results; Nielsen: Flexibility and efficiency of use | — | There is no print step in the app; printing depends on the browser viewer (walker measurement limit, re-check by hand). | 014 |
| A3 | `1e5c76f1a5b8` discoverability, `13598459d7fb` wrong-turn, 15 dead clicks (85025cca62ba) | HIGH | CSV 91 · Bulk Actions; Nielsen: Consistency and standards | — | A normal pelvic study has to be entered row by row; venous has a one-press "all normal". | 011 |
| A4 | `b54524c8c95e`, `320e85257934`, `e922a6029c88` (d5c84bc79cf3); `1f58b5690bd5`, `f77ed177df03` (17e266d15e6a) | HIGH / MEDIUM / LOW | CSV 16 · Overflow Hidden; Nielsen: Recognition rather than recall | — | The one-leg study exists, but its only door is cut off and right and left share one name. | 012 (+005 for e922a6029c88) |
| A5 | `bdbb5e5fd309` blocked, `7aca4e55bc9e` duplicate-path (fd309042464d) | HIGH / MEDIUM | Nielsen: Visibility of system status | — | The pelvic diagram is a fixed picture, so pelvic findings never show on it, and one vein can be recorded in two places. | none: product/clinical (do-not-do 4, 5) |
| A6 | off-viewport-control ×8 real: `179bd47bec66`, `05cf9da7e989`, `4b3965b2f8c4`, `6040998a19a6`, `43c5f78be158`, `bc6f477e5f74`, `fa8d4b75efb4`, `9003ea41e04d` | HIGH | CSV 69 · Horizontal Scroll; CSV 71 · Table Handling | — | The arterial table is wider than its box, so the occlusion tick-boxes sit out of sight. | 015 |
| A7 | off-viewport-control ×3 carried in at step 1: `15bf88a468d8`, `4b299a79f329`, `42143e4ad29c` | HIGH | same as A6 (same arterial screen) | — | Instrument effect: the previous task's arterial screen is carried into step 1 (Method notes). | 015 (cause); Method note |
| A8 | jargon ×15 (sono 6, phys 9) | MEDIUM | CSV 85 · Date Formatting; CSV 40 · ARIA Labels; Nielsen: Match between system and the real world | — | English words, US-style dates and wrong button names inside the Georgian screens and report. | 020 (10), 008 (2), 010 (1), 027 (1), do-not-do 2 (1) |
| A9 | duplicate-path ×5: `350961671844`, `e524b63df22a`, `2bc06216a2b6`, `7aca4e55bc9e`, `a11e114fcb08` | MEDIUM | Nielsen: Consistency and standards; CSV 35 · Confirmation Dialogs (for 2bc06216a2b6) | — | Two doors to the same place, and one of them does nothing (resume) or does something else (reset). | 009, 005; do-not-do 4, 7 |
| A10 | wrong-turn ×20 + backtrack-cluster ×3 | MEDIUM | Nielsen: User control and freedom | — | Real (4 + 2 clusters): add-study menu `1f58b5690bd5`, reset button `e922a6029c88`, "back to studies" landing on visit details `d7b755b1d547`, pre-fix pelvic template `13598459d7fb`; clusters `320e85257934`, `bf01972457d4`. The other 16 + `2a1a6da22491` are instrument effects (Method notes). | 012, 005, 008/020, 011 |
| A11 | over-budget ×7: `01bc564a7b8b`, `dc6225db3f65`, `f77ed177df03`, `a7dcd139d8ab`, `22d4eea730ea`, `44c3b6343d4c`, `250687f42cf5` | LOW | Nielsen: Flexibility and efficiency of use | — | Getting back into an open visit costs a click before any work starts; on top of that come task-specific causes. | 009 (all); 012, 016, 019; SVP → do-not-do 3 |
| A12 | dead-click ×63 (sono 42, phys 21) | LOW | CSV 30 · Active States; Nielsen: Visibility of system status | — | Clicks that seem to do nothing. Most are instrument blind spots (dropdowns, chips, new-tab exports); the real ones are the dead footer resume `5160fff884bb`, the disabled download `773b88b701a8`, and the CEAP header `b29ecdc3af06` (hypothesis). | 009, 008, 016 |
| A13 | overload ×72 (every study screen; 306–450 controls) | MEDIUM | CSV 71 · Table Handling | **density tier**: a deep-dive screen where every empty row keeps full footprint; also **hierarchy** (nothing wins: the diagram sits 1,500–3,000 px away) | The page is bigger than its content: empty rows are as tall as filled ones, and the picture is far from the table. | 026, 025 |
| A14 | no-document-structure ×71 | MEDIUM | CSV 39 · Heading Hierarchy | **hierarchy**: 0 headings, so no section names itself | Hundreds of controls and not one heading, so the page has no outline. | 018 |

Count check: discoverability 2 + blocked 3 + off-viewport 11 + jargon 15 + duplicate-path 5 + wrong-turn 20 + backtrack-cluster 3 + over-budget 7 + dead-click 63 + overload 72 + no-document-structure 71 = **272 events, all classified**.

### A.2 Ledger, standing-check and critic findings behind the safety and UI moves

| Finding | Guideline / heuristic | Composition rule | Plain-language pattern | → Move |
|---|---|---|---|---|
| U-1003 (two tabs), C4 idle rewrite | CSV 33 · Error Feedback; Nielsen: Error prevention | — | Two open copies of a visit silently erase each other. | 001 |
| U-1017, U-1036, critic save dot | CSV 33 · Error Feedback; CSV 61 · Submit Feedback; Nielsen: Visibility of system status | — | The "saved" line can be wrong in both directions, and a real failure is never shown. | 002 |
| U-1033, U-1011 | CSV 37 · Color Only; Nielsen: Consistency and standards | — | The paper report shows a recorded finding only as colour on the diagram. | 003 |
| U-1022, U-1037, X-TABLE (iliac side), U-1023 | CSV 71 · Table Handling; CSV 84 · Truncation; Nielsen: Error prevention | **no duplicate primary data** (row identity) | Some rows do not say which leg or vein they belong to. | 004 (+026) |
| U-1031 | CSV 35 · Confirmation Dialogs; Nielsen: Error prevention | — | A button that looks like "add" erases the study. | 005 (+021) |
| U-1026 | Nielsen: Match between system and the real world | — | A normal toe value is graded as disease. | 006 (S6) |
| U-1027 | Nielsen: Consistency and standards | — | The option says perforator; the record says inconclusive. | 007 (S7) |
| U-1029, U-1035 (Edit scroll) | Nielsen: Visibility of system status | — | A study opens half-way down the page. | 017 |
| X-BTN | Nielsen: Aesthetic and minimalist design | **hierarchy** (one primary) | Every button shouts, so none leads. | 021 |
| U-1021, U-1024 | CSV 36 · Color Contrast | — | In dark mode unchosen looks chosen, and diagram labels vanish. | 022 |
| X-ELEV | CSV 95 · Depth Layering | **hierarchy** | Page and cards are the same white. | 023 |
| U-1014 | CSV 69 · Horizontal Scroll | — | On a phone the page is wider than the screen. | 024 |
| X-DIAG | Nielsen: Recognition rather than recall | **density tier** (one focal element) | The picture is never beside the table it explains. | 025 |
| X-TABLE (compaction), U-1022 (merge) | CSV 71 · Table Handling | **density tier** | Empty rows are as big as filled ones. | 026 |
| X-RECS | CSV 79 · Empty States | **density tier** (empty-state parity) | An empty section is the loudest box on the page. | 027 |

## Top-10 moves

### UX-ANGIO-001 — Stop an open visit from silently erasing edits made in another tab  `TOP-10: true`

**Band:** S1 data-loss (above the ranking) · **Type:** `remove` · **Label:** CONFIRMED (C4 live sample, C5 code) · **Effort:** M · **Risk tier:** medium · **Fence:** W1-A (L1, L2) · W1-B (L3)

**In plain language.** Today, if one visit is open in two browser tabs, the older tab quietly overwrites the newer tab's work. Worse, an arterial form that is merely left open rewrites the whole visit about twice a second, so it erases the other tab within half a second without anyone typing. After this change an idle form writes nothing, and a tab that is out of date says so instead of overwriting.

**Evidence.**
- Tasks: — (no walk task; ledger / critic / standing-check evidence)
- Events: —
- Screenshots / artefacts: —
- Prior findings subsumed: U-1003
- Source trace: C4 `ArterialLEForm.tsx:374-389` (live: localStorage updatedAt every ~520 ms with no input); C5 `encounterStore.ts:139-146` whole-draft last-writer-wins; the only `storage` listener in src is `mantineTheme.ts:205-210`. Standing check "Idempotency, two tabs" FAIL (M-real-report.md).

**Clicks saved per shift.**
No walk task measures it (it is a standing-check failure). **0 clicks/shift** — this move sits above the ranking because it loses clinical data, not because it saves clicks.

**Risk.** Medium. It touches the one place every save passes through. A freshness check that is too strict could refuse a legitimate save, so layer 2 only detects and warns before anything is blocked. Layer 1 on its own is low risk: it copies a guard that already runs on carotid and pelvic.

**Do not touch.**
- CLAUDE.md persistence rule: every mutation still persists immediately through `saveEncounter`. The loop fix compares state identity (the carotid `lastPersistedRef` pattern). It must not add a debounce or idle timer, and it removes the existing 500 ms one.
- Dual-write stays: IndexedDB is the truth, localStorage is the sync read-cache, key prefix `encounter-<uuid>` is unchanged, and storage keys are read only through `src/constants/storage-keys.ts`.
- No state library (CLAUDE.md): the stale flag lives in `EncounterContext`.
- §4.6: no field-by-field merge in this move. The one policy is block and reload (orchestrator records it in decisions.md).

**Staging (each layer ships and reverts on its own).**
1. L1 (W1-A, 1 file) `ArterialLEForm.tsx`: replace the self-re-arming mirror effect (:374-389) with the `lastPersistedRef` guard copied from `CarotidForm.tsx:386-406` (persist only when `state` changed by reference, no setTimeout). Proof: sample localStorage `updatedAt` on an idle arterial tab for 10 s, and it must not change.
1. L2 (W1-A, 2 files) `EncounterContext.tsx` + `encounterStore.ts`: remember the `updatedAt` this tab last loaded or wrote. In `persist()`, if the stored draft is newer (another tab wrote it), skip the write and set `staleFromOtherTab`. Subscribe to the window `storage` event for this encounter key (copy `mantineTheme.ts:205-210`) to raise the flag early. Ship detect-only first, behind a constant.
1. L3 (W1-B, 1 file) `FormActions.tsx`: when the flag is set, show a persistent Georgian notice ("ეს ვიზიტი სხვა ფანჯარაში შეიცვალა — განაახლეთ გვერდი") with a reload action. Keys go to W1-H. Then switch the L2 write block on.

**Affected files (verified to exist).** `src/components/studies/arterial-le/ArterialLEForm.tsx`, `src/contexts/EncounterContext.tsx`, `src/services/encounterStore.ts`, `src/components/form/FormActions.tsx`

**Done when.** An idle arterial tab makes 0 writes in 10 s. With two tabs on one visit, tab B's carotid note survives tab A's edit, and tab A shows the reload notice instead of writing. The standing check "Idempotency, two tabs" passes. A Vitest case covers the freshness check.

**Handoff → `frontend-designer`**

```text
Angio repo /Users/toko/Desktop/medimind-angio, fence W1-A (+ FormActions.tsx in W1-B for L3). Data-loss fix, two causes (source trace C4, C5, both CONFIRMED):
1. `src/components/studies/arterial-le/ArterialLEForm.tsx:374-389`: the mirror effect re-arms itself because `setStudyState` returns a new `encounter`. An idle arterial tab rewrites the whole visit about every 520 ms. Replace it with the exact `lastPersistedRef` guard in `src/components/studies/carotid/CarotidForm.tsx:386-406` (no setTimeout: CLAUDE.md says every mutation persists immediately). Keep `setLastSavedAt` behaviour.
2. `src/services/encounterStore.ts:139-146` + `src/contexts/EncounterContext.tsx:137-145`: whole-draft last-writer-wins. Track the updatedAt this tab last loaded or wrote. In persist(), if the stored record is newer, do NOT write and expose `staleFromOtherTab`. Add a `storage` event subscription for the encounter key (pattern: `src/styles/mantineTheme.ts:205-210`). Ship detect-only first.
3. After 1-2 land: `src/components/form/FormActions.tsx` shows a persistent notice + reload action when stale. Send the ka/en/ru keys to the i18n fence; do not edit translation files yourself.
Rules: no new state library, no debounce, storage keys only via src/constants/storage-keys.ts, EMR wrappers + --emr-* tokens only. Prove in Georgian UI: idle arterial tab = 0 writes in 10 s; the two-tab repro from M-real-report.md no longer loses tab B's note. Name the Vitest files you added; do not run the full suite.
```

### UX-ANGIO-002 — Make the 'saved' line tell the truth, and show a failed save  `TOP-10: true`

**Band:** S1 data-loss (above the ranking) · **Type:** `relabel` · **Label:** CONFIRMED (C3) · **Effort:** M · **Risk tier:** low · **Fence:** W1-A (L1) · W1-B (L2) · W2-<study> (L3)

**In plain language.** The small save status at the bottom of every study can be wrong in both directions. Venous always shows a red 'unsaved' dot next to 'last saved'. Carotid and pelvic show a green dot before anything is saved. Every study says 'not saved yet' after a reload, although the draft is safe. And a save that really fails is never shown. After this change the line reads the one save time the app already stores, and a failed save stays on screen until it is fixed.

**Evidence.**
- Tasks: — (no walk task; ledger / critic / standing-check evidence)
- Events: —
- Screenshots / artefacts: `documentation/level-up/runs/angio-module-2026-11-12/screens/venous-le-default.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/carotid-default.png`
- Prior findings subsumed: U-1017, U-1036, critic save-dot status-colour (venous, arterial, carotid, iliac)
- Source trace: C3: `FormActions.tsx:536` dot; `.dotDirty` = `--emr-warning` red (`FormActions.module.css:52-56`); venous effect order `VenousLEForm.tsx:776-843`; hard-coded `hasUnsavedChanges={false}` `CarotidForm.tsx:796`, `IliacPelvicVenousForm.tsx:645`; `useState<Date|null>(null)` in all 4 forms; failure only `console.warn` `EncounterContext.tsx:141-143`, LS quota `encounterStore.ts:100-102`.

**Clicks saved per shift.**
No click cost. **0 clicks/shift.** It sits above the ranking because a failed save is invisible (standing check "Instant confirmation" FAIL).

**Risk.** Low. One shared bar (4 callers) reads two values the context already has. The old props stay accepted during layers 1-2, so each step can be reverted on its own.

**Do not touch.**
- §4.1 Command style: the dot uses existing tokens only: neutral `--emr-text-secondary` when clean, `--emr-primary` when changes are pending, `--emr-warning` only for a real save failure. No new colour.
- `EncounterContext.persist` stays the single write funnel. Forms stop computing save state; they do not start writing differently.
- Standing check "Instant confirmation": saving never blocks the form, and a failure never clears answers.

**Staging (each layer ships and reverts on its own).**
1. L1 (W1-A, 2 files) `EncounterContext.tsx` + `encounterStore.ts`: expose `{ lastSavedAt: encounter.updatedAt, saveError }`. The `persist()` catch and the localStorage quota path set `saveError` (keep the console.warn).
1. L2 (W1-B, 2 files) `FormActions.tsx` + `FormActions.module.css`: read `lastSavedAt` and `saveError` from the context instead of props. Use the dot colours above. A failure shows a persistent Georgian warning. Old props are accepted and ignored.
1. L3a (W2-venous, W2-arterial; 1 file each) `VenousLEForm.tsx`, `ArterialLEForm.tsx`: delete the local lastSavedAt/dirty pairs (this ends the venous effect-order bug).
1. L3b (W2-carotid, W2-iliac; 1 file each) `CarotidForm.tsx`, `IliacPelvicVenousForm.tsx`: delete the hard-coded `hasUnsavedChanges={false}` and the local lastSavedAt.

**Affected files (verified to exist).** `src/contexts/EncounterContext.tsx`, `src/services/encounterStore.ts`, `src/components/form/FormActions.tsx`, `src/components/form/FormActions.module.css`, `src/components/studies/venous-le/VenousLEForm.tsx`, `src/components/studies/arterial-le/ArterialLEForm.tsx`, `src/components/studies/carotid/CarotidForm.tsx`, `src/components/studies/iliac-pelvic-venous/IliacPelvicVenousForm.tsx`

**Done when.** After a reload every study shows the stored save time. A forced IndexedDB failure shows the warning and keeps every answer. The dot is never red unless a save failed. The standing checks "Draft persistence" and "Instant confirmation" pass.

**Handoff → `frontend-designer`**

```text
Angio repo, fences W1-A (context) then W1-B (FormActions), then one layer per study fence. Source trace C3 (CONFIRMED). One save indicator, four separate defects:
- `src/components/form/FormActions.tsx:536` dot: dirty = `--emr-warning` red (`FormActions.module.css:52-56`), clean = green.
- Venous effect order (`VenousLEForm.tsx:776-789` then `:836-843`) leaves it dirty forever.
- Carotid/iliac pass `hasUnsavedChanges={false}` (`CarotidForm.tsx:796`, `IliacPelvicVenousForm.tsx:645`).
- After a reload every form starts `lastSavedAt = null`, so it shows `venousLE.actions.neverSaved`.
- Save failures only console.warn (`EncounterContext.tsx:141-143`, `encounterStore.ts:100-102`).
Do: (1) EncounterContext exposes `lastSavedAt` (= encounter.updatedAt) and `saveError`. (2) FormActions reads both from context: neutral dot when clean, --emr-primary when pending, --emr-warning only on saveError, plus a persistent Georgian failure message. (3) Per study, delete the local save-state pairs. Keys go to the i18n fence. Prove in ka: reload shows the real time; a forced IDB reject shows the warning and keeps the answers.
```

### UX-ANGIO-003 — The venous report prints every finding the clinician recorded  `TOP-10: true`

**Band:** S2 clinical-safety (above the ranking) · **Type:** `relabel` · **Label:** CONFIRMED (C6 PDF table, C7 FHIR); which columns print = sign-off S4 · **Effort:** M · **Risk tier:** medium · **Fence:** W1-C (L1, L3) · W3-perforator (L2, after UX-ANGIO-007)

**In plain language.** When a sonographer marks a vein as refluxing, or as not fully compressible (a clot sign), the paper report's table prints a dash and only the diagram turns red. A reader who goes by the table, or who cannot tell red from grey, misses the finding, and the exported data does not carry it at all. After this change the table prints the recorded value in words, the way the pelvic report already does.

**Evidence.**
- Tasks: `2b116c3dbda9`
- Events: —
- Screenshots / artefacts: `qa-reports/ux/runs/angio-module-2026-11-12-phys/walks/vascular-physician/pdfs/t9-download.pdf`, `documentation/level-up/runs/angio-module-2026-11-12/pdf/m-real-combined-4studies.pdf`
- Prior findings subsumed: U-1033, U-1011
- Source trace: C6 `pdf/sections/FindingsTable.tsx:128-133` drops categorical-only rows; columns `:171-204` are numeric only. C7 `fhirBuilder/observations/venous.ts:59-130` never emits `competencyOverride`. Sibling: `IliacPelvicVenousFindingsTable.tsx:102-121,196-204`; FHIR sibling `observations/iliac.ts:180-185`.

**Clicks saved per shift.**
No click cost. **0 clicks/shift.** It sits above the ranking because the deliverable under-reports a recorded clot or reflux finding.

**Risk.** Medium. It touches the printed deliverable and the exported data. The label strings already exist. Choosing which columns print is a clinical call (S4), and the data-export layer waits for the perforator decision (UX-ANGIO-007).

**Do not touch.**
- §4.3: print the existing labels (`buildReportLabels.ts:142-146`). No new clinical wording. Which columns print is sign-off S4 in decisions.md, not an agent's call.
- §4.4: `npm run validate:fhir` stays green, and the PDF and the screen show the same findings (diagram unchanged).
- The FHIR layer waits for UX-ANGIO-007. Exporting `competencyOverride` today would publish 'inconclusive' for what the clinician picked as 'perforator'.
- `buildReportLabels.ts` carries uncommitted clinician-feedback WIP: build on top of it, never revert it.

**Staging (each layer ships and reverts on its own).**
1. L0 Sign-off S4 answered (who, what, date, source in decisions.md): which categorical values print, and in which columns.
1. L1 (W1-C, 1-2 files) `FindingsTable.tsx`: count categorical fields in the row filter (:128-133) and add the signed-off columns, rendering the existing labels the way `IliacPelvicVenousFindingsTable.tsx:102-121,196-204` does. Touch `buildReportLabels.ts` only if a label is not yet exposed.
1. L2 (W1-C, 1 file, blocked on UX-ANGIO-007) `observations/venous.ts`: emit a competency Observation for `competencyOverride`, copying `observations/iliac.ts:180-185`. `npm run validate:fhir`.
1. L3 Unit test with a categorical-only row (GSV reflux override, CFV partial compressibility). Re-export the walk's PDF and compare it with `t9-download.pdf`.

**Affected files (verified to exist).** `src/components/pdf/sections/FindingsTable.tsx`, `src/components/pdf/buildReportLabels.ts`, `src/services/fhirBuilder/observations/venous.ts`

**Done when.** The GSV reflux override and the CFV partial compressibility appear as text in the venous PDF table, and the diagram is unchanged. S4 is signed. After UX-ANGIO-007: a competency Observation is in the Bundle and validate:fhir is green.

**Handoff → `frontend-designer`**

```text
Angio repo, fence W1-C. Clinical-safety: the venous PDF table drops recorded categorical findings (source trace C6/C7, CONFIRMED).
- `src/components/pdf/sections/FindingsTable.tsx:128-133` skips rows with no numeric value. Columns (`:171-204`) are Segment / Reflux s / AP / Depth only.
- Copy the categorical-column pattern from `src/components/pdf/sections/IliacPelvicVenousFindingsTable.tsx:102-121, 196-204` (hasData counts categorical fields; vlabel(ns, value)). Labels exist at `src/components/pdf/buildReportLabels.ts:142-146`.
- WAIT for sign-off S4 (decisions.md) for the exact column set. Do not invent wording.
- FHIR (`src/services/fhirBuilder/observations/venous.ts`, pattern `observations/iliac.ts:180-185`) is a separate layer, blocked until UX-ANGIO-007 (perforator code) is decided.
buildReportLabels.ts has uncommitted WIP: build on top. Prove by exporting a venous PDF with GSV reflux + CFV partial compressibility; both must print as text. Run `npm run validate:fhir` if you touch FHIR. Name your Vitest files.
```

### UX-ANGIO-004 — Every segment row shows its leg and its name, right side first  `TOP-10: true`

**Band:** S2 clinical-safety (above the ranking) · **Type:** `relabel` · **Label:** CONFIRMED (C8 venous cards, C9 venous badge, C10 iliac side, C21 arterial order) · **Effort:** S · **Risk tier:** low · **Fence:** W1-C (L1, L2) · W1-F (L3, L4)

**In plain language.** In four places a clinician can type a value without seeing which leg or which vein it belongs to. On a tablet or phone, the venous measurement cards carry no vein name. On long venous rows the right/left badge is painted over. Pelvic cards show the side only once, at the top of a long list. And the arterial pressure table puts Left before Right while everything else is Right first. Each fix un-hides a label that is already built.

**Evidence.**
- Tasks: `acfa2ced1941`, `ad9b03d7d7d3`, `802d04f6063d`, `51f8fdd2aebb`
- Events: `674658059cad`
- Screenshots / artefacts: `documentation/level-up/runs/angio-module-2026-11-12/screens/venous-le-768.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/venous-le-375.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/iliac-pelvic-venous-768.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/arterial-le-default.png`
- Prior findings subsumed: U-1022 (S layer), U-1037, U-1023, X-TABLE (iliac side part)
- Source trace: C8 `SegmentAssessmentCard.tsx:206-235` + `ReflexTimeTable.tsx:205-214` (`headless` hides the label); C9 `SegmentTable.module.css:108, 168-182` (88px column); C10 `IliacCavalTable.tsx:103` (fullLabel with side built at :98-99, aria only); C21 `arterial-le/SegmentalPressureTable.tsx:108-143` (PDF sibling is R-first at :219).

**Clicks saved per shift.**
No click cost. **0 clicks/shift.** It sits above the ranking because it prevents wrong-side or wrong-segment entry.

**Risk.** Low. Every layer shows markup that already exists, or reorders two columns. Georgian side words need room, so each layer gets a 375 re-shoot.

**Do not touch.**
- §4.3: segment names and abbreviations are unchanged. Only their visibility changes.
- §4.5: Georgian side words (მარჯვენა / მარცხენა) must not clip at 375. Give the label column room (the arterial 180px / carotid 200px precedent); never shrink the type.
- Aria labels already carry the full id (`ReflexTimeTable.tsx:218`, `IliacCavalTable.tsx:98-99`). Keep them.

**Staging (each layer ships and reverts on its own).**
1. L1 (W1-C, 2 files) `ReflexTimeTable.tsx` + `ReflexTimeTable.module.css`: below the lg breakpoint, render the existing segment label + R/L badge (:205-214) even when `headless`.
1. L2 (W1-C, 1 file) `SegmentTable.module.css:108`: widen the 88px label column, or put the badge before the label (:168-182), so the badge is never painted over.
1. L3 (W1-F, 1 file) `IliacCavalTable.tsx:103`: render `fullLabel` (built at :98-99) as the visible cell label.
1. L4 (W1-F, 1-2 files) `arterial-le/SegmentalPressureTable.tsx:108-143` (+ its `.module.css` if the grid is order-bound): R column first, matching the PDF table.

**Affected files (verified to exist).** `src/components/form/ReflexTimeTable.tsx`, `src/components/form/ReflexTimeTable.module.css`, `src/components/form/SegmentTable.module.css`, `src/components/studies/iliac-pelvic-venous/IliacCavalTable.tsx`, `src/components/studies/arterial-le/SegmentalPressureTable.tsx`, `src/components/studies/arterial-le/SegmentalPressureTable.module.css`

**Done when.** At 768 and 375 every venous numeric card shows its segment and side. At 1440 the GSV rows show an unobstructed R/L badge. Every pelvic card title carries its side. Arterial pressures read R then L. The design-critic re-shoot shows no anonymous card.

**Handoff → `frontend-designer`**

```text
Angio repo. Laterality safety, four S layers (source trace C8, C9, C10, C21, all CONFIRMED). Each layer un-hides existing markup:
L1 (fence W1-C) `src/components/form/ReflexTimeTable.tsx:205-214`: the segment label + R/L badge render only when `!headless`. Below Mantine lg (1200px) the tables stack, so render it there too (media query in `ReflexTimeTable.module.css`).
L2 (W1-C) `src/components/form/SegmentTable.module.css:108` (`88px` label column) + `:168-182` (nowrap): the badge overflows into the next cell. Widen the column or put the badge before the label.
L3 (W1-F) `src/components/studies/iliac-pelvic-venous/IliacCavalTable.tsx:103`: show `fullLabel` (built at :98-99) instead of `segLabel`.
L4 (W1-F) `src/components/studies/arterial-le/SegmentalPressureTable.tsx:108-143`: columns are hard-coded L, R. Make them R, L like the PDF (`components/pdf/sections/SegmentalPressureTable.tsx:219`).
Never rename segments. Georgian side words must not clip at 375. Prove each layer with ka screenshots at 1440/768/375.
```

### UX-ANGIO-005 — The in-form 'new study' button says it clears the form, and looks like it  `TOP-10: true`

**Band:** S1 data-loss (above the ranking) · **Type:** `relabel` · **Label:** CONFIRMED (C17 wording); the red confirm depends on UX-ANGIO-021 · **Effort:** S · **Risk tier:** low · **Fence:** W1-H (L1) · W2-venous / W2-arterial / W2-carotid (L2, L3)

**In plain language.** Next to the banner's '+ add study' sits a '+ new study' button styled like an add button. It actually erases everything typed in the current study, after a confirm whose red 'delete' currently looks the same blue as 'cancel'. After this change the button is quiet, says what it does, and its confirm names the patient and is red.

**Evidence.**
- Tasks: `a93706776962`, `d5c84bc79cf3`
- Events: `2bc06216a2b6`, `e922a6029c88`
- Screenshots / artefacts: `qa-reports/ux/runs/angio-module-2026-11-12-sono/walks/vascular-sonographer/shots/d5c84bc79cf3-s08.png`, `qa-reports/ux/runs/angio-module-2026-11-12-sono/walks/vascular-sonographer/shots/d5c84bc79cf3-s09.png`
- Prior findings subsumed: U-1031
- Source trace: C17 `VenousLEForm.tsx:1188-1197` (RESET at :1120-1127), copies `ArterialLEForm.tsx:760`, `CarotidForm.tsx:711`; gradient `VenousLEForm.module.css:82`; `ConfirmDialog.tsx:89` danger already wired, hidden by C1.

**Clicks saved per shift.**
No click cost. **0 clicks/shift.** It sits above the ranking because one confirm stands between an add-looking button and erasing a study.

**Risk.** Low. Wording plus a quieter style. The reset capability stays.

**Do not touch.**
- §4.8: the reset capability stays reachable. Only its label and weight change.
- §4.1: use the existing ghost/secondary EMRButton variant. The red confirm appears only once UX-ANGIO-021 lands (`ConfirmDialog.tsx:89` already passes `danger`).
- Product call for the orchestrator (decisions.md): the label. Suggested: 'ფორმის გასუფთავება' (clear this form). The action is a RESET of the current study, so 'new patient' (the finding's suggestion) would mislabel it too. The dialog title must not reuse the Cancel word (გაუქმება).

**Staging (each layer ships and reverts on its own).**
1. L1 (W1-H, locale files only) New values for `venousLE.actions.newCase` and the arterial and carotid equivalents: no literal '+', wording from decisions.md, and a dialog title that differs from Cancel.
1. L2 (W2-venous / W2-arterial / W2-carotid, 2 files each) `<Study>Form.tsx` + `<Study>Form.module.css`: remove `IconPlus` and make the `newCaseButton` style quiet. Verify `destructive` is passed to the confirm (venous does at :1301; check arterial and carotid).
1. L3 (same fences) The confirm body names the patient and the study (key via W1-H).

**Affected files (verified to exist).** `src/components/studies/venous-le/VenousLEForm.tsx`, `src/components/studies/venous-le/VenousLEForm.module.css`, `src/components/studies/arterial-le/ArterialLEForm.tsx`, `src/components/studies/arterial-le/ArterialLEForm.module.css`, `src/components/studies/carotid/CarotidForm.tsx`, `src/components/studies/carotid/CarotidForm.module.css`, `src/translations/venous-le/ka.json`, `src/translations/arterial-le/ka.json`, `src/translations/carotid/ka.json`

**Done when.** No '+' on the reset button, and its weight is quiet. The confirm names the patient and is red (after UX-ANGIO-021). A re-walk of a93706776962 logs no duplicate-path between 'add study' and the reset.

**Handoff → `frontend-designer`**

```text
Angio repo, one study fence at a time (W2-venous, W2-arterial, W2-carotid). Translation values come from the i18n fence. Source trace C17 (CONFIRMED): '+ ახალი კვლევა' (`VenousLEForm.tsx:1188-1197`, copies at `ArterialLEForm.tsx:760`, `CarotidForm.tsx:711`) triggers RESET of the current study (`VenousLEForm.tsx:1120-1127`) but is styled as an additive gradient button (`VenousLEForm.module.css:82`) with a doubled plus.
Do: remove IconPlus, restyle `newCaseButton` as the existing secondary/ghost EMRButton look (no new styles), make sure ConfirmDialog gets `destructive`, and have the confirm text name the patient. Label = decisions.md entry for U-1031. Keep the capability. Prove in ka at 1440: the button is quiet; the confirm shows the patient name (and is red once the stylesheet-order move lands).
```

### UX-ANGIO-006 — Grade the toe-brachial index on its own scale (after clinical sign-off S6)  `TOP-10: true`

**Band:** S2 clinical-safety (above the ranking) — gated on S6 · **Type:** `relabel` · **Label:** CONFIRMED (C20); cut-off = sign-off S6 · **Effort:** S · **Risk tier:** medium · **Fence:** W1-F

**In plain language.** The arterial form grades the toe pressure index with the ankle index's cut-offs, so the 'normal' template's toe value of 0.85 is labelled mild disease. Which toe value counts as normal is a clinical decision (sign-off S6). Once it is signed, the code change is small.

**Evidence.**
- Tasks: `9acf2a952037`
- Events: —
- Screenshots / artefacts: —
- Prior findings subsumed: U-1026, decisions.md S6
- Source trace: C20 `arterial-le/abiCalculator.ts:28-30, 96-97` (`band: bandForRatio(tbi)`); template `arterial-le/templates.ts:103-116` (toe 110 / brachial 130 = 0.846).

**Clicks saved per shift.**
No click cost. **0 clicks/shift.** It sits above the ranking because it is a clinical grading error on the deliverable.

**Risk.** Medium (clinical), low (code). The risk is choosing the wrong cut-off, and that choice is not an agent decision.

**Do not touch.**
- §4.3: no agent picks the TBI cut-off. S6 does, recorded with who, what, date and source.
- ABI bands are unchanged.
- If the band is exported, FHIR interpretation codes stay valid (`npm run validate:fhir`).

**Staging (each layer ships and reverts on its own).**
1. L0 S6 answered in decisions.md.
1. L1 (W1-F, 1 file + test) `abiCalculator.ts`: a separate TBI band function with the signed cut-offs, with unit tests at each boundary.
1. L2 (W1-F, 1 file) `arterial-le/templates.ts:103-116`: change the toe values only if S6 says the template is wrong rather than the bands.

**Affected files (verified to exist).** `src/components/studies/arterial-le/abiCalculator.ts`, `src/components/studies/arterial-le/templates.ts`

**Done when.** S6 is signed. TBI uses its own bands under unit test. The arterial 'normal' template grades normal.

**Handoff → `frontend-designer`**

```text
Angio repo, fence W1-F. BLOCKED until sign-off S6 (decisions.md) gives the TBI cut-offs. Source trace C20 (CONFIRMED): `src/components/studies/arterial-le/abiCalculator.ts:96-97` grades TBI with `bandForRatio` (ABI bands), so the 'normal' template TBI 0.846 (`templates.ts:103-116`) reads mild PAD. Add a TBI-specific band function using exactly the S6 values. Leave ABI bands untouched. Add boundary unit tests. Change template values only if S6 says so. Name the test file; run validate:fhir if the band reaches FHIR.
```

### UX-ANGIO-007 — The 'perforator' option stores what it says (after clinical sign-off)  `TOP-10: true`

**Band:** S2 clinical-safety (above the ranking) — gated on a new sign-off item (proposed S7) · **Type:** `relabel` · **Label:** CONFIRMED (C19) · **Effort:** M · **Risk tier:** medium · **Fence:** W3-perforator (after W1-C and W1-G release their files)

**In plain language.** In the venous competency list, the option shown as 'perforator' is saved as 'inconclusive'. Nothing is exported wrongly today only because venous never exports that field (UX-ANGIO-003 changes that). A clinician must decide whether 'perforator' becomes its own value or the old label returns. The plan does not guess.

**Evidence.**
- Tasks: `ad9b03d7d7d3`
- Events: —
- Screenshots / artefacts: —
- Prior findings subsumed: U-1027, critic: Tailwind-blue perforator colour
- Source trace: C19 `venous-le/config.ts:294-296` (deliberate relabel 2026-10-07), enum `:81, 94`, `SegmentTable.tsx:47`, `AnatomyLegend.tsx:42`, FHIR code list `fhir-systems.ts:375`, colour `theme-colors.ts:118`.

**Clicks saved per shift.**
No click cost. **0 clicks/shift.** It sits above the ranking because the stored code contradicts the clinician's choice.

**Risk.** Medium. A new value touches config, table, legend, colour, translations, PDF and FHIR, and existing drafts must be mapped (since 2026-10-07, every stored "inconclusive" means perforator).

**Do not touch.**
- §4.3: the clinician decides (orchestrator adds S7 to the sign-off list). No agent invents a code.
- §4.4: validate:fhir green. The PDF legend and the screen legend change together.
- `theme-colors.ts` carries today's clinician-feedback colour WIP: build on top.

**Staging (each layer ships and reverts on its own).**
1. L0 S7 answered: 'perforator' as its own value, or restore 'inconclusive' wording.
1. L1 (W3-perforator, ≤3 files) `venous-le/config.ts` enum + `theme-colors.ts` + venous-le locale keys (via W1-H), with a draft read-time mapping of old values.
1. L2 (≤3 files) `SegmentTable.tsx:47`, `AnatomyLegend.tsx:42`, PDF label.
1. L3 (≤2 files) `fhir-systems.ts:375` code list + `observations/venous.ts`, together with UX-ANGIO-003 L2.

**Affected files (verified to exist).** `src/components/studies/venous-le/config.ts`, `src/constants/theme-colors.ts`, `src/components/form/SegmentTable.tsx`, `src/components/anatomy/AnatomyLegend.tsx`, `src/constants/fhir-systems.ts`, `src/services/fhirBuilder/observations/venous.ts`

**Done when.** S7 is signed. The stored code equals the label everywhere: screen, PDF, FHIR. Old drafts open with the same meaning.

**Handoff → `speckit`**

```text
Spec seed — Venous competency: 'perforator' label vs stored 'inconclusive' code (angio, run angio-module-2026-11-12).
Problem: since 2026-10-07 the venous competency option labelled 'პერფორანტი' is stored and coded as `inconclusive` (`venous-le/config.ts:294-296`, FHIR code list `src/constants/fhir-systems.ts:375`). Venous does not export competencyOverride yet, so nothing wrong has been published. UX-ANGIO-003 will start exporting it, and from then on every perforator would be published as 'inconclusive'.
Decision needed first (S7, clinician): is 'perforator' a competency value of its own, or should the label go back to 'inconclusive'?
Success criteria: one value = one meaning in the form, table, legend (`AnatomyLegend.tsx:42`), PDF and FHIR; drafts saved since 2026-10-07 reopen with the clinician's original meaning; `npm run validate:fhir` green; no other study changed (partial plugin pattern).
```

### UX-ANGIO-008 — Download a finished study's report while another study in the visit is still empty  `TOP-10: true`

**Band:** high-alert · CRITICAL (safety floor applied) · **Type:** `one-click-action` · **Label:** CONFIRMED (C24) · **Effort:** S · **Risk tier:** low · **Fence:** W1-B

**In plain language.** A physician who has finished the venous study cannot hand over its report, because the visit also contains a carotid study nobody has started. Both PDF buttons are greyed out, with only an English hover note to explain why. The single-study report is already built in the code. After this change the finished study's report previews and downloads on its own, and the combined report stays for when every study is done.

**Evidence.**
- Tasks: `3088c351aa84`
- Events: `eec519062b89`, `773b88b701a8`, `d7b755b1d547`, `bf01972457d4`, `9bc22a40764e`
- Screenshots / artefacts: `qa-reports/ux/runs/angio-module-2026-11-12-phys/walks/vascular-physician/shots/3088c351aa84-s04.png`, `qa-reports/ux/runs/angio-module-2026-11-12-phys/walks/vascular-physician/shots/3088c351aa84-s09.png`
- Prior findings subsumed: U-1002, U-1004 (tooltip key)
- Source trace: C24 `FormActions.tsx:288-297, 493` all-or-nothing gate; `renderSingleStudyPdfBlob` exists at `:327`, used by the non-unified branch `:406-408, 453-455`; TODO escape hatch `:500-502`.

**Clicks saved per shift.**
`3088c351aa84` (6 − 3) × 2 = 6 → **6 clicks/shift**. After = toggle, resume, download. The real gain is from "impossible" to 3 clicks.

estClicksAfter: `3088c351aa84` → 3

**Risk.** Low. It uses the existing single-study renderer. The combined report keeps its all-complete rule.

**Do not touch.**
- §4.4: the per-study PDF is the existing renderer (same anatomy SVGs, same findings). The FHIR bundle is unchanged.
- An empty study is never printed as normal. Option (b) below must never silently drop a study.
- Keep the Mantine loading guard (one download per double-click; M-real PASS).
- Product call for the orchestrator (decisions.md). Recommended: (a) when the visit is not all complete and the active study is complete, both buttons export the active study. Rejected: (b) a combined PDF filtered to the complete studies, which hides an omitted study.

**Staging (each layer ships and reverts on its own).**
1. L1 (W1-B, 1 file) `FormActions.tsx:288-297, 493`: in a multi-study visit where the active study is complete, route preview and download through the non-unified branch. Replace the English tooltip with an inline Georgian line naming the unfinished study (key via W1-H).
1. L2 Vitest for the gate (complete+empty → single export enabled; all complete → combined).

**Affected files (verified to exist).** `src/components/form/FormActions.tsx`

**Done when.** A re-walk of 3088c351aa84 is COMPLETED in ≤4 clicks. The combined PDF still requires every study complete. No English string remains on the bar.

**Handoff → `frontend-designer`**

```text
Angio repo, fence W1-B (`src/components/form/FormActions.tsx` only). Source trace C24 (CONFIRMED): any visit with ≥2 studies forces the combined PDF and gates it on every study being complete (`:288-297`, `:493`). Walk 3088c351aa84 (high-alert) is FAILED_BLOCKED at CRITICAL. The single-study renderer `renderSingleStudyPdfBlob` (`:327`) is already used by the non-unified branch (`:406-408, :453-455`).
Do (option (a), per decisions.md): when unified && !allComplete && the active study is complete, enable preview and download for the active study via the existing single-study path. Show a Georgian inline note naming the unfinished study (send the key to the i18n fence) instead of the English `formActions.completeAllFirst` tooltip. Keep the loading guard. Add a Vitest for the gate. Prove in ka: venous complete + carotid empty → the venous PDF downloads.
```

### UX-ANGIO-009 — Get back into an open visit in one click  `TOP-10: true`

**Band:** high-alert · MEDIUM · **Type:** `promote-default` · **Label:** CONFIRMED (C26 dead footer button); panel fold = architect code read `OngoingVisitsPanel.tsx:96-100` (deliberate default) · **Effort:** S · **Risk tier:** low · **Fence:** W1-D

**In plain language.** Almost every task that continues a visit begins with the same wasted click: the in-progress list on the start page is folded shut every time, and the big 'continue current visit' button at the bottom does nothing. After this change that button opens the most recent visit, and the list stays open for a clinician who opened it last time (it stays folded for one who never uses it). This is the largest click saving in the plan.

**Evidence.**
- Tasks: `2b116c3dbda9`, `3088c351aa84`, `42d763c1e133`, `4694a7f74e68`, `4f1b689e4374`, `51f8fdd2aebb`, `6c8627b00e20`, `7ddfddbf4c8b`, `7f498505079c`, `802d04f6063d`, `84c9daf274e4`, `acfa2ced1941`, `afc608e3416b`, `b349de748732`, `b9b131e672b8`, `c2ca3d94fcb2`, `c4a29c48523e`, `d14d2d29a594`, `d238785449bc`, `d45cf28e1a49`, `e54837a93442`, `eac7013f7172`, `f0a93328734a`, `0a46facacdbc`, `17e266d15e6a`, `332f579ec7b3`, `3a68650e893d`, `3f161856f938`, `454da3f3a800`, `4c683280f693`, `5cb8f72c92e1`, `6d7af6f56e93`, `8b62e94cf890`, `bcbf7f5b50f1`
- Events: `5160fff884bb`, `350961671844`, `e524b63df22a`, `dc6225db3f65`, `01bc564a7b8b`
- Screenshots / artefacts: `qa-reports/ux/runs/angio-module-2026-11-12-phys/walks/vascular-physician/shots/2b116c3dbda9-s01.png`, `qa-reports/ux/runs/angio-module-2026-11-12-phys/walks/vascular-physician/shots/2b116c3dbda9-s03.png`
- Prior findings subsumed: U-1016, U-1035 (folded list, re-ordering, Edit scroll), U-1014 (intake half, C12: the same button breaks 375)
- Source trace: C26 `EncounterIntake.tsx:467-469` `navigate('/')` while on `/`; working sibling `OngoingVisitsPanel.tsx:121-131`; list newest-first `encounterStore.ts:280-297`; C12 `EncounterIntake.module.css:1003-1012, 1039-1040`.

**Clicks saved per shift.**

Σ (clicksNow − clicksAfter) × frequencyPerShift. A task loses one click per list-toggle click (the list stays open for a clinician who opened it before); `332f579ec7b3` also loses the dead footer click and the row resume (footer → newest visit = 1 click).

| Task | Persona | Goal | Now | After | ×/shift | Saved |
|---|---|---|---|---|---|---|
| `2b116c3dbda9` | physician | Download the report PDF for a single-study visit | 3 | 2 | 12 | 12 |
| `3088c351aa84` | physician | Download the finished study's report while the visit's other study is still empty | 6 | 5 | 2 | 2 |
| `42d763c1e133` | physician | Add a follow-up recommendation to the venous report | 3 | 2 | 6 | 6 |
| `4694a7f74e68` | physician | Write the arterial conclusion and clinician comment | 2 | 1 | 4 | 4 |
| `4f1b689e4374` | physician | Set the SVP classification for a pelvic venous study | 10 | 9 | 1 | 1 |
| `51f8fdd2aebb` | physician | Review the arterial findings and ankle-brachial index for both legs | 2 | 1 | 4 | 4 |
| `6c8627b00e20` | physician | Write the venous conclusion and clinician comment | 2 | 1 | 8 | 8 |
| `7ddfddbf4c8b` | physician | Print the report on paper | 3 | 2 | 8 | 8 |
| `7f498505079c` | physician | Correct one arterial segment finding the sonographer entered | 3 | 2 | 2 | 2 |
| `802d04f6063d` | physician | Review the pelvic venous findings for the iliac veins, cava and gonadal veins | 2 | 1 | 1 | 1 |
| `84c9daf274e4` | physician | Move from one study to the other inside a two-study visit | 3 | 2 | 5 | 5 |
| `acfa2ced1941` | physician | Review the venous findings and diagram for both legs | 3 | 2 | 8 | 8 |
| `afc608e3416b` | physician | Preview the report PDF before giving it to the patient | 3 | 2 | 10 | 10 |
| `b349de748732` | physician | Download one combined report PDF for a visit with two studies | 3 | 2 | 4 | 4 |
| `b9b131e672b8` | physician | Set the CEAP classification for a venous study | 10 | 9 | 5 | 5 |
| `c2ca3d94fcb2` | physician | Write the pelvic venous conclusion and comments | 2 | 1 | 1 | 1 |
| `c4a29c48523e` | physician | Override the NASCET category when it does not match the images | 4 | 3 | 1 | 1 |
| `d14d2d29a594` | physician | Check the NASCET stenosis category for each internal carotid artery | 3 | 2 | 5 | 5 |
| `d238785449bc` | physician | Remove a finished visit from the in-progress list | 3 | 2 | 5 | 5 |
| `d45cf28e1a49` | physician | Reopen a sonographer's in-progress visit from the start page | 2 | 1 | 15 | 15 |
| `e54837a93442` | physician | Correct one venous segment finding the sonographer entered | 4 | 3 | 4 | 4 |
| `eac7013f7172` | physician | Correct a wrong birth date on an in-progress visit | 4 | 3 | 2 | 2 |
| `f0a93328734a` | physician | Write the carotid impression and clinician comments | 3 | 2 | 5 | 5 |
| `0a46facacdbc` | sonographer | Switch to another study of the same patient | 3 | 2 | 4 | 4 |
| `17e266d15e6a` | sonographer | Add a forgotten study to the patient's open encounter | 8 | 7 | 1 | 1 |
| `332f579ec7b3` | sonographer | Reopen an unfinished encounter after the browser was closed | 3 | 1 | 3 | 6 |
| `3a68650e893d` | sonographer | Correct the patient's details in an open encounter | 3 | 2 | 1 | 1 |
| `3f161856f938` | sonographer | Remove an abandoned encounter from the in-progress list | 3 | 2 | 1 | 1 |
| `454da3f3a800` | sonographer | Add a text label on the anatomy diagram | 9 | 7 | 2 | 4 |
| `4c683280f693` | sonographer | Draw a freehand mark on the anatomy diagram | 7 | 5 | 3 | 6 |
| `5cb8f72c92e1` | sonographer | Write the conclusion for a finished study | 5 | 3 | 8 | 16 |
| `6d7af6f56e93` | sonographer | Download the PDF report of a finished study | 3 | 2 | 9 | 9 |
| `8b62e94cf890` | sonographer | Download one combined PDF for a patient with several studies | 3 | 2 | 3 | 3 |
| `bcbf7f5b50f1` | sonographer | Preview the PDF report before printing | 3 | 2 | 6 | 6 |
| | | **Total** | | | | **175** |

Assumption stated plainly: the first visit on a fresh device still costs the toggle click, and a clinician who keeps the list folded keeps today's cost. The sum adds both personas' shifts.

**Risk.** Low. The footer reuses the panel's working resume logic. The fold stays the default for a clinician who never opens the list, which honours the deliberate comment in the code.

**Do not touch.**
- §4.2: `/` stays the front door. Resume navigates to the existing `/encounter/:id/:studyType` route. No new route.
- The default stays folded on a fresh device (the deliberate comment at `OngoingVisitsPanel.tsx:96-99`). The remembered state is stored via `src/constants/storage-keys.ts`, never raw localStorage.
- §4.5: the long Georgian resume label wraps, never clips. The C12 fix ships in the same layer.
- Do not change `listEncounters` ordering (W1-A owns encounterStore.ts). Stable order is a local sort in the panel.

**Staging (each layer ships and reverts on its own).**
1. L1 (W1-D, 2 files) `EncounterIntake.tsx:467-469`: handleResume opens the newest encounter's first study (copy `OngoingVisitsPanel.tsx:121-131`), and is hidden when nothing is in progress. `EncounterIntake.module.css:1003-1012, 1039-1040`: add flex-wrap and let the resume button shrink and wrap (also clears the 375 CTA clip).
1. L2 (W1-D, 2 files) `OngoingVisitsPanel.tsx:100` + `storage-keys.ts`: remember expanded/folded per device.
1. L3 (W1-D, 1 file) `OngoingVisitsPanel.tsx`: stable row order by `createdAt` (local sort). Edit scrolls the intake form into view (shared with UX-ANGIO-017 L2).

**Affected files (verified to exist).** `src/components/layout/EncounterIntake.tsx`, `src/components/layout/EncounterIntake.module.css`, `src/components/layout/OngoingVisitsPanel.tsx`, `src/constants/storage-keys.ts`

**Done when.** Re-walk: d45cf28e1a49 = 1 click and 332f579ec7b3 = 1 click. The PDF tasks (2b116c3dbda9 etc.) = 2 clicks. At 375 the intake CTA is fully on screen. The list keeps its order across visits.

**Handoff → `frontend-designer`**

```text
Angio repo, fence W1-D. Two causes, both on the start page:
1. Source trace C26 (CONFIRMED): the footer 'მიმდინარე ვიზიტის გაგრძელება' calls `navigate('/')` while already on `/` (`src/components/layout/EncounterIntake.tsx:467-469`). Make it open the newest in-progress encounter's first study, using the same logic as `OngoingVisitsPanel.tsx:121-131` (listEncounters is newest-first). Hide it when nothing is in progress. In the same layer fix C12: `EncounterIntake.module.css:1003-1012` add flex-wrap, and `:1039-1040` let the resume button shrink and wrap so the 375 CTA is not pushed off-screen.
2. `OngoingVisitsPanel.tsx:100` `useState(false)`: keep folded as the default, but remember the clinician's last expanded/folded choice per device via a key in `src/constants/storage-keys.ts` (no raw localStorage).
3. Stable row order by createdAt (sort locally; do not touch encounterStore.ts). On Edit, scroll the intake form into view.
Prove in ka at 1280 and 375: footer = 1 click into the newest visit; after opening the list once and reloading, it is still open.
```

### UX-ANGIO-010 — Discarding a visit names the patient, and the button says 'discard'  `TOP-10: true`

**Band:** high-alert · MEDIUM · **Type:** `relabel` · **Label:** CONFIRMED (walker observation + U-1035; wording sibling `StudyPicker.tsx:390, 402`) · **Effort:** S · **Risk tier:** low · **Fence:** W1-D

**In plain language.** Removing a visit from the in-progress list cannot be undone. Yet a screen reader announces the trash button as 'cancel' (the same word as the dialog's Cancel), and the confirm does not say whose visit is about to go. After this change the confirm names the patient and the visit date, and the button is called 'discard'. With UX-ANGIO-021 the confirm is also red.

**Evidence.**
- Tasks: `3f161856f938`, `d238785449bc`, `0a46facacdbc`
- Events: `dc6cd84881ea`, `bb55dc5c75c1`, `7b421424cbf1`
- Screenshots / artefacts: —
- Prior findings subsumed: U-1035 (discard part), U-1031 (title = Cancel word pattern)
- Source trace: Discard dialogs that name the action: `OngoingVisitsPanel.tsx:322, 334`, `StudyPicker.tsx:390, 402` (source trace U-1031 sibling).

**Clicks saved per shift.**
No click change. **0 clicks/shift.** Ranked inside high-alert because the action is irreversible.

**Risk.** Low. Wording and accessible names only.

**Do not touch.**
- The two-step confirm stays. No undo, no auto-delete.
- §4.5: a long Georgian patient name wraps inside the dialog.
- Keys go to W1-H. This fence does not edit translation files.

**Staging (each layer ships and reverts on its own).**
1. L1 (W1-D, 1 file) `OngoingVisitsPanel.tsx`: the trash button's aria-label and tooltip key mean 'discard visit'. The confirm body interpolates the patient name and visit date.
1. L2 Verify the discard confirm passes `destructive` to ConfirmDialog (red after UX-ANGIO-021).

**Affected files (verified to exist).** `src/components/layout/OngoingVisitsPanel.tsx`

**Done when.** Re-walk 3f161856f938 and d238785449bc to the threshold: the confirm shows the patient's name, and the button is announced as discard.

**Handoff → `frontend-designer`**

```text
Angio repo, fence W1-D, `src/components/layout/OngoingVisitsPanel.tsx`. The trash button's accessible name is 'გაუქმება' (cancel), the same word as the dialog's Cancel, and the discard confirm does not name the patient (walk events 7b421424cbf1, dc6cd84881ea, bb55dc5c75c1; U-1035). Set the button's name and tooltip to 'discard visit' and interpolate the patient name and visit date in the confirm body. Send the ka/en/ru keys to the i18n fence. Confirm `destructive` is passed. Prove in ka with a screen-reader name check (enumerate accessibleName).
```

## Remaining moves

### Routine pathway moves (ranked)

### UX-ANGIO-011 — A normal pelvic study in one action, like venous

**Band:** routine · HIGH · **Type:** `one-click-action` · **Label:** CONFIRMED (C18: normal values built, no bulk action). HYPOTHESIS (source trace): the U-1025 template fix already lets the task pass · **Effort:** S · **Risk tier:** low · **Fence:** W2-iliac

**In plain language.** Venous has an 'all normal' button. The pelvic study does not, so a normal pelvic study means about 84 clicks row by row (the walker stopped at 19 and the table was still incomplete). The normal values already exist in the code since today's template fix. After this change pelvic gets the same single 'all normal' action clinicians already know from venous.

**Evidence.**
- Tasks: `85025cca62ba`
- Events: `1e5c76f1a5b8`, `13598459d7fb`, `ba45f1a594c6`, `c2a6696f97ff`, `929f76f2ee91`
- Screenshots / artefacts: `qa-reports/ux/runs/angio-module-2026-11-12-sono/walks/vascular-sonographer/shots/85025cca62ba-s06.png`, `qa-reports/ux/runs/angio-module-2026-11-12-sono/walks/vascular-sonographer/shots/85025cca62ba-s09.png`
- Prior findings subsumed: U-1030, U-1025 (fixed)
- Source trace: C18 `iliac-pelvic-venous/templates.ts:21-22` `NORMAL_CAVAL` (not exported); no bulk action in `IliacCavalTable.tsx` / `IliacPelvicVenousForm.tsx`; sibling `VenousLEForm.tsx:300-315` + `:898-900` + testid `bulk-set-all-normal`.

**Clicks saved per shift.**
`85025cca62ba` (19 − 6) × 1 = 13 → **13 clicks/shift**. Basis for 6: the venous sibling task 03a18f254204 measured 6 clicks with its bulk action. The real "now" is about 84 (21 rows × 4), because the walk stopped at 19.

estClicksAfter: `85025cca62ba` → 6

**Risk.** Low. It copies a working reducer case. The values are the S5 template values.

**Do not touch.**
- §4.3: the normal values are the S5 template values (patent / full / competent, phasicity left blank). S5 is still pending, and the button inherits whatever S5 decides.
- §4.7: copy the venous reducer case. Do not generalise a shared bulk-normal plugin.
- The capability to enter each row by hand stays.

**Staging (each layer ships and reverts on its own).**
1. L1 (verification first, no code) Re-walk 85025cca62ba via the template. If it completes within budget, record it. L2 then remains a consistency move (same gesture as venous), not a rescue.
1. L2 (W2-iliac, 3 files) `templates.ts`: export `NORMAL_CAVAL`. `IliacCavalTable.tsx`: an 'ყველა ნორმაში' button (testid `iliac-bulk-set-all-normal`) through a callback. `IliacPelvicVenousForm.tsx`: a `SET_ALL_NORMAL` case copied from `VenousLEForm.tsx:300-315`.

**Affected files (verified to exist).** `src/components/studies/iliac-pelvic-venous/templates.ts`, `src/components/studies/iliac-pelvic-venous/IliacCavalTable.tsx`, `src/components/studies/iliac-pelvic-venous/IliacPelvicVenousForm.tsx`

**Done when.** A re-walk of 85025cca62ba is COMPLETED in ≤15 clicks (target 6). All 21 rows read normal, and the conclusion matches the table.

**Handoff → `frontend-designer`**

```text
Angio repo, fence W2-iliac. First re-walk task 85025cca62ba (normal pelvic study) via the template; record the clicks. Then add the venous-style bulk action (source trace C18, CONFIRMED):
- export `NORMAL_CAVAL` from `src/components/studies/iliac-pelvic-venous/templates.ts:21-22`
- `IliacCavalTable.tsx`: 'ყველა ნორმაში' button, testid `iliac-bulk-set-all-normal`, calling a prop callback
- `IliacPelvicVenousForm.tsx`: reducer case `SET_ALL_NORMAL`, copied from `src/components/studies/venous-le/VenousLEForm.tsx:300-315` (handler pattern `:898-900`).
Values = template values (S5 pending, phasicity stays blank). Translation key goes to the i18n fence. Prove in ka: one click → 21 rows normal; the PDF prints them.
```

### UX-ANGIO-012 — Add a one-leg venous study from the banner, and choose the leg at intake

**Band:** routine · HIGH · **Type:** `one-click-action` · **Label:** CONFIRMED (C15 clipped menu, C16 identical labels). HYPOTHESIS (source trace C16): a right-leg study mounts the bilateral form and writes into the bilateral slot · **Effort:** M · **Risk tier:** medium · **Fence:** W1-E (L1, L2) · W2-venous (L4) · W1-D (L5)

**In plain language.** Right-leg-only and left-leg-only venous studies are built all the way down to billing and export codes, but their only door, the banner's '+ add study' menu, is cut off by its own box, so nothing in it can be clicked. Right and left also carry the same name. After this change the menu opens fully, right and left say which leg, and the intake card offers right, left or both.

**Evidence.**
- Tasks: `d5c84bc79cf3`, `17e266d15e6a`
- Events: `b54524c8c95e`, `320e85257934`, `e922a6029c88`, `1f58b5690bd5`, `f77ed177df03`
- Screenshots / artefacts: `qa-reports/ux/runs/angio-module-2026-11-12-sono/walks/vascular-sonographer/shots/d5c84bc79cf3-s09.png`, `qa-reports/ux/runs/angio-module-2026-11-12-sono/walks/vascular-sonographer/shots/d5c84bc79cf3-s12.png`, `qa-reports/ux/runs/angio-module-2026-11-12-sono/walks/vascular-sonographer/shots/17e266d15e6a-s03.png`, `qa-reports/ux/runs/angio-module-2026-11-12-sono/walks/vascular-sonographer/shots/17e266d15e6a-s06.png`
- Prior findings subsumed: U-1028
- Source trace: C15 `EncounterContextBanner.module.css:34` `overflow: hidden` around the in-flow menu (`:305-309`, JSX `EncounterContextBanner.tsx:267-292`); C16 one key `studies.venousLE.short` for all three entries (`:48-62`); `VenousLEForm.tsx:151, 783` hard-codes `venousLEBilateral`. Already plumbed: `types/study.ts:34-35`, `EncounterStudyWrapper.tsx:54-55, 73-74`, `vascular-cpt.ts:123-124`, `fhir-systems.ts:108-112`. Sibling for the menu: `IliacPelvicVenousForm.tsx:445-458` (Mantine Menu portals).

**Clicks saved per shift.**
`d5c84bc79cf3` (7 − 3) × 1 = 4 + `17e266d15e6a` (8 − 4) × 1 = 4 → **8 clicks/shift**. d5c84bc79cf3 after = card + leg + start (needs L5). With L1-L4 only it is 4 clicks, and it leaves an empty bilateral study that blocks the combined export. 17e266d15e6a after = toggle, resume, add-study, option.

estClicksAfter: `d5c84bc79cf3` → 3, `17e266d15e6a` → 4

**Risk.** Medium for L4 (the venous form must honour the route's study type; the hypothesis must be checked first). L1-L2 are low.

**Do not touch.**
- §4.2: the right/left routes are already in the `EncounterStudyWrapper` allow-list. No new route. The bare-route redirects are untouched.
- §4.4: CPT 93971 and the FHIR codes are already wired. validate:fhir with a single-leg bundle.
- §4.7: the venous form reads its study type from the route. No generic plugin signature.
- No empty bilateral study may be left behind (it would keep the combined export shut, U-1002).

**Staging (each layer ships and reverts on its own).**
1. L1 (W1-E, 2 files) `EncounterContextBanner.tsx:267-292` → Mantine `Menu` (portals, sibling `IliacPelvicVenousForm.tsx:445-458`), or drop `overflow: hidden` at `EncounterContextBanner.module.css:34`.
1. L2 (W1-E + W1-H) Distinct translation keys for right / left / bilateral at `EncounterContextBanner.tsx:48-62`.
1. L3 (verification, no code) Kill criterion from the source trace: add venousLERight, enter one finding, inspect `encounter.studies`. If a `venousLERight` key holds it, L4 shrinks to nothing.
1. L4 (W2-venous, 1 file) `VenousLEForm.tsx:151, 783`: take the study type from the route instead of the hard-coded STUDY_ID. Only if L3 confirms the hypothesis.
1. L5 (W1-D, after L4) Intake venous card: a right / left / both choice mapped to the existing study types (product call recorded in decisions.md).

**Affected files (verified to exist).** `src/components/layout/EncounterContextBanner.tsx`, `src/components/layout/EncounterContextBanner.module.css`, `src/components/studies/venous-le/VenousLEForm.tsx`, `src/components/layout/EncounterIntake.tsx`

**Done when.** Re-walk: d5c84bc79cf3 COMPLETED in ≤3 clicks, 17e266d15e6a in ≤4. The single-leg study holds its findings in its own slot and exports with CPT 93971. validate:fhir is green.

**Handoff → `frontend-designer`**

```text
Angio repo. Layered; one fence per layer.
L1 (W1-E) Source trace C15 (CONFIRMED): `src/components/layout/EncounterContextBanner.module.css:34` `overflow: hidden` clips the absolutely positioned add-study menu (`EncounterContextBanner.tsx:267-292`). Switch it to Mantine `<Menu>` (it portals; see `IliacPelvicVenousForm.tsx:445-458`) using the EMR wrapper conventions.
L2 (W1-E) The three venous entries share `studies.venousLE.short` (`:48-62`). Give right / left / bilateral distinct keys (send them to the i18n fence).
L3 Verify the HYPOTHESIS before any form change: add venousLERight, enter one finding, inspect encounter.studies.
L4 (W2-venous, only if L3 shows the bilateral slot is written) `VenousLEForm.tsx:151, 783`: use the route's study type.
Prove in ka: menu options visible and clickable at 1280; right and left distinguishable; single-leg bundle passes validate:fhir.
```

### UX-ANGIO-013 — Both legs normal in one action when the both-legs view is open

**Band:** routine · HIGH (as scored; see label) · **Type:** `one-click-action` · **Label:** CONFIRMED (walker observation s8: 'all normal' fills only the active leg tab; tooltip says 'this tab'). HYPOTHESIS (architect, not traced): `SET_ALL_NORMAL` (`VenousLEForm.tsx:300-315`) takes the active side. NOTE: the task's HIGH severity comes from step-1 carry-over event 15bf88a468d8 (Method notes); its own events are LOW · **Effort:** S · **Risk tier:** low · **Fence:** W2-venous

**In plain language.** For a normal two-leg venous study the clinician must press 'all normal', switch to the other leg, and press it again, because the action fills only the visible leg. After this change, when the both-legs view is open, one press fills both legs; the per-leg button still works as today.

**Evidence.**
- Tasks: `03a18f254204`
- Events: `f5364d801169`, `9053a7590943`
- Screenshots / artefacts: —
- Prior findings subsumed: —
- Source trace: Walker observations (03a18f254204 s8, s18). Architect read: handler `VenousLEForm.tsx:898-900`, reducer `:300-315`, button in `SegmentAssessmentCard.tsx` (testid `bulk-all-normal`).

**Clicks saved per shift.**
`03a18f254204` (6 − 4) × 3 = 6 → **6 clicks/shift**. Now = card, start, all-normal, left tab, all-normal, both view. After = card, start, both view, all-normal.

estClicksAfter: `03a18f254204` → 4

**Risk.** Low. It reuses the same reducer action for two sides. Competency stays blank, as today.

**Do not touch.**
- §4.3: the bulk action still leaves competency blank (it deliberately does not assume competency). The values are exactly today's per-leg normal values.
- The per-leg button stays.

**Staging (each layer ships and reverts on its own).**
1. L1 (verification) Confirm the reducer side parameter (HYPOTHESIS).
1. L2 (W2-venous, 2 files) `VenousLEForm.tsx` + `SegmentAssessmentCard.tsx`: in the bilateral view, dispatch for both sides. Tooltip key 'ორივე კიდური' via W1-H.

**Affected files (verified to exist).** `src/components/studies/venous-le/VenousLEForm.tsx`, `src/components/form/SegmentAssessmentCard.tsx`

**Done when.** A re-walk of 03a18f254204 is COMPLETED in 4 clicks with 38/38 rows normal on both legs.

**Handoff → `frontend-designer`**

```text
Angio repo, fence W2-venous. Walk 03a18f254204: 'ყველა ნორმაში' fills only the active leg tab (tooltip 'ამ ჩანართის'), so a normal bilateral study needs bulk, tab switch, bulk. First verify how `SET_ALL_NORMAL` (`src/components/studies/venous-le/VenousLEForm.tsx:300-315`, handler `:898-900`) picks its side. Then, when the bilateral view is active, fill both sides in one press (button lives in `src/components/form/SegmentAssessmentCard.tsx`, testid bulk-all-normal). Keep competency blank and keep the per-leg behaviour. Tooltip key goes to the i18n fence. Prove in ka: bilateral view → one press → 38/38 rows normal.
```

### UX-ANGIO-014 — Print the report in one click

**Band:** routine · HIGH (FAILED_BLOCKED) · **Type:** `one-click-action` · **Label:** CONFIRMED app-side fact: no print control on the study page (footer = save / preview / download). Walker measurement limit: a human must re-check the browser viewer first · **Effort:** S · **Risk tier:** low · **Fence:** W1-B

**In plain language.** There is no print button. Printing depends on the browser's own PDF viewer, in a second tab. The walker could not drive that viewer, so step one is a person checking it by hand. Either way, a print button that sends the same PDF straight to the print dialog turns a hunt into one click.

**Evidence.**
- Tasks: `7ddfddbf4c8b`
- Events: `bbe4636adb29`, `8f2a5a601e7e`
- Screenshots / artefacts: `qa-reports/ux/runs/angio-module-2026-11-12-phys/walks/vascular-physician/shots/7ddfddbf4c8b-s03.png`
- Prior findings subsumed: U-1034
- Source trace: Walk outcomeNote (MEASUREMENT LIMIT stated by the walker). Footer actions in `FormActions.tsx`.

**Clicks saved per shift.**
`7ddfddbf4c8b` (3 − 3) × 8 = 0 → **0 clicks/shift**. The gain is a print pathway inside the app, not fewer clicks.

estClicksAfter: `7ddfddbf4c8b` → 3

**Risk.** Low. A secondary button that reuses the renderer the preview already uses.

**Do not touch.**
- §4.4: print the same blob the preview renders. No second layout.
- The PDF engine stays lazy-loaded (performance standing check). `src/styles/print.css` is untouched.
- One primary button per screen: print is secondary weight.

**Staging (each layer ships and reverts on its own).**
1. L0 (human, no code) Preview → viewer print. Record whether it works.
1. L1 (W1-B, 1 file) `FormActions.tsx`: a secondary 'ბეჭდვა' button that renders the same blob into a hidden iframe and calls print(), falling back to opening the preview. Key via W1-H.
1. L2 e2e or unit check that print uses the preview blob.

**Affected files (verified to exist).** `src/components/form/FormActions.tsx`

**Done when.** A re-walk of 7ddfddbf4c8b reaches the print dialog in ≤3 clicks. The printed PDF is identical to the preview.

**Handoff → `frontend-designer`**

```text
Angio repo, fence W1-B, `src/components/form/FormActions.tsx`. Walk 7ddfddbf4c8b (print the report) FAILED_BLOCKED: the footer offers save / preview / download only; printing depends on the browser viewer in a new tab. Add a secondary 'ბეჭდვა' button: render the same PDF blob the preview uses (existing renderers, lazy import kept), load it in a hidden iframe and call print(); fall back to opening the preview. Key goes to the i18n fence. Do not touch print.css. Prove in ka: the print dialog opens with the Georgian PDF.
```

### UX-ANGIO-015 — The arterial table fits its card, so the occlusion boxes are on screen

**Band:** routine · HIGH · **Type:** `promote-default` · **Label:** CONFIRMED (C27). HYPOTHESIS (source trace) on the 3 non-arterial tasks carrying the event: the architect ran its kill-criterion and it survived; the mechanism is step-1 carry-over (Method notes) · **Effort:** S · **Risk tier:** low · **Fence:** W2-arterial

**In plain language.** On a normal laptop the arterial findings table is wider than its box, so the last column, the occlusion tick-boxes for all 34 segments, scrolls out of sight inside the card. After this change the table gets the full width of the page, as carotid already does, and every column is visible.

**Evidence.**
- Tasks: `9acf2a952037`, `71f3dd3afb01`, `17e266d15e6a`, `4694a7f74e68`, `51f8fdd2aebb`, `7f498505079c`
- Events: `6040998a19a6`, `43c5f78be158`, `05cf9da7e989`, `4b3965b2f8c4`, `179bd47bec66`, `bc6f477e5f74`, `fa8d4b75efb4`, `9003ea41e04d`
- Screenshots / artefacts: `qa-reports/ux/runs/angio-module-2026-11-12-phys/walks/vascular-physician/shots/screen-5d70410ebf9af7a1.png`, `qa-reports/ux/runs/angio-module-2026-11-12-sono/walks/vascular-sonographer/shots/screen-2e840778fec71af9.png`
- Prior findings subsumed: U-1015
- Source trace: C27 `ArterialSegmentTable.module.css:66-69` (`min-width: 890px`) inside the `lg:7` column `ArterialLEForm.tsx:777` (~720-777px). Sibling: full-width `CarotidForm.tsx:721`.

**Clicks saved per shift.**
No click change (the cost is horizontal scrolling inside the card). **0 clicks/shift.**

**Risk.** Low. It is a layout change in one form. It pairs with the diagram move (UX-ANGIO-025) for arterial, in the same fence.

**Do not touch.**
- §4.5: do not trim the 180px label column (Georgian segment names would clip). Give the table room instead.
- §4.3: no column is removed.

**Staging (each layer ships and reverts on its own).**
1. L1 (W2-arterial, 1 file) `ArterialLEForm.tsx:770-783`: the segment table takes the full row and the pressures deck becomes its own row (sibling `CarotidForm.tsx:721`).
1. L2 (W1-H) Georgian aria-label for the occlusion checkbox (today it ends in English 'occluded').
1. L3 (W2-arterial) Lands together with UX-ANGIO-025 arterial: the diagram goes in the space beside the 890px table at ≥1280px.

**Affected files (verified to exist).** `src/components/studies/arterial-le/ArterialLEForm.tsx`, `src/components/studies/arterial-le/ArterialSegmentTable.module.css`

**Done when.** At 1280×720 the screens row for the arterial form records horizontallyClippedControls = 0, and the occlusion column is visible without scrolling the card.

**Handoff → `ui-upgrade`**

```text
/ui-upgrade /encounter/<id>/arterialLE (create the encounter through the intake first; fence W2-arterial). Problem (source trace C27, CONFIRMED): `ArterialSegmentTable.module.css:66-69` min-width 890px sits in the `lg:7` column of `ArterialLEForm.tsx:770-783` (~777px), so the 60px occlusion column (34 checkboxes) scrolls out of the card at 1280/1440. Give the table the full row (like `CarotidForm.tsx:721`), put the pressures deck in its own row, and leave room for the diagram beside the table at ≥1280 (UX-ANGIO-025). Do not shrink the 180px label column. Verify in ka at 1280×720 that no control is horizontally clipped.
```

### UX-ANGIO-016 — CEAP opens on the first click anywhere on its header

**Band:** routine · MEDIUM · **Type:** `one-click-action` · **Label:** HYPOTHESIS (architect code read, not traced live): `EMRCollapsibleSection.tsx:189` wraps rightSection (the CEAP summary badge) in a Box that calls stopPropagation, so a click near the badge never toggles; `CEAPPicker.tsx:173` `defaultOpen={false}` · **Effort:** S · **Risk tier:** low · **Fence:** W1-G

**In plain language.** The CEAP classification sits folded near the bottom of the venous page, and clicking its header near the summary badge does nothing; only the small arrow opens it. After this change a click anywhere on the header opens it, and it opens by itself when it already holds a classification.

**Evidence.**
- Tasks: `b9b131e672b8`
- Events: `b29ecdc3af06`, `250687f42cf5`
- Screenshots / artefacts: `qa-reports/ux/runs/angio-module-2026-11-12-phys/walks/vascular-physician/shots/b9b131e672b8-s03.png`
- Prior findings subsumed: —
- Source trace: Walker observations s11 (dead-end: aria-expanded stayed false), s21 (collapsed on every visit). Architect read of `EMRCollapsibleSection.tsx:162-190`, `CEAPPicker.tsx:169-176`.

**Clicks saved per shift.**
`b9b131e672b8` (10 − 9) × 5 = 5 → **5 clicks/shift**. Only the dead header click is counted. The walker's own reload slip (step 19) is not credited to this move.

estClicksAfter: `b9b131e672b8` → 9

**Risk.** Low. One shared collapsible header (CEAP, SVP and others) must keep interactive right-side controls from toggling.

**Do not touch.**
- §4.3: CEAP 2020 axes and the r/s/a/n modifiers are unchanged.
- `EMRCollapsibleSection` is shared: clicks on interactive rightSection controls must still not toggle the section.

**Staging (each layer ships and reverts on its own).**
1. L0 (verification) Click the CEAP badge: does aria-expanded stay false? If the badge click toggles, kill this cause and re-trace.
1. L1 (W1-G, 1 file) `EMRCollapsibleSection.tsx`: stop propagation only for interactive rightSection content, so a passive badge passes the click to the header.
1. L2 (W1-G, 1 file) `CEAPPicker.tsx`: open by default when any axis already has a value.

**Affected files (verified to exist).** `src/components/common/EMRCollapsibleSection.tsx`, `src/components/form/CEAPPicker.tsx`

**Done when.** A re-walk of b9b131e672b8 has no dead click on the CEAP header. A saved CEAP opens expanded.

**Handoff → `frontend-designer`**

```text
Angio repo, fence W1-G. Walk b9b131e672b8: the first click on the CEAP header (near the 'CEAP: C0,En,An,Pn' badge) did not expand it. HYPOTHESIS (architect read): `src/components/common/EMRCollapsibleSection.tsx:189` wraps `rightSection` in a Box with `onClick={(e) => e.stopPropagation()}`. Verify first (click the badge; check aria-expanded). If confirmed: only stop propagation when the right section is interactive, so a passive badge toggles the header. Then in `src/components/form/CEAPPicker.tsx:173` open by default when any CEAP axis has a value. Check SVP and the other collapsible users still behave. Prove in ka.
```

### UX-ANGIO-017 — Study pages open at the top

**Band:** routine · MEDIUM · **Type:** `promote-default` · **Label:** CONFIRMED (C25) · **Effort:** S · **Risk tier:** low · **Fence:** W1-D

**In plain language.** The start page is long, and the browser keeps its scroll position when a study opens, so the form appears about 1,200 px down with the patient banner off screen. 'Edit' on the visit list fills a form below the fold. After this change every page opens at its top, and Edit scrolls to the form.

**Evidence.**
- Tasks: `831ea4f62f94`, `17e266d15e6a`, `eac7013f7172`
- Events: —
- Screenshots / artefacts: `qa-reports/ux/runs/angio-module-2026-11-12-sono/walks/vascular-sonographer/shots/17e266d15e6a-s10.png`
- Prior findings subsumed: U-1029, U-1035 (Edit scroll half)
- Source trace: C25: no scroll reset anywhere in src; `EncounterIntake.tsx:437, 446` navigate after the user scrolled to the CTA; `BrowserRouter` (`main.tsx:3`), so `<ScrollRestoration>` is unavailable; Edit-scroll sibling `EMRFormErrorSummary.tsx:60`.

**Clicks saved per shift.**
No click change. The cost is scrolling: the walk notes say "landed mid-table; scrolled up" (831ea4f62f94) and "scrollY=1200 again" (17e266d15e6a obs s10). **0 clicks/shift.**

**Risk.** Low. A tiny listener outside the route list.

**Do not touch.**
- §4.2: App.tsx's bare study-route redirects (audit Part-03 HIGH) are not edited. The listener sits outside the `<Routes>` list.
- §4.1: instant scroll (no animation over 200 ms).

**Staging (each layer ships and reverts on its own).**
1. L1 (W1-D, 1 file) `App.tsx`: a small component that calls window.scrollTo(0, 0) on pathname change, rendered outside `<Routes>`.
1. L2 (W1-D, 1 file) `EncounterIntake.tsx`: on `?edit=` load, scroll the form into view (same pathname, so L1 does not cover it).

**Affected files (verified to exist).** `src/App.tsx`, `src/components/layout/EncounterIntake.tsx`

**Done when.** In a re-walk the first screen after intake-start is at scrollY 0 with the banner visible. Edit lands on the form.

**Handoff → `frontend-designer`**

```text
Angio repo, fence W1-D. Source trace C25 (CONFIRMED): no scroll reset exists; the app uses BrowserRouter (`src/main.tsx:3`) so ScrollRestoration is unavailable. Add a tiny component in `src/App.tsx` (outside the `<Routes>` list; do NOT edit the bare-route redirects, audit Part-03 HIGH) that scrolls to top on `location.pathname` change. In `src/components/layout/EncounterIntake.tsx`, when loaded with `?edit=`, scroll the form into view (pattern `src/components/common/EMRFormErrorSummary.tsx:60`). Prove in ka: start a study from the bottom of the intake → the form opens at the top.
```

### UX-ANGIO-018 — Section titles become real headings

**Band:** routine · MEDIUM · **Type:** `relabel` · **Label:** CONFIRMED (architect code read: `EMRContentSection.tsx:285` and `EMRCollapsibleSection.tsx:183` render titles as Text; the scorer records headingCount 0 on every study screen) · **Effort:** S · **Risk tier:** low · **Fence:** W1-G

**In plain language.** Every study page has hundreds of controls and not one heading, so a screen reader cannot jump between sections and the page has no outline. After this change the section titles that are already on screen are marked as headings. Nothing looks different.

**Evidence.**
- Tasks: `03a18f254204`, `71f3dd3afb01`, `831ea4f62f94`, `85025cca62ba`
- Events: `f5b62004ab8c`, `44a6609d31e4`, `f2a7cec89e5b`
- Screenshots / artefacts: —
- Prior findings subsumed: scorer worstScreens: arterial 449 controls / 0 headings, venous 363 / 0, carotid 362 / 0
- Source trace: Architect read only (not in the source trace): `EMRContentSection.tsx:285-295` `<Text fw={600} size="md">{title}</Text>`; `EMRCollapsibleSection.tsx:183` `<Text className={classes.sectionTitle}>`.

**Clicks saved per shift.**
No click change. **0 clicks/shift.** Covers the 71 no-document-structure events.

**Risk.** Low. Same styles, a different element.

**Do not touch.**
- §4.1: no visual change. Same size and weight tokens.
- Note for the next run: the screen fingerprint uses visible h1-h3 text, so study-screen fingerprints change once. Clicks are unaffected; record it in the comparability note.

**Staging (each layer ships and reverts on its own).**
1. L1 (W1-G, 1 file) `EMRContentSection.tsx`: the title Text renders as `component="h2"` with unchanged styles.
1. L2 (W1-G, 1 file) `EMRCollapsibleSection.tsx`: the same, as h2 or h3.

**Affected files (verified to exist).** `src/components/common/EMRContentSection.tsx`, `src/components/common/EMRCollapsibleSection.tsx`

**Done when.** On a re-walk, every study screen records headingCount ≥ 5 and no no-document-structure event fires. Screenshots are pixel-identical apart from reflow.

**Handoff → `frontend-designer`**

```text
Angio repo, fence W1-G. Every study screen has 0 headings (scorer worstScreens, no-document-structure ×71). Section titles render as Mantine Text: `src/components/common/EMRContentSection.tsx:285-295` and `src/components/common/EMRCollapsibleSection.tsx:183`. Render them as headings (`component="h2"`, or h3 for nested collapsibles) with identical visual styles, so nothing visibly changes. Check heading order on one study page with an accessibility tree dump. Prove: a ka screenshot before and after looks the same.
```

### UX-ANGIO-019 — Drawing tools say what they are, and text labels stay inside the diagram

**Band:** routine · MEDIUM · **Type:** `relabel` · **Label:** CONFIRMED (walker observations 454da3f3a800 s7, s12; 4c683280f693 s19). Cause of the clipping not traced → HYPOTHESIS location `DrawingCanvas.tsx` · **Effort:** S · **Risk tier:** low · **Fence:** W1-I

**In plain language.** The pen, eraser and text tools are unnamed icons that stay greyed out until 'draw' is switched on. A text label placed right of centre is cut off at the diagram edge. And the default ink is the same grey as a normal vein. After this change the tools are named, labels stay inside the drawing, and the ink can be told apart from the anatomy. The measured over-budget here is mostly the walk's own re-entry and save-check clicks, not the toolbar.

**Evidence.**
- Tasks: `454da3f3a800`, `4c683280f693`
- Events: `a7dcd139d8ab`, `103be95dd0f1`, `ee5cff6dedd3`, `22d4eea730ea`, `88de43043eef`, `b62253c5ce45`
- Screenshots / artefacts: `qa-reports/ux/runs/angio-module-2026-11-12-sono/walks/vascular-sonographer/shots/454da3f3a800-s14.png`
- Prior findings subsumed: —
- Source trace: Walk observations only.

**Clicks saved per shift.**
**0 clicks/shift** (the click count is not the problem). Breakdown from the walk steps: `454da3f3a800` 9 = 2 re-entry (toggle, resume) + 4 annotate (draw, T, place, Enter) + 3 persistence check (back, toggle, resume). `4c683280f693` 7 = 2 + 2 (draw, stroke) + 3. Against the ratified 3-click annotate budget the annotation itself is 4 and 2. UX-ANGIO-009 removes the toggle clicks.

**Risk.** Low. Names, a clamp and a token choice.

**Do not touch.**
- Drawings persist in `drawings[]` and print in the PDF (`DrawingStroke.text`). The data shape is unchanged.
- The draw-mode toggle is part of the ratified budget warrant (angio-annotate, D6). Keep it.
- `DrawingToolbar.tsx` and `types/drawing.ts` carry uncommitted WIP: build on top.
- AnatomyView's react/no-danger exception is untouched.

**Staging (each layer ships and reverts on its own).**
1. L1 (W1-I, 1 file) `DrawingToolbar.tsx`: accessible names and tooltips for pen, eraser, text and undo (undo is named 'cancel' today). Keys via W1-H.
1. L2 (W1-I, 1 file) `DrawingCanvas.tsx`: clamp a text label inside the viewBox (verify the cause first).
1. L3 (W1-I) Default ink = a token distinct from the normal-vessel slate (token choice checked by the UI-X lane).

**Affected files (verified to exist).** `src/components/anatomy/DrawingToolbar.tsx`, `src/components/anatomy/DrawingCanvas.tsx`

**Done when.** Every toolbar control has a Georgian accessible name. A label placed at the right edge is fully visible on screen and in the PDF. The default ink differs from the normal-vessel colour.

**Handoff → `frontend-designer`**

```text
Angio repo, fence W1-I (`src/components/anatomy/DrawingToolbar.tsx`, `DrawingCanvas.tsx`; both may carry uncommitted WIP, build on top). Walks 454da3f3a800 / 4c683280f693: pen, eraser and 'T' have no accessible name or tooltip, undo is named 'გაუქმება' (cancel); a text label placed right of centre is clipped at the diagram edge; default ink = normal-vessel slate. Add names + tooltips (keys to the i18n fence), clamp text labels inside the drawing area (find the cause first), and pick a distinct existing token for the default ink. Keep the draw-mode toggle and the drawings[] data shape. Prove on screen and in the exported PDF.
```

### UX-ANGIO-020 — Georgian everywhere: missing words, dates and screen-reader names

**Band:** routine · MEDIUM · **Type:** `relabel` · **Label:** CONFIRMED (C28: keys missing in every locale; checker is parity-only). HYPOTHESIS (architect code read): report dates print US-style because `formatIsoForDisplay` defaults to `lang 'en'` (`dateHelpers.ts:82`) and the PDF callers omit `lang` · **Effort:** M · **Risk tier:** low · **Fence:** W1-H (owns all src/translations/**)

**In plain language.** Across both walks the Georgian screens and the Georgian report show English words ('IN PROGRESS', 'Edit', 'Complete all studies…', 'Anterior view', 'Surface', '7 y', a fully English calendar), and report dates print as 11/12/2026, which a Georgian reader takes as 11 December. After this change every word is Georgian, dates read day.month.year, and the translation check catches a missing word before it ships.

**Evidence.**
- Tasks: `f7d966f9347f`, `d45cf28e1a49`, `264f943ebf15`, `831ea4f62f94`, `51f8fdd2aebb`, `7f498505079c`, `afc608e3416b`, `d14d2d29a594`, `eac7013f7172`
- Events: `a0868bfb9c8d`, `11243fc1ae74`, `23ac17f13a32`, `8c0da8eda1da`, `144e7ad73ac9`, `0137b1539e20`, `450c035c6575`, `368976798430`, `0dd70398fd53`, `397bb7425c51`
- Screenshots / artefacts: —
- Prior findings subsumed: U-1004, U-1005, U-1006, U-1007, U-1015 (aria part)
- Source trace: C28: keys absent everywhere (`formActions.completeAllFirst`, `encounter.listPage.eyebrow`, `encounter.list.edit`, `encounter.banner.ageYears`, `anatomy.view.le-arterial-anterior`, `carotid.param.plaqueSurface`, `carotid.nascetSummary.rightIca`); `scripts/check-i18n.ts:4-9` parity only; NASCET chip fallback `NASCETPicker.tsx:151`.

**Clicks saved per shift.**
No click change. **0 clicks/shift.** Covers 10 of the 15 jargon events. The rest route elsewhere: bf906d5e5019 and 9bc22a40764e → UX-ANGIO-008 (tooltip), 7b421424cbf1 → UX-ANGIO-010, 39f333a8fa95 → UX-ANGIO-027, 674658059cad (clinical abbreviations) → do-not-do.

**Risk.** Low. Strings, one checker rule and one date helper. Georgian strings run long, so re-shoot 375.

**Do not touch.**
- §4.3: clinical abbreviations (GSV, SPJ, CCA, ICA, NASCET grades) are not translated by an agent (see the do-not-do list).
- §4.5: re-shoot 375 for any longer Georgian string.
- Translations have a single owner. This fence owns every `src/translations/**.json`. Other fences hand their keys here, and the orchestrator merges them at wave end.
- Dates: use `services/dateHelpers.ts` (Tbilisi trap, CLAUDE.md). Never `toISOString().slice(0,10)` for display.

**Staging (each layer ships and reverts on its own).**
1. L1 (W1-H, ≤3 files per step) Add the missing keys, one ka/en/ru triplet per step (root, then per-study), plus the venous PDF section labels (U-1005).
1. L2 (W1-H, 1 file) `scripts/check-i18n.ts`: fail on a literal `t('key')` used in src but absent from ka.
1. L3 (W1-H, 1 file) `NASCETPicker.tsx:151`: drop the English fallback chip when a translated label exists (also clears the critic carotid duplicate-primary-data finding).
1. L4 (W1-H, ≤3 files) Verify the date HYPOTHESIS (grep the PDF callers of formatIsoForDisplay for `lang`), then print dd.mm.yyyy in 24h in the report language. Calendar popup locale: trace first where EncounterIntake sets the dayjs locale.
1. L5 (W1-H, 2 files) `ArterialSegmentTable.tsx`: waveform pictograms get a visible tooltip with their existing names. `BackToStudiesButton.tsx`: the label says where it goes (it lands on visit details, walk 3088c351aa84 obs s7).

**Affected files (verified to exist).** `src/translations/ka.json`, `src/translations/en.json`, `src/translations/ru.json`, `scripts/check-i18n.ts`, `src/components/studies/carotid/NASCETPicker.tsx`, `src/services/dateHelpers.ts`, `src/components/studies/arterial-le/ArterialSegmentTable.tsx`, `src/components/layout/BackToStudiesButton.tsx`

**Done when.** In a ka walk of every in-scope screen and PDF, no English chrome remains apart from the clinical abbreviations. `npm run i18n:check` fails on a planted missing key. PDF dates read 12.11.2026.

**Handoff → `frontend-designer`**

```text
Angio repo, fence W1-H (owns every src/translations/**.json; other fences send you key lists). Source trace C28 (CONFIRMED): keys used in src are missing from every locale, so t() renders the English fallback, and `scripts/check-i18n.ts:4-9` only checks parity.
1. Add, one ka/en/ru triplet per step: formActions.completeAllFirst, encounter.listPage.eyebrow, encounter.list.edit, encounter.banner.ageYears, anatomy.view.le-arterial-anterior, carotid.param.plaqueSurface, carotid.nascetSummary.rightIca/leftIca, the venous PDF section labels (U-1005), and every key handed over by other fences.
2. check-i18n: fail when a literal t('key') in src is absent from ka.
3. `NASCETPicker.tsx:151`: no English chip when a Georgian label exists.
4. HYPOTHESIS: `src/services/dateHelpers.ts:82` defaults lang to 'en'; verify the PDF callers, then print dd.mm.yyyy 24h. Find where the intake calendar gets its locale before changing it.
5. Waveform pictograms (`ArterialSegmentTable.tsx`) get visible tooltips; `BackToStudiesButton.tsx` label says where it goes.
Never translate clinical abbreviations. Re-shoot 375. Run npm run i18n:check.
```

### Cross-screen UI moves (for the UI-X lane; critic evidence)

These are the critic's cross-screen patterns, each with its traced cause and files, so the orchestrator can fence them. The **save dot** is not a separate move: it is UX-ANGIO-002 L2 (same files, `FormActions.tsx` + `.module.css`), fenced in W1-B. Run UX-ANGIO-021 (stylesheet order) **first** in the UI-X lane. Until it lands, any button-weight work is invisible, and the red confirms that UX-ANGIO-005 and -010 rely on do not show.

### UX-ANGIO-021 — Quiet buttons render quiet: fix the stylesheet order

**Band:** UI-X lane · prerequisite of UX-ANGIO-005 and -010 · **Type:** `relabel` · **Label:** CONFIRMED (C1, live rule trace) · **Effort:** S · **Risk tier:** medium · **Fence:** W1-G

**In plain language.** Every study page shows 8 to 12 equally loud navy buttons, and the red 'delete' in confirms looks exactly like 'cancel'. The quiet and red button styles are already written and already requested. They lose because the component library's own stylesheet loads last. After this change each page has one loud button again, and destructive confirms are red.

**Evidence.**
- Tasks: — (no walk task; ledger / critic / standing-check evidence)
- Events: —
- Screenshots / artefacts: `documentation/level-up/runs/angio-module-2026-11-12/screens/venous-le-default.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/carotid-default.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/iliac-pelvic-venous-default.png`
- Prior findings subsumed: critic X-BTN (4 study screens × 4 variants), U-1031 (colour part)
- Source trace: C1 `src/main.tsx:4` (`import App`, which evaluates every component stylesheet) before `:8` (`@mantine/core/styles.css`); live DOM: EMRButton sheet index 1, Mantine 74; `.m_77c9d27d` filled background wins. Amplifier `EMRButton.tsx:395-419` passes no variant.

**Clicks saved per shift.**
Composition move. **0 clicks/shift.**

**Risk.** Medium blast radius: 77 EMRButton call sites in 31 files, and possibly other wrappers, start rendering as designed. Re-shoot all 20 variants.

**Do not touch.**
- §4.1: tokens unchanged. Exactly one gradient primary per screen (PDF download), per DESIGN-DIRECTION.
- Keep `theme.css` and `print.css` after `import App`, so theme overrides keep winning. Only the three `@mantine/*` imports move.
- HYPOTHESIS (source trace): other wrappers, such as the empty-MultiSelect "input inside an input", may change too. Check them in L2.

**Staging (each layer ships and reverts on its own).**
1. L1 (W1-G, 1 file) `main.tsx`: move the three `@mantine/*.css` imports above `import App`.
1. L2 (UI-X) Re-shoot all 20 variants and run the design-critic.
1. L3 (W1-G, optional, 1 file) `EMRButton.tsx:395-419`: pass a variant to Mantine Button, so `filled` never sits underneath.

**Affected files (verified to exist).** `src/main.tsx`, `src/components/common/EMRButton.tsx`

**Done when.** The design-critic counts 1 gradient primary per study screen. The destructive confirm computes to the danger colour, not rgb(43,108,176).

**Handoff → `frontend-designer`**

```text
Angio repo, fence W1-G. Source trace C1 (CONFIRMED by live rule trace): `src/main.tsx:4` imports App (evaluating every component CSS module) before `@mantine/core/styles.css` (`:8`), so Mantine's `.m_77c9d27d` filled background beats EMRButton's secondary/ghost/danger classes on equal specificity. Move ONLY the three @mantine/* CSS imports above `import App`; keep theme.css and print.css where they are. Then re-shoot intake + 4 study screens (ka, 1440 light/dark, 768, 375) and confirm: one gradient primary per screen, danger confirm red. Optional second layer: `src/components/common/EMRButton.tsx:395-419` pass a Mantine variant. Report every screen whose look changed beyond buttons.
```

### UX-ANGIO-022 — Dark mode: unchosen studies show no tick, and diagram labels stay readable

**Band:** UI-X lane · **Type:** `relabel` · **Label:** CONFIRMED (C22 for the tick, C23 silhouette). HYPOTHESIS (source trace): the same global icon rule inverts the stepper and hides the moon icon · **Effort:** S · **Risk tier:** low · **Fence:** W1-D (L1) · W1-G (L2, L3)

**In plain language.** In dark mode every study card on the start page shows a tick even when it is not chosen, while a warning says none is chosen. On the anatomy diagram the body outline stays light, so the R/L labels disappear and the black occlusion swatch vanishes. After this change chosen and unchosen look different in both themes, and the diagram reads correctly in dark.

**Evidence.**
- Tasks: — (no walk task; ledger / critic / standing-check evidence)
- Events: —
- Screenshots / artefacts: `documentation/level-up/runs/angio-module-2026-11-12/screens/intake-dark.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/venous-le-dark.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/arterial-le-dark.png`
- Prior findings subsumed: U-1021, U-1024
- Source trace: C22 `theme.css:3728-3734` `.tabler-icon { color:#fff !important }` defeats `.studyCardCheck { color: transparent }` (`EncounterIntake.module.css:643-655`); icon always rendered (`EncounterIntake.tsx:884-890`). C23 `AnatomyView.tsx:180-183` rewrites only the silhouette stroke; the SVGs ship `fill="#f7fafc"`; side labels rewritten to `--emr-text-primary` (`:195-198`).

**Clicks saved per shift.**
Composition/legibility move. **0 clicks/shift.**

**Risk.** Low if scoped. Deleting the global dark icon rule would have a large blast radius, so the fix stays scoped.

**Do not touch.**
- AnatomyView's `dangerouslySetInnerHTML` / react/no-danger exception stays exactly as it is. Only the string-rewrite list grows.
- Don't delete the global dark `.tabler-icon` rule. Scope the fix.
- The same anatomy SVG still feeds the PDF (`anatomyToPdfSvg.ts`); the PDF is light, so the rewrite applies to the screen only.

**Staging (each layer ships and reverts on its own).**
1. L1 (W1-D, 1 file) `EncounterIntake.tsx:884-890`: render the tick only when the card is checked.
1. L2 (W1-G, 1 file) `AnatomyView.tsx:180-183`: extend the existing regex rewrite (sibling `:189-198`) to the silhouette fill.
1. L3 (W1-G, 1 file) `AnatomyLegend.tsx`: hairline border on black swatches. Then test the stepper/moon HYPOTHESIS (disable the rule in DevTools).

**Affected files (verified to exist).** `src/components/layout/EncounterIntake.tsx`, `src/components/anatomy/AnatomyView.tsx`, `src/components/anatomy/AnatomyLegend.tsx`

**Done when.** Intake dark at 1440: unchosen cards show an empty circle. Venous and arterial dark: R/L labels and the occlusion swatch are visible. The critic passes the dark variants.

**Handoff → `ui-upgrade`**

```text
/ui-upgrade / and /encounter/<id>/venousLEBilateral in dark mode (fences W1-D for the intake tick, W1-G for AnatomyView/AnatomyLegend). Source trace C22/C23 (CONFIRMED): the global `theme.css:3728-3734` dark `.tabler-icon` rule makes the hidden-by-colour tick visible (`EncounterIntake.tsx:884-890`); render the tick only when checked instead of touching the global rule. `AnatomyView.tsx:180-183` rewrites only the silhouette stroke; extend the existing regex rewrite (`:189-198`) to the fill, without touching the dangerouslySetInnerHTML pattern. Hairline on black legend swatches. Verify ka dark at 1440.
```

### UX-ANGIO-023 — Page and cards are different shades again (page token)

**Band:** UI-X lane · **Type:** `relabel` · **Label:** CONFIRMED (C2) · **Effort:** S · **Risk tier:** low · **Fence:** W1-G

**In plain language.** In light mode the page and the cards are the same white, so the sections of every screen blur into one sheet. The reference design uses a pale grey page under white cards. After this change one colour value restores that separation, and the older cards get the same floating-card look as the rest.

**Evidence.**
- Tasks: — (no walk task; ledger / critic / standing-check evidence)
- Events: —
- Screenshots / artefacts: `documentation/level-up/runs/angio-module-2026-11-12/screens/intake-default.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/venous-le-default.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/carotid-768.png`
- Prior findings subsumed: critic elevation-contrast (11 findings, all 5 screens, light variants)
- Source trace: C2 `theme.css:149-150` page = card = #ffffff; reference `deep-dive.html:67-68` (`--paper:#e7ebf1`); amplifiers `RecommendationsBlock.module.css:9-12`, `ImpressionBlock.module.css:11-14`, `StudyHeader.module.css:4-7`; deck sibling `EMRContentSection.module.css:26-30`.

**Clicks saved per shift.**
Composition move. **0 clicks/shift.**

**Risk.** Low to medium: 46 uses of `--emr-bg-page` outside theme.css; some inset fills turn grey and need a visual pass.

**Do not touch.**
- Dark values unchanged (`theme.css:1569-1570` already differ).
- §4.1: the value comes from the reference file. No new token name.

**Staging (each layer ships and reverts on its own).**
1. L1 (W1-G, 1 file) `theme.css:149`: `--emr-bg-page` set to the reference page value.
1. L2 (W1-G, ≤3 files) `ImpressionBlock.module.css`, `StudyHeader.module.css` (and `RecommendationsBlock.module.css` together with UX-ANGIO-027): the deck style of `EMRContentSection.module.css:26-30`.
1. L3 (W1-G) Visual pass of the inset uses (`CEAPPicker.module.css:161,249`, `SVPPicker.module.css:100,125`, `ImpressionBlock.module.css:91`, `DrawingToolbar.module.css:16`).

**Affected files (verified to exist).** `src/styles/theme.css`, `src/components/form/ImpressionBlock.module.css`, `src/components/form/StudyHeader.module.css`, `src/components/form/CEAPPicker.module.css`, `src/components/form/SVPPicker.module.css`, `src/components/anatomy/DrawingToolbar.module.css`

**Done when.** Metrics pageBg ≠ cardBg with a contrast ratio ≥ 1.05 on all 5 light screens. The critic clears elevation-contrast.

**Handoff → `ui-upgrade`**

```text
/ui-upgrade (all 5 in-scope screens, light; fence W1-G). Source trace C2 (CONFIRMED): `src/styles/theme.css:149-150` sets --emr-bg-page = --emr-bg-card = #ffffff. Set the page value from `src/styles/reference-screenshots/deep-dive.html:67` (--paper). Move the older decks (ImpressionBlock, StudyHeader) to the EMRContentSection deck style (`EMRContentSection.module.css:26-30`: card bg, no border, --emr-shadow-card). Then check the inset uses listed in the move. Dark unchanged. Re-run composition-metrics for elevation-contrast.
```

### UX-ANGIO-024 — Action bars wrap on a phone instead of pushing the page sideways

**Band:** UI-X lane · **Type:** `relabel` · **Label:** CONFIRMED (C11 study bar, C12 intake footer; live widths) · **Effort:** S · **Risk tier:** low · **Fence:** W1-B (L1) · W1-D (L2) · W2-venous (L3)

**In plain language.** On a 375 px phone every study page is 556-580 px wide, and the PDF buttons sit off screen. On the start page the main 'start studies' button is cut off. The bars are already told to wrap; one setting stops them. After this change both bars wrap and the page fits the screen.

**Evidence.**
- Tasks: — (no walk task; ledger / critic / standing-check evidence)
- Events: —
- Screenshots / artefacts: `documentation/level-up/runs/angio-module-2026-11-12/screens/arterial-le-375.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/intake-375.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/iliac-pelvic-venous-375.png`
- Prior findings subsumed: U-1014, critic 375 overflow (venous, arterial, carotid, iliac)
- Source trace: C11 `FormActions.module.css:69-76` `flex-shrink: 0` on `.buttons` (live 544px group); minor second root: the `SegmentAssessmentCard` header `Group wrap="nowrap"` (498px). C12 `EncounterIntake.module.css:1003-1012, 1039-1040`.

**Clicks saved per shift.**
Layout move. **0 clicks/shift.**

**Risk.** Low. One declaration per bar.

**Do not touch.**
- §4.5: Georgian button labels wrap inside the button; they never truncate.
- The bar stays sticky.

**Staging (each layer ships and reverts on its own).**
1. L1 (W1-B, 1 file) `FormActions.module.css:73`: `flex-shrink: 1; min-width: 0` (sibling `.inner` :16-25).
1. L2 (W1-D) Intake footer: shipped inside UX-ANGIO-009 L1 (same button).
1. L3 (W2-venous, 1 file) `SegmentAssessmentCard.tsx` header Group allows wrap.

**Affected files (verified to exist).** `src/components/form/FormActions.module.css`, `src/components/layout/EncounterIntake.module.css`, `src/components/form/SegmentAssessmentCard.tsx`

**Done when.** At 375 `document.documentElement.scrollWidth` = 375 on the intake and all 4 study pages, and the PDF buttons are on screen.

**Handoff → `ui-upgrade`**

```text
/ui-upgrade at 375×812, ka (fence W1-B for FormActions.module.css). Source trace C11 (CONFIRMED live): `src/components/form/FormActions.module.css:69-76` `.buttons { flex-shrink: 0; flex-wrap: wrap }`, so the group is max-content (544px) and widens the page to 556-580px. Make it shrinkable (flex-shrink: 1; min-width: 0) so its own wrap takes effect. The intake footer half ships with UX-ANGIO-009; the SegmentAssessmentCard header nowrap is a later W2-venous layer. Verify scrollWidth = 375 on all 4 study pages.
```

### UX-ANGIO-025 — The anatomy diagram sits beside the table it explains

**Band:** UI-X lane · **Type:** `merge-surfaces` · **Label:** CONFIRMED (C13; specified in the venous header comment and never built) · **Effort:** M · **Risk tier:** medium · **Fence:** W2-arterial · W2-venous · W2-carotid · W2-iliac (one layer each)

**In plain language.** On every study page the diagram sits 1,500 to 3,000 px below the table it colours, so the clinician never sees the finding and its picture together. The arterial page even leaves a 1,600 px empty column beside its table. After this change, on a wide screen, the diagram stays beside the table as the clinician scrolls. Smaller screens keep today's stacked order.

**Evidence.**
- Tasks: `4c683280f693`, `454da3f3a800`, `b9b131e672b8`, `03a18f254204`
- Events: —
- Screenshots / artefacts: `documentation/level-up/runs/angio-module-2026-11-12/screens/venous-le-default.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/arterial-le-default.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/carotid-default.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/iliac-pelvic-venous-default.png`
- Prior findings subsumed: critic density-tier "ONE focal element" on venous, arterial, carotid, iliac
- Source trace: C13 `VenousLEForm.tsx:1200-1247` (planned layout in the header comment `:9-12`), `ArterialLEForm.tsx:770-841`, `CarotidForm.tsx:721-743`, iliac likewise; `AnatomyDiagramSection` is shared (4 callers) and needs no change. Walk notes: diagram ~3,000 px down (4c683280f693 obs s19), ~2,400 px (03a18f254204 obs s18), CEAP ~4,600 px down (b9b131e672b8 obs s21).

**Clicks saved per shift.**
Scrolling, not clicks. **0 clicks/shift.**

**Risk.** Medium: 4 per-form layout edits. Arterial is closest to S (it shares a layer with UX-ANGIO-015).

**Do not touch.**
- `AnatomyDiagramSection` is shared and unchanged. Only each form's layout changes.
- AnatomyView's react/no-danger exception is untouched.
- §4.4: screen-only layout. The PDF layout is unchanged.
- Sticky only at ≥1280px; below that, the stacked order stays. No animation over 200 ms.

**Staging (each layer ships and reverts on its own).**
1. L1 (W2-arterial, 1-2 files) Arterial: diagram beside the full-width table (with UX-ANGIO-015).
1. L2 (W2-venous, 1-2 files) Venous: build the header-comment layout.
1. L3 (W2-carotid, 1-2 files) Carotid: diagram in the ~35% empty right width; NASCET under it.
1. L4 (W2-iliac, 1-2 files) Iliac: diagram in the ~380 px dead right rail.

**Affected files (verified to exist).** `src/components/studies/arterial-le/ArterialLEForm.tsx`, `src/components/studies/arterial-le/ArterialLEForm.module.css`, `src/components/studies/venous-le/VenousLEForm.tsx`, `src/components/studies/venous-le/VenousLEForm.module.css`, `src/components/studies/carotid/CarotidForm.tsx`, `src/components/studies/carotid/CarotidForm.module.css`, `src/components/studies/iliac-pelvic-venous/IliacPelvicVenousForm.tsx`, `src/components/studies/iliac-pelvic-venous/IliacPelvicVenousForm.module.css`

**Done when.** At 1440×900, on all 4 study screens, the first abnormal table row and its diagram segment are in the viewport together. The critic clears "ONE focal element".

**Handoff → `frontend-designer`**

```text
Angio repo, one study fence at a time (W2-arterial first, then venous, carotid, iliac). Source trace C13 (CONFIRMED): each form stacks `AnatomyDiagramSection` after its segment table (`VenousLEForm.tsx:1200-1247`, `ArterialLEForm.tsx:770-841`, `CarotidForm.tsx:721-743`, iliac likewise). The venous header comment (`VenousLEForm.tsx:9-12`) specifies `AnatomyView │ SegmentTable` side by side. At ≥1280px place the diagram in a sticky column beside the table (reference `src/styles/reference-screenshots/deep-dive.html`); below 1280 keep the stack. Do not change AnatomyDiagramSection or AnatomyView. Arterial: do it with UX-ANGIO-015 (table full row + diagram beside). Prove at 1440×900 in ka: the abnormal row and the coloured segment are visible together.
```

### UX-ANGIO-026 — One named card per segment below desktop, and empty rows stay compact

**Band:** UI-X lane · **Type:** `merge-surfaces` · **Label:** CONFIRMED (C8 venous split record, C10 card collapse ×3 copies). HYPOTHESIS (source trace): `EMRTable` sticky-left columns can host the inline inputs · **Effort:** L · **Risk tier:** medium · **Fence:** W2-venous · W2-arterial · W2-carotid · W2-iliac (one layer each)

**In plain language.** On a tablet the venous page splits each vein into two cards far apart, and arterial, carotid and pelvic turn 21-34 mostly empty rows into full-size cards, so a normal study is 13-15 screens tall. After this change each vein is one named card, empty rows stay one line until used, and the pelvic side header stays pinned while scrolling. Every field stays where it is today.

**Evidence.**
- Tasks: — (no walk task; ledger / critic / standing-check evidence)
- Events: —
- Screenshots / artefacts: `documentation/level-up/runs/angio-module-2026-11-12/screens/venous-le-768.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/carotid-768.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/iliac-pelvic-venous-768.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/arterial-le-768.png`
- Prior findings subsumed: U-1022 (M layer; the S safety layer is UX-ANGIO-004 L1), X-TABLE (compaction), critic empty-state-parity / density-tiers at 768/375
- Source trace: C8 `SegmentAssessmentCard.tsx:206-235` (two tables side by side); arterial/carotid one-row shape `ArterialSegmentTable.tsx:186`, `CarotidSegmentTable.tsx:185`; card collapse copies `ArterialSegmentTable.module.css:205-234`, `CarotidSegmentTable.module.css:154-182`, `IliacCavalTable.module.css:106-155`.

**Clicks saved per shift.**
Scrolling, not clicks. **0 clicks/shift.**

**Risk.** Medium. Merging the venous two-table record is the structural part. Compaction is per-copy CSS.

**Do not touch.**
- §4.8: every field stays reachable. An empty row compacts and never disappears.
- §4.3: segment lists and order unchanged.
- §4.7: no shared generic segment-table component is required. Copy the arterial/carotid shape per study.
- Verify the EMRTable HYPOTHESIS before adopting it (kill criterion: no cell-renderer slot for editable controls).

**Staging (each layer ships and reverts on its own).**
1. L1 (W2-venous, ≤3 files) Venous: one row/card per segment carrying the categorical and numeric fields (the arterial/carotid shape) in `SegmentAssessmentCard.tsx`, with `SegmentTable`/`ReflexTimeTable` behind a flag.
1. L2 (W2-arterial, 1 file) `ArterialSegmentTable.module.css:205-234`: compact empty rows below 992px.
1. L3 (W2-carotid, 1 file) `CarotidSegmentTable.module.css:154-182`: the same.
1. L4 (W2-iliac, 1-2 files) `IliacCavalTable.module.css:106-155`: the same, plus a sticky side group header.

**Affected files (verified to exist).** `src/components/form/SegmentAssessmentCard.tsx`, `src/components/studies/arterial-le/ArterialSegmentTable.module.css`, `src/components/studies/carotid/CarotidSegmentTable.module.css`, `src/components/studies/iliac-pelvic-venous/IliacCavalTable.module.css`

**Done when.** At 768 a normal study of each type is ≤6 viewports tall (today 13-15). Every card carries its segment and side. Critic P0/P1 density findings clear.

**Handoff → `speckit`**

```text
Spec seed — Segment entry below desktop (angio, run angio-module-2026-11-12).
Problem: below 1200px the venous form shows one segment as two cards in two separate stacks (`SegmentAssessmentCard.tsx:206-235` puts SegmentTable and a headless ReflexTimeTable side by side), and arterial, carotid and pelvic collapse 21-34 rows into full-size cards whether empty or not (`ArterialSegmentTable.module.css:205-234`, `CarotidSegmentTable.module.css:154-182`, `IliacCavalTable.module.css:106-155`). Measured: pelvic 768 = 13,848 px tall, carotid 24 cards × ~560 px, venous 768/375 critic P0 (an anonymous abnormal 1.8 s card).
Success criteria: one named, sided card per segment on every study; an empty row is one line until touched; the pelvic side header stays pinned; a normal study at 768 is ≤6 viewports tall; every field is still reachable; FHIR and PDF are unchanged; thin layers, one study per layer, ≤3 files per step. Venous first (the arterial/carotid one-row shape is the precedent). The EMRTable reuse is a hypothesis to test, not a requirement.
```

### UX-ANGIO-027 — An empty Recommendations section becomes one quiet row

**Band:** UI-X lane · **Type:** `relabel` · **Label:** CONFIRMED (C14) · **Effort:** S · **Risk tier:** low · **Fence:** W1-G

**In plain language.** When no recommendation has been added, the Recommendations section is the loudest box on the page: a coloured top ribbon, an icon tile, a solid add button and a large dashed placeholder, taller than when it has content. After this change it is a single quiet row with an 'add' button, and the delete button on each recommendation is called 'delete' instead of 'close'.

**Evidence.**
- Tasks: `42d763c1e133`
- Events: `39f333a8fa95`
- Screenshots / artefacts: `documentation/level-up/runs/angio-module-2026-11-12/screens/venous-le-default.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/arterial-le-default.png`, `documentation/level-up/runs/angio-module-2026-11-12/screens/carotid-default.png`
- Prior findings subsumed: critic empty-state-parity (venous, arterial, carotid, all variants)
- Source trace: C14 `RecommendationsBlock.tsx:82-103` (primary add button, padded empty block), `RecommendationsBlock.module.css:22-28` (ribbon), `:94-100`; sibling `EMRContentSection` with `showAccent={false}` (`VenousLEForm.tsx:1218-1222`).

**Clicks saved per shift.**
Composition move. **0 clicks/shift.**

**Risk.** Low. One shared component, 3 callers.

**Do not touch.**
- The add-recommendation capability and its data shape are unchanged.
- §4.1: secondary button variant, existing deck style.

**Staging (each layer ships and reverts on its own).**
1. L1 (W1-G, 2 files) `RecommendationsBlock.tsx` + `.module.css`: drop the ribbon and the dashed block; the empty state is one header row with a secondary add button and one muted line (deck style shared with UX-ANGIO-023 L2).
1. L2 (W1-G, 1 file) The trash button's accessible name means 'delete' (key via W1-H).

**Affected files (verified to exist).** `src/components/form/RecommendationsBlock.tsx`, `src/components/form/RecommendationsBlock.module.css`

**Done when.** Empty deck height ≤ populated deck height on venous, arterial and carotid. The critic clears empty-state-parity. The trash button is announced as delete.

**Handoff → `ui-upgrade`**

```text
/ui-upgrade on the Recommendations deck (venous, arterial, carotid; fence W1-G, `src/components/form/RecommendationsBlock.tsx` + `.module.css`). Source trace C14 (CONFIRMED): pre-Command empty state (3px gradient ribbon `.card::before` :22-28, padded dashed empty block :94-100, primary add button :82-90) makes the empty deck 223px vs 137px populated. Collapse the empty state to one slim header row (4×15 tick + title), a secondary add button and one muted line; use the EMRContentSection deck style. Rename the row trash button's accessible name to 'delete' (key to the i18n fence). Verify in ka at 1440 and 768.
```

## Fence map (no shared files inside a wave)

Rule for translations: **W1-H owns every `src/translations/**.json`**. Every other fence hands its ka/en/ru keys to W1-H, and the orchestrator merges them at wave end. Files that move between fences move sequentially (released → taken), never shared. Files with uncommitted clinician-feedback WIP (`git status`: `ArterialLEForm.tsx`, `CarotidForm.tsx`, `IliacPelvicVenousForm.tsx`, `IliacCavalTable.tsx/.module.css`, iliac `templates.ts`, `NASCETPicker.tsx`, `buildReportLabels.ts`, `DrawingToolbar.tsx`, `theme-colors.ts`): workers build on top and never revert.

| Wave | Fence | Owns (files) | Moves / layers |
|---|---|---|---|
| 1 | W1-A Draft core | `src/contexts/EncounterContext.tsx`, `src/services/encounterStore.ts`, `src/components/studies/arterial-le/ArterialLEForm.tsx` (001 L1 only, then released to W2-arterial) | 001 L1–L2, 002 L1 |
| 1 | W1-B Report action bar | `src/components/form/FormActions.tsx`, `src/components/form/FormActions.module.css` | 001 L3, 002 L2, 008, 014, 024 L1 |
| 1 | W1-C Venous report + venous labels | `src/components/pdf/sections/FindingsTable.tsx`, `src/components/pdf/buildReportLabels.ts`, `src/components/form/ReflexTimeTable.tsx`, `src/components/form/ReflexTimeTable.module.css`, `src/components/form/SegmentTable.module.css` | 003 L1/L3, 004 L1–L2 |
| 1 | W1-D Start page + visits | `src/components/layout/EncounterIntake.tsx`, `src/components/layout/EncounterIntake.module.css`, `src/components/layout/OngoingVisitsPanel.tsx`, `src/constants/storage-keys.ts`, `src/App.tsx` | 009, 010, 017, 022 L1, 024 L2, 012 L5 (after 012 L4) |
| 1 | W1-E Banner | `src/components/layout/EncounterContextBanner.tsx`, `src/components/layout/EncounterContextBanner.module.css` | 012 L1–L2 |
| 1 | W1-F Arterial grading + pressures, iliac side | `src/components/studies/arterial-le/SegmentalPressureTable.tsx` (+ `.module.css`), `src/components/studies/arterial-le/abiCalculator.ts`, `src/components/studies/arterial-le/templates.ts`, `src/components/studies/iliac-pelvic-venous/IliacCavalTable.tsx` (then released to W2-iliac) | 004 L3–L4, 006 (after S6) |
| 1 | W1-G Shared chrome (UI-X lane) | `src/main.tsx`, `src/components/common/EMRButton.tsx`, `src/styles/theme.css`, `src/components/common/EMRContentSection.tsx`, `src/components/common/EMRCollapsibleSection.tsx`, `src/components/form/CEAPPicker.tsx`, `src/components/form/CEAPPicker.module.css`, `src/components/form/SVPPicker.module.css`, `src/components/form/RecommendationsBlock.tsx`, `src/components/form/RecommendationsBlock.module.css`, `src/components/form/ImpressionBlock.module.css`, `src/components/form/StudyHeader.module.css`, `src/components/anatomy/AnatomyView.tsx`, `src/components/anatomy/AnatomyLegend.tsx`, `src/components/anatomy/DrawingToolbar.module.css` | 016, 018, 021, 022 L2–L3, 023, 027 |
| 1 | W1-H Georgian / i18n | every `src/translations/**.json`, `scripts/check-i18n.ts`, `src/components/studies/carotid/NASCETPicker.tsx`, `src/services/dateHelpers.ts`, `src/components/studies/arterial-le/ArterialSegmentTable.tsx`, `src/components/layout/BackToStudiesButton.tsx` | 020, 005 L1, all key hand-overs |
| 1 | W1-I Drawing | `src/components/anatomy/DrawingToolbar.tsx`, `src/components/anatomy/DrawingCanvas.tsx` | 019 |
| 2 | W2-venous | `src/components/studies/venous-le/VenousLEForm.tsx`, `src/components/studies/venous-le/VenousLEForm.module.css`, `src/components/form/SegmentAssessmentCard.tsx` | 002 L3a, 005 L2–L3, 012 L4, 013, 024 L3, 025 L2, 026 L1 |
| 2 | W2-arterial | `src/components/studies/arterial-le/ArterialLEForm.tsx` (after W1-A), `src/components/studies/arterial-le/ArterialLEForm.module.css`, `src/components/studies/arterial-le/ArterialSegmentTable.module.css` | 002 L3a, 005 L2–L3, 015, 025 L1, 026 L2 |
| 2 | W2-carotid | `src/components/studies/carotid/CarotidForm.tsx`, `src/components/studies/carotid/CarotidForm.module.css`, `src/components/studies/carotid/CarotidSegmentTable.module.css` | 002 L3b, 005 L2–L3, 025 L3, 026 L3 |
| 2 | W2-iliac | `src/components/studies/iliac-pelvic-venous/IliacPelvicVenousForm.tsx`, `.../IliacPelvicVenousForm.module.css`, `.../IliacCavalTable.tsx` (after W1-F), `.../IliacCavalTable.module.css`, `.../templates.ts` | 002 L3b, 011 L2, 025 L4, 026 L4 |
| 3 | W3-perforator (after S7) | `src/components/studies/venous-le/config.ts`, `src/constants/theme-colors.ts`, `src/components/form/SegmentTable.tsx`, `src/constants/fhir-systems.ts`, `src/services/fhirBuilder/observations/venous.ts`, `src/components/anatomy/AnatomyLegend.tsx` (after W1-G) | 007, then 003 L2 |

Wave 2 exists because the four study form files are wanted by six moves (002 L3, 005, 011, 012 L4, 013, 015, 025, 026). Splitting wave 2 **per study** keeps each fence inside one study, which is also how the partial plugin pattern (CLAUDE.md) groups a study's files.

## Finding coverage (every open U-id)

| Finding | Covered by |
|---|---|
| U-1000, U-1025 | fixed in the early lane (not re-planned) |
| U-1002 | 008 |
| U-1003 | 001 |
| U-1004 | 020 (+008 tooltip key) |
| U-1005 | 020 L1 |
| U-1006 | 020 L3 |
| U-1007 | 020 L4 (hypothesis location) |
| U-1011, U-1033 | 003 (S4) |
| U-1014 | 024 + 009 L1 |
| U-1015 | 015 (+020 aria) |
| U-1016 | 009 |
| U-1017, U-1036 | 002 |
| U-1021, U-1024 | 022 |
| U-1022 | 004 L1 (safety) + 026 L1 (structure) |
| U-1023 | 004 L4 |
| U-1026 | 006 (S6) |
| U-1027 | 007 (proposed S7) |
| U-1028 | 012 |
| U-1029 | 017 |
| U-1030 | 011 |
| U-1031 | 005 + 021 |
| U-1032 | do-not-do 5 (product decision) |
| U-1034 | 014 |
| U-1035 | 009 L2–L3, 010, 017 L2 |
| U-1037 | 004 L2 |
| U-1001, U-1008, U-1009, U-1010, U-1012, U-1013 | outside the UX plan: real-lens report-content package (PDF filename, legends, headings, occlusion mark, notes, page layout). U-1010 heading wording goes to sign-off if it counts as narrative text |
| U-1018, U-1019, U-1020 | outside the UX plan: real-lens package (stale e2e selectors, Observation.effectiveDateTime, test-pdf.ts coverage) |

## What we deliberately will not touch, and why

- **The bare study addresses stay as they are.** `/venous-le`, `/arterial-le`, `/carotid` keep redirecting to the start page (audit Part-03 HIGH). The scroll fix in UX-ANGIO-017 sits outside the route list.
- **Clinical abbreviations and segment names are not translated or renamed by an agent.** The walkers flagged 'GSV Mid Thigh', 'SPJ', 'CCA Prox' as English (`674658059cad`, `144e7ad73ac9`). They are the clinical standard; the full Georgian name is already in the tooltip and the screen-reader name. Showing them differently is a clinician's call (founder list, type C).
- **No clinical value is decided here.** TBI cut-offs (S6), the venous PDF column set (S4), pelvic normal phasicity (S5), perforator as its own value (proposed S7), and the pelvic SVP defaults. The walker saw S0/V0 pre-ticked on a congestion study, and a new P row defaulting to 'CIV / left / obstruction', which had to be unticked (`4f1b689e4374` obs s17). All of these go to the founder list.
- **The OV row and the separate left-gonadal section are not merged** (`7aca4e55bc9e`). One vein recorded in two places is a consistency risk, but which place is canonical is a clinical decision (founder list).
- **The pelvic diagram is neither dropped nor made colourable** (U-1032). Dropping it removes a capability (§4.8); making it colourable adds one. That is a product decision for the founder list. Until it is made, task `fd309042464d` cannot meet its done criterion.
- **The anatomy colours are not changed.** The walker saw that 'normal' is the same grey as 'not yet assessed' (`03a18f254204` obs s18). The palette was set by today's clinician feedback (uncommitted in `theme-colors.ts` / `severityColor.ts`), so this goes to the founder list (type C).
- **Both ways to edit visit details stay**: the row 'Edit' on the start page and the pencil in the study banner (`a11e114fcb08`). They serve different starting points. Only the English 'Edit' label is fixed.
- **The draw-mode switch stays.** It is the warrant behind the ratified 3-click annotate budget (D6) and prevents stray strokes while scrolling.
- **The in-progress list is not opened for everyone.** Folded is a deliberate default that keeps the new-patient form high on the page. It is remembered per device instead (UX-ANGIO-009).
- **No generic study plugin and no shared segment-table component** (§4.7). Each study keeps its own table; layouts are copied study by study.
- **Saving is not fixed with a debounce or a state library** (CLAUDE.md). The arterial loop fix removes a timer; it does not add one.
- **The anatomy diagram's one special rendering exception stays exactly as it is** (`react/no-danger` in AnatomyView). Only its colour-rewrite list grows (UX-ANGIO-022).
- **No budget is retuned.** The pelvic SVP task (10 clicks vs 6) is mostly mandatory clinical fields across three domains. Whether the 'order 6' class fits SVP is a question for the orchestrator, not a move.
- **Untraced observations are not acted on yet.** Each needs a source trace first: the pelvic form shows sex 'მდედრი' although none was entered at intake (`0a46facacdbc` obs s4, a possible clinical default); venous narrative boxes are not pre-drafted from findings (`5cb8f72c92e1` obs s19); truncated cell values 'სრუ×' (`03a18f254204` obs s8); the CEAP C0 chip label overflows (`b9b131e672b8` obs s21); truncated carotid plaque placeholders (`8c0da8eda1da`).

## §4 constraint check (every move)

| § | Constraint | How the plan honours it |
|---|---|---|
| 1 | Command is a style contract; IA restructuring allowed | Every visual change uses existing tokens and wrappers. 021 makes the already-written variants show; 023 takes its value from the reference file. No animation over 200 ms (017 scrolls instantly). |
| 2 | Encounter-first routing; bare routes stay redirects | 009 and 012 reuse existing routes; 017 sits outside `<Routes>`; no wildcard. |
| 3 | Clinical content is not a UX lever | 003, 006 and 007 are gated on S4, S6 and S7. 011 and 013 reuse today's values. 004 changes visibility only. Abbreviations are on the do-not-do list. |
| 4 | FHIR valid, PDF parity | 003 L2, 007 L3 and 012 run `validate:fhir`. 008 and 014 reuse the existing renderers. 025 changes screen layout only. |
| 5 | ka-first; no clipping | 004, 009, 015, 020 and 024 carry explicit 375 re-shoots; 015 refuses to trim the label column. |
| 6 | Thin reversible layers, ≤3 files per step | Every staging step names ≤3 files; multi-study moves step one study at a time. |
| 7 | No generic plugin signature | 011 and 013 copy reducer cases; 026 copies the arterial/carotid row shape per study. |
| 8 | Coverage floor | Nothing is removed: 005 keeps reset, 026 compacts and never hides, 001 removes a self-rewrite loop, not a capability. |
| 9 | Founder vocabulary | Titles and "In plain language" paragraphs were checked by script for the banned words. |

## Method notes

- **Lens.** Angio has no login, roles or seats, so both personas walk the same app with the same capabilities. There is no admin lens to disclose.
- **Heuristics source.** `.agents/skills/ui-ux-pro-max/data/ux-guidelines.csv` does not exist in this repo. It was read (read-only, 99 rows) from the MediMind checkout at `/Users/toko/Desktop/medplum_medimind/.agents/skills/ui-ux-pro-max/data/ux-guidelines.csv`. Pipeline lesson: vendor it into angio, or point the agent at it.
- **Frequencies.** `frequencyPerShift` is per persona's own shift. "Clicks/shift" in this plan adds the sonographer's and the physician's shifts.
- **Instrument effect 1: step-1 carry-over.** The walker records step 1 (`navigate-entry`) with `fpBefore` = the previous task's last screen, and the scorer seeds `visited` with it. Results: 10 wrong turns labelled "entered '?'" (`c7dfe0ab6df3`, `acc5fee22063`, `8124cc92e2dc`, `b108a59ba1ab`, `0263cd88eca8`, `1424d190a549`, `ca23a8bdca80`, `07d2d9969f5c`, `4cdb2f2f9121`, `c3b1366c07b4`), and 3 off-viewport HIGH events on non-arterial tasks (`15bf88a468d8`, `4b299a79f329`, `42143e4ad29c`). Tasks `03a18f254204`, `831ea4f62f94` and `802d04f6063d` are HIGH only because of it. This is the source trace's attribution HYPOTHESIS. I ran its kill-criterion (the screens rows point at `/arterialLE`) and it survived, but the mechanism is step-1 carry-over, not screen batching. The label stays HYPOTHESIS. Suggested scorer fix: seed `visited` from the navigate-entry step's `fpAfter`.
- **Instrument effect 2: persistence probe.** Walkers checked persistence inside the task (back → toggle → resume). Those 3 clicks count as task clicks, and the back step counts as a wrong turn (`454da3f3a800`, `4c683280f693`, `5cb8f72c92e1`; wrong turns `20e903b55229`, `1871de911064`, `e61f52b727fe`). Suggested walk-recorder fix: a `probe` step kind excluded from clicks.
- **Instrument effect 3: dead clicks.** 63 (42 + 21) are quoted as scored. By label, most are dropdown opens and option picks, chip and checkbox picks, card selections and new-tab exports: the page changes, but not by route, dialog or testid set. Only `5160fff884bb`, `773b88b701a8` and `b29ecdc3af06` (hypothesis) are used as evidence of a real dead click.
- **Instrument effect 4: template wrong turns.** Opening the template gallery (a dialog), applying a template and closing it counts as a wrong turn, because applying is not a `fill` (`70acf40afb36`, `de265fab3553`). The walker's reload slip `20840e03736d` ('640') is also not product friction.
- **Budget composition.** `angio-switch` and `angio-annotate` are defined from an open study form, but every walk enters at `/` behind a folded list, so 2 entry clicks always count against them. In `0a46facacdbc` the switch itself is 1 click, within budget. A composite like D4 (`angio-resume-export`) would fix the yardstick. That is the orchestrator's call, not ratified here.
- **Pane switches.** These walks record `paneKey`, so backtracks and wrong turns are measurable and `deadClicks` already excludes pane switches. This is the first run, so there are no comparability breaks.
- **Print task.** `7ddfddbf4c8b` carries the walker's own measurement limit (it cannot drive the browser PDF viewer). UX-ANGIO-014 starts with a human check.
- **Ledger.** `qa-reports/ux/friction-ledger.json` has an empty `planItems`. This is the first run, and the ledger duty applies to re-runs only, so the ledger was **not** written. Recommendation: the orchestrator seeds `planItems` with this TOP-10 (`proposedRun: angio-module-2026-11-12`, status `proposed`) so the next run can grade them.
- **Schema.** The §3.8 type enum has no data-integrity value, so safety moves use `remove` / `relabel`; read the band, not the type. `moves.json` adds the keys band, label, riskTier, fence, doneWhen, arithmetic, sourceTrace and top10 alongside the schema fields.
- **Architect-originated labels.** Five items come from the architect's own code reads and are labelled as such: 009 panel fold (CONFIRMED by reading the deliberate comment), 013 reducer side (HYPOTHESIS), 016 header propagation (HYPOTHESIS), 018 title element (CONFIRMED by reading), and 020 date default (HYPOTHESIS). No source-trace HYPOTHESIS was upgraded.

## Top 15 at a glance

| # | Move | Clicks saved/shift | Effort | Risk | Files |
|---|---|---|---|---|---|
| UX-ANGIO-001 | Stop an open visit from silently erasing edits made in another tab | 0 | M | medium | ArterialLEForm.tsx, EncounterContext.tsx, encounterStore.ts, FormActions.tsx |
| UX-ANGIO-002 | Make the 'saved' line tell the truth, and show a failed save | 0 | M | low | EncounterContext.tsx, encounterStore.ts, FormActions.tsx, FormActions.module.css, VenousLEForm.tsx, ArterialLEForm.tsx, CarotidForm.tsx, IliacPelvicVenousForm.tsx |
| UX-ANGIO-003 | The venous report prints every finding the clinician recorded | 0 | M | medium | FindingsTable.tsx, buildReportLabels.ts, venous.ts |
| UX-ANGIO-004 | Every segment row shows its leg and its name, right side first | 0 | S | low | ReflexTimeTable.tsx, ReflexTimeTable.module.css, SegmentTable.module.css, IliacCavalTable.tsx, SegmentalPressureTable.tsx, SegmentalPressureTable.module.css |
| UX-ANGIO-005 | The in-form 'new study' button says it clears the form, and looks like it | 0 | S | low | VenousLEForm.tsx, VenousLEForm.module.css, ArterialLEForm.tsx, ArterialLEForm.module.css, CarotidForm.tsx, CarotidForm.module.css, venous-le/ka.json, arterial-le/ka.json, carotid/ka.json |
| UX-ANGIO-006 | Grade the toe-brachial index on its own scale (after clinical sign-off S6) | 0 | S | medium | abiCalculator.ts, templates.ts |
| UX-ANGIO-007 | The 'perforator' option stores what it says (after clinical sign-off) | 0 | M | medium | config.ts, theme-colors.ts, SegmentTable.tsx, AnatomyLegend.tsx, fhir-systems.ts, venous.ts |
| UX-ANGIO-008 | Download a finished study's report while another study in the visit is still empty | 6 | S | low | FormActions.tsx |
| UX-ANGIO-009 | Get back into an open visit in one click | 175 | S | low | EncounterIntake.tsx, EncounterIntake.module.css, OngoingVisitsPanel.tsx, storage-keys.ts |
| UX-ANGIO-010 | Discarding a visit names the patient, and the button says 'discard' | 0 | S | low | OngoingVisitsPanel.tsx |
| UX-ANGIO-011 | A normal pelvic study in one action, like venous | 13 | S | low | templates.ts, IliacCavalTable.tsx, IliacPelvicVenousForm.tsx |
| UX-ANGIO-012 | Add a one-leg venous study from the banner, and choose the leg at intake | 8 | M | medium | EncounterContextBanner.tsx, EncounterContextBanner.module.css, VenousLEForm.tsx, EncounterIntake.tsx |
| UX-ANGIO-013 | Both legs normal in one action when the both-legs view is open | 6 | S | low | VenousLEForm.tsx, SegmentAssessmentCard.tsx |
| UX-ANGIO-014 | Print the report in one click | 0 | S | low | FormActions.tsx |
| UX-ANGIO-015 | The arterial table fits its card, so the occlusion boxes are on screen | 0 | S | low | ArterialLEForm.tsx, ArterialSegmentTable.module.css |

## Verdict: PASS — 27 moves (181 clicks/shift in top-10), 272 events classified
