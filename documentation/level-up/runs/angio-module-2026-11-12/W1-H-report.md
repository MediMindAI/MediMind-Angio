# W1-H report: Georgian / i18n (UX-ANGIO-020, UX-ANGIO-005 L1, all key hand-overs)

Run `angio-module-2026-11-12` · fence W1-H · 2026-11-12 · status **DONE** (PDF date wiring is handed to the orchestrator, by design)

## In plain language

- **Every Georgian screen in the walk now speaks Georgian.** The English words the walkers saw ('IN PROGRESS', 'Edit', 'Anterior view' above the arterial and pelvic diagrams, '7 y', 'Surface', the action-bar note, the PDF print button, the NASCET 'Normal / Near-occlusion / Occluded' chips) came from keys that no locale defined, so the app showed its English fallback. They are now defined in ka/en/ru. Clinical abbreviations (CFV, GSV, ICA, PSV, NASCET, CEAP, R/L) stay as they are.
- **The translation check now catches a missing word before it ships.** `npm run i18n:check` used to compare the three languages only with each other, so a word missing from all three slipped through. It now also reads every `t('…')` in `src/` and fails if the key exists nowhere. Proven by planting a fake key: the check failed, naming the file and line.
- **A safe Georgian date printer exists.** `formatDottedDate()` prints `12.11.2026` or `12.11.2026 15:37` in local time, the same in every language. The PDF files are outside this fence, so the orchestrator swaps them over (call sites below).
- **The 'new study' reset button says what it does.** It now reads 'ფორმის გასუფთავება' (clear form) with no '+', and its confirm title reads 'გავასუფთაოთ ეს ფორმა?', which no longer looks like the Cancel word.

## Touched files (fence only)

| File | Change |
|---|---|
| `src/translations/{ka,en,ru}.json` | +12 keys, 2 value changes (below) |
| `src/translations/venous-le/{ka,en,ru}.json` | +10 keys, 4 value changes |
| `src/translations/arterial-le/{ka,en,ru}.json` | +2 keys, 3 value changes. Also fixed a stray Malayalam letter in the ka 'graft patent' template impression: `മუხლქვეშა` → `მუხლქვეშა` |
| `src/translations/carotid/{ka,en,ru}.json` | +5 keys, 3 value changes |
| `scripts/check-i18n.ts` | New second pass: static `t('key')` usage vs. the merged ka key set |
| `src/services/dateHelpers.ts` | New `formatDottedDate(iso, { includeTime })` |
| `src/services/dateHelpers.test.ts` | +4 tests |
| `src/components/studies/carotid/NASCETPicker.tsx` | U-1006 / 020 L3: the always-English code chip is gone (the translated label carries the category). The header preview prints the translated category (`R: ნორმა · L: სუბოკლუზია`). Built on top of the uncommitted WIP; nothing reverted. |
| `src/components/studies/carotid/NASCETPicker.test.tsx` | **New**, 2 tests |
| `src/components/studies/arterial-le/ArterialSegmentTable.tsx` | Accessible names used English suffixes (`… R waveform`, `… L occluded`, `… stenosis percent`, …). They now reuse the existing column-header keys, so no new key was needed. |
| `src/components/studies/arterial-le/ArterialSegmentTable.test.tsx` | **New**, 1 test |

Not touched: `BackToStudiesButton.tsx` (020 L5 label, see Unproven), FormActions and every file in another fence. The `iliac-pelvic-venous/*.json` diffs in `git status` are earlier clinician-feedback WIP, not mine.

## Keys merged, by source

Values are exactly as handed over unless noted.

| Source | Keys |
|---|---|
| **W1-A** | `venousLE.actions.staleOtherTab`, `.reloadPage`, `.saveFailed`, `.saveCacheFailed` |
| **W1-B** (merged after its report landed) | `venousLE.actions.printPDF`, `formActions.thisStudyOnly`, `formActions.recordThisStudyFirst`, `formActions.pdfPrintFailed` |
| **W1-C** | none needed |
| **W1-D** | `encounter.list.discardVisit`, `encounter.list.edit`, `encounter.listPage.eyebrow`. Value change, ka only: `encounter.list.discardConfirmTitle` → `გსურთ ვიზიტის წაშლა?` |
| **W1-E** | `studies.venousLE.shortBilateral` / `shortRight` / `shortLeft`. Value change, all 3 locales: `encounter.banner.addStudy` loses its leading '+' (the button has a plus icon) → `კვლევის დამატება` / `Add study` / `Добавить исследование` |
| **W1-F** | none needed |
| **W1-G** | `venousLE.recommendations.remove` |
| **W1-I** | Value change, ka only: `venousLE.drawing.actions.undo` → `ბოლო მოქმედების გაუქმება` |
| **U-1004** (found by the new check / the walk) | `encounter.banner.ageYears` (`{age} წლის` / `{age} y` / `{age} г.`), `encounter.banner.unnamedPatient`, `encounter.banner.regionLabel`, `anatomy.view.le-arterial-anterior` (`ქვედა კიდურების არტერიები`), `anatomy.view.abdominal-pelvic` (`მენჯის ვენების სქემა`, reusing the pelvic diagram title), `carotid.param.plaqueSurface` (`ზედაპირი`) |
| **U-1005** (PDF labels) | `carotid.nascetSummary.rightIca` / `leftIca` (`მარჯვენა ICA` / `მარცხენა ICA`), `carotid.nascetSummary.noneLabel` ('—'), `carotid.findingsTable.ulcerationMark` ('⚠'), `arterialLE.pressureTable.sideRight` / `sideLeft` ('R' / 'L' in all 3, matching the on-screen R/L side badges), `venousLE.technique` (`ტექნიკა`), `venousLE.findings` (`მონაცემები`), `venousLE.comments` (`კომენტარები`), `venousLE.followUpPrefix` (`შემდგომი კონტროლი:`) |
| **UX-ANGIO-005 L1** | `{venousLE,arterialLE,carotid}.actions.newCase` → `ფორმის გასუფთავება` / `Clear form` / `Очистить форму`. `newCaseConfirmTitle` → `გავასუფთაოთ ეს ფორმა?` / `Clear this form?` / `Очистить эту форму?`. `newCaseConfirm` → same as the label. decisions.md has **no** U-1031 label entry yet, so I used the architect's suggested wording. **The orchestrator should record it** (or override it). |

Keys the new check flags as "defined nowhere" but which already render Georgian were left alone. These are calls whose fallback is another `t()` (for example `arterialLE.pressureTable.brachialShort` → `arterialLE.pressures.brachial`), and the checker skips them on purpose.

## The checker (`npm run i18n:check`)

- Pass 1 (parity) is unchanged. Pass 2 runs a regex over `src/**/*.{ts,tsx}`, skipping `*.test.*` and comments, and matches `t('key')`, `t("key")` and a plain template key `` t(`key`) ``. Template keys containing `${…}` are skipped, and so are calls whose fallback is another `t(…)`. A key counts as defined if it, or its Russian plural `_one` / `_other` form, exists in the merged ka set. The whole run takes about 1 second.
- `src/components/common/` and `src/components/shared/` are the MediMind wrapper library ported as-is. 90 keys there are undefined, almost all in wrappers angio never renders (bed board, dropzone, trend chart…). The check prints them as **one warning line, not a failure**. Once a wrapper goes into use, its keys should be added.
- Proof: `src/w1h-plant.tmp.ts` containing `t('w1h.planted.missingKey')` made the check exit 1 with `w1h.planted.missingKey (w1h-plant.tmp.ts:1)`. The file was deleted. Today's run passes with exit 0.

## Tests and results

| Command | Result |
|---|---|
| `npm run i18n:check` | pass (parity + 0 undefined keys outside the wrapper library) |
| `npm run typecheck` | clean |
| `npm run lint` | 0 errors (14 pre-existing warnings, none in my files) |
| `npx vitest run src/services/dateHelpers.test.ts` | 19/19 (also 19/19 under `TZ=Asia/Tbilisi`) |
| `npx vitest run src/translations/i18n.test.ts src/contexts/TranslationContext.test.tsx src/components/studies/carotid/NASCETPicker.test.tsx` | 3 files, 14/14 |
| `npx vitest run src/components/studies/arterial-le/ArterialSegmentTable.test.tsx src/components/studies/carotid/NASCETPicker.test.tsx` (after a timeout bump) | 2 files, 3/3 |
| Neighbours hit by the value changes: `OngoingVisitsPanel.test.tsx`, `DrawingToolbar.test.tsx`, `EncounterContextBanner.test.tsx` | 3 files, 19/19 |

The machine was heavily loaded, as W1-B also saw. The first ArterialSegmentTable run failed only because the default 1 s `findBy` wait ran out while translations loaded. Both new tests now wait up to 20 s for the Georgian text.

## PDF date call sites for the orchestrator (U-1007)

HYPOTHESIS **confirmed by code read**: these call `formatIsoForDisplay` without `lang`, so they use the 'en' default and print `11/12/2026` / `11/12/2026, 03:37 PM GMT+4`. Replace each with `formatDottedDate` from `services/dateHelpers`:

| File:line | Today | Change to |
|---|---|---|
| `src/components/pdf/ReportDocument.tsx:267` | `formatIsoForDisplay(generatedAt ?? form.header.studyDate)` | `formatDottedDate(generatedAt ?? form.header.studyDate)` |
| `src/components/pdf/ReportDocument.tsx:270` | `formatIsoForDisplay(…, { includeTime: true })` | `formatDottedDate(generatedAt ?? nowIsoTimestamp(), { includeTime: true })` |
| `src/components/pdf/UnifiedReportDocument.tsx:379` | `formatIsoForDisplay(generatedAt ?? encounter.header.encounterDate)` | `formatDottedDate(…)` |
| `src/components/pdf/UnifiedReportDocument.tsx:382` | footer timestamp, `includeTime: true` | `formatDottedDate(…, { includeTime: true })` |

The same helper fixes these other date displays (all outside my fence):

- `src/components/pdf/sections/PatientBlock.tsx:158` (DOB) and `:163` (study date) print the raw ISO `YYYY-MM-DD`. Wrap them: `fieldValue(formatDottedDate(header.patientBirthDate))`, though `formatDottedDate` returns '—' for empty, so check that `fieldValue` keeps its own empty dash.
- `src/components/layout/EncounterIntake.tsx:501`: the summary shows `12 Nov 2026` (English month, seen live in ka). It also parses the date-only string with `new Date(…)` (UTC midnight). Use `formatDottedDate(state.encounterDate)`.
- `src/components/layout/EncounterContextBanner.tsx:203` and `OngoingVisitsPanel.tsx:278/374` show the raw `2026-11-12`.

The footer loses its timezone token ('GMT+4'). The brief asked for `DD.MM.YYYY HH:mm` local time, and the token was what printed differently per locale. If cross-timezone readers matter, append a fixed ` (UTC+4)` from `getTimezoneOffset()`. That is a one-line follow-up in `dateHelpers.ts`.

A real bug turned up: `formatIsoForDisplay('2026-04-25')` reads a date-only value as UTC midnight, so **west of UTC it prints the previous day**. Its own test fails under `TZ=America/New_York` (`04/24/2026`). Tbilisi (east) is not affected. `formatDottedDate` avoids this through `isoToLocalDate`, which is one more reason to switch the call sites.

## Live evidence (http://localhost:3001, ka, context `w1h`, closed at the end)

Visit `40a424ac-…` "W1H ქართული ტესტი" was created through intake with all 4 studies. A scanner in the page listed every visible string, accessible name, tooltip and placeholder that still held a lowercase English word. Results per screen:

| Screen | English left | Verdict |
|---|---|---|
| Intake (`w1h-ka-intake.png`) | `12 Nov 2026`, `dd.mm.yyyy` placeholder, 'English' (language-switch option), 'MediMind Angio' | Date → orchestrator (above). Placeholder is hard-coded in `components/common/EMRDatePicker.tsx:152` (outside fence). The other two are correct as they are. |
| Venous (`w1h-ka-venous.png`) | segment codes `FV Prox`, `GSV Mid Thigh`… | Clinical abbreviations, on the do-not-touch list. Undo = `ბოლო მოქმედების გაუქმება`, print = `ბეჭდვა`, export note fully Georgian (W1-B keys). |
| Banner + add-study menu (`w1h-ka-add-study-menu.png`) | none visible | `2026-11-12 · 68 წლის · ID: W1H-001`; button `კვლევის დამატება` (no double '+'); menu `ქვ. კიდურების ვენები (მარჯვენა / მარცხენა)`; region name `ვიზიტის მონაცემები`. |
| Reset confirm (`w1h-ka-venous-reset-confirm.png`) | none | Button `ფორმის გასუფთავება`. Confirm `გავასუფთაოთ ეს ფორმა?` names the patient. Closed with Escape; nothing cleared. |
| Arterial (`w1h-ka-arterial.png`) | `Prox/Mid/Dist`, `(Peroneal A)` inside segment names | Clinical segment naming (do-not-touch). Diagram label is now `ქვედა კიდურების არტერიები`, no longer 'Anterior view'. |
| Carotid (`w1h-ka-carotid.png`) | segment codes only (visible text) | NASCET: `ნორმა / < 50 % / … / სუბოკლუზია / ოკლუზია`, with no English chip and no duplicated percent. |
| Pelvic (`w1h-ka-pelvic.png`) | none | Diagram `მენჯის ვენების სქემა`. |
| Visit list (`w1h-ka-visit-list.png`, `w1h-ka-discard-confirm.png`) | none | Eyebrow `მიმდინარე`, row `რედაქტირება`, trash name `ვიზიტის წაშლა: W1H ქართული ტესტი`, confirm `გსურთ ვიზიტის წაშლა?`. Cancelled; the visit is still there. |
| 375 px (`w1h-ka-carotid-375.png`) | — | Venous: `scrollWidth 375`, reset button x 148–363, add button x 31–227. Carotid: `scrollWidth 375`, add button x 43–239, NASCET preview chip ends at x 344. |

Screenshots are in `/Users/toko/Desktop/medimind-angio/screenshots/w1h-*.png`.

### Screen-reader names still in English (outside this fence; Georgian keys already exist)

- `EncounterContextBanner.tsx:248`: `aria-label="Studies"` is hard-coded. Use `t('encounter.banner.studiesLabel')` (W1-E file).
- `CarotidSegmentTable.tsx`: names end in English `flow` / `plaque` (e.g. `CCA Prox R flow`). Reuse `carotid.param.flowDirection` / `plaqueMorphology`.
- `ReflexTimeTable.tsx:219/241/255`: names end with the raw id (`— cfv-right`). Use the segment label + side (W1-C file).
- `AnatomyDiagram.tsx:123`: the canvas name ends with the raw view id (`სახატავი ტილო (le-anterior)`). Use `t(\`anatomy.view.${view}\`)`.

## Pending / unproven

- **W1-B keys: merged** (its report landed mid-run). Nothing pending.
- **005 L1 wording is not in decisions.md.** The suggested wording was used and needs ratifying. 005 L2/L3 (remove `IconPlus`, quiet style, patient name in the confirm body) belong to the W2 study fences. The venous confirm already names the patient live.
- **The iliac `newCase` ('+ ახალი შემთხვევა', confirm 'გაუქმება და ახლის დაწყება', which reuses the Cancel word) was not changed.** UX-ANGIO-005 scopes venous/arterial/carotid only. Recommend the same three values for `iliacPelvicVenous.actions.*` when W2-iliac drops its icon.
- **020 L5 not done:** waveform pictogram tooltips (`ArterialSegmentTable.tsx`) and the `BackToStudiesButton.tsx` label were not in this worker's 4-item brief. The only ArterialSegmentTable change is the accessible-name fix.
- **PDF not re-rendered.** The new PDF label keys (`venousLE.technique/findings/comments/followUpPrefix`, `carotid.nascetSummary.*`) were proven through the checker and the merged JSON, not through a downloaded Georgian PDF. Re-render one after the orchestrator wires the dates.
- **Calendar popup locale** (English month names in the intake date picker): not traced, since `EncounterIntake.tsx` / `EMRDatePicker.tsx` are outside the fence.
- `NASCETPicker.module.css` `.code` / `.optionSelected .code` are now unused (CSS is outside the fence; harmless).
- New ka strings were written by an agent: `ფორმის გასუფთავება`, `გავასუფთაოთ ეს ფორმა?`, `უსახელო პაციენტი`, `ვიზიტის მონაცემები`, `შემდგომი კონტროლი:`, `ქვედა კიდურების არტერიები`. A native-speaker glance is advised (W1-I asked the same for its undo wording).
- en/ru screens were not walked live. They use the same keys, and parity is enforced.
