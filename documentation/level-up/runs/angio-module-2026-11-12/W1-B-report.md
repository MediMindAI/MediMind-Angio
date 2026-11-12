# W1-B report: report action bar (UX-ANGIO-001 L3, 002 L2, 008, 014, 024 L1)

Run `angio-module-2026-11-12` · worker W1-B · 2026-11-12 · status **DONE. Print reaches the dialog only where the browser allows it; on Chrome 147 it opens the PDF instead (see Unproven).**

## In plain language

- **The save line tells the truth.** It now reads the last confirmed save time from the visit itself, so it survives a reload: "ბოლოს შენახული: 17:30:39" instead of "ჯერ არ შენახულა". The dot is always a calm grey. Before, it was red "unsaved" on venous and green before anything was saved on carotid and pelvic.
- **Problems stay on screen until fixed.** If a save fails, or the browser storage is full, a notice appears above the buttons. If another tab changed the visit, a notice says so and offers a "reload page" button. Neither notice blocks the form.
- **A finished study's report can go out on its own (U-1002 CRITICAL).** In a visit with venous done and carotid still empty, preview, print and download now produce the venous report alone. A note under the buttons says the PDF has this study only and names the unfinished study. The combined report still needs every study complete. If the open study is itself empty, the buttons stay disabled and the note says why, in the bar rather than in an English hover tooltip.
- **Print button.** It is a secondary button that prints the exact PDF the preview shows.
- **Phone width.** At 375 px the bar wraps onto two rows and the page no longer scrolls sideways. Download PDF is the only gradient (primary) button. Save draft, preview and print are secondary.

## Touched files (fence only)

| File | Change |
|---|---|
| `src/components/form/FormActions.tsx` | Save state is read from `EncounterCtx` (`lastSavedAt`, `saveError`, `staleFromOtherTab`). The old props are still accepted: `lastSavedAt` is the fallback when no provider is mounted, and `hasUnsavedChanges` is accepted and ignored. Both are now optional, so the 4 study forms compile unchanged. New `ExportMode` (`combined` / `single` / `blocked`) replaces the all-or-nothing gate. One shared `renderExportBlob()` feeds preview, print and download. Print helper `printPdfUrl()`: a hidden iframe plus `print()`, falling back to opening the PDF in a tab. Notices use `EMRNotice`, and the reload button is an `EMRButton`. `EMRTooltip` was removed: the reason is now inline text wired with `aria-describedby`. |
| `src/components/form/FormActions.module.css` | Removed `backdrop-filter` (prohibited) and the hard-coded `rgba(221,107,32,…)` orange glow and pulse animation. The dot is a single neutral `--emr-text-secondary` (removed `.dotClean` green and `.dotDirty` red). `.buttons` and `.status` now have `flex-shrink: 1; min-width: 0` (024 L1). New `.notices`, `.noticeAction`, `.exportNote` and `.printFrame`. Tokens only. |
| `src/components/form/FormActions.test.tsx` | The tooltip test was replaced by the 008 gate tests, plus new tests for notices, context save time, one primary action, and print. `WrapWithEncounter` takes `ctx` overrides and is typed as `EncounterContextValue`. |

No translation files, no context/store files, and nothing from W1-G (`main.tsx`, `theme.css`, `EMRButton`) was touched. No wrapper was created or extended: `EMRNotice` `children` already holds the reload button.

## Tests and results

- `npx vitest run src/components/form/FormActions.test.tsx src/components/form/FormActions.formatTime.test.tsx`: **2 files, 14/14 pass**. New or changed cases:
  - Active study complete + other study empty: download, preview and print are enabled. The rendered doc is `ReportDocument` with the venous form. The inline note says "this study only", has no `{studies}` left in it, and is linked through `aria-describedby`.
  - Active study empty: all three are disabled, and the inline reason shows.
  - The caller's `exportsDisabledReason` renders inline (pelvic M7 gate).
  - Exactly one primary: only `download-pdf` has the primary class.
  - The save time comes from the context and beats the stale prop.
  - `write-failed`: notice shows, the last confirmed time is kept, `data-save-state="failed"`.
  - `cache-failed`: the storage-full notice shows.
  - `staleFromOtherTab`: the notice shows, and the button calls `location.reload()`.
  - Print renders the same document type and form as preview and loads it into `[data-testid=print-frame]`.
- The 2-study all-complete → `UnifiedReportDocument` test is unchanged and still passes, so the combined report keeps its all-complete rule.
- Study form tests: `CarotidForm.test.tsx` and `IliacPelvicVenousForm.test.tsx` pass. `VenousLEForm.test.tsx` passes after a serial re-run (`--no-file-parallelism`); its first run hit a 60 s timeout. `ArterialLEForm.test.tsx`: 5/6 pass, and one synchronous mount test (`does NOT render the legacy <StudyHeader>`) took 91.7 s against its 60 s cap. That happened at load average 29–52 while other workers ran suites; Two retries gave the same pattern: whichever test runs **first** in the file times out (83.2 s; and 70.4 s when a different test, `renders the <EncounterContextBanner>`, runs alone), while every later test passes. That points to a cold first mount under load, not to one assertion. FormActions adds no new heavy import (`EMRNotice` comes from the `../common` barrel it already imported). No study form test references the bar's test ids, the tooltip or the dot classes (grep), and the 4 forms' props are unchanged.
- `npm run typecheck`: clean. `npx eslint` on the 3 touched files: 0 problems.
- Self-audit: no raw Mantine visuals (only `Group` and `Text`), no `@mantine/dates`, no forbidden blues, purple, orange or yellow, no `rgba`/hex, no `backdrop-filter`, no dark overrides. `npm run ui:orphans`: FormActions is absent from the report.

## Decisions

- **D-W1B-1. Both notices use the navy info rail, never red.** The failed-save and storage-full notices are `EMRNotice color="info"` with an alert-triangle icon and a bold title. This follows the status-colour reservation rule (red = clinical severity only) and the brief's "never red/green". The architect's draft said `--emr-warning` for a failure; that was not used. Flipping it is a one-word change (`color="error"`) if the orchestrator wants it.
- **D-W1B-2. The dot is always neutral.** There is no `--emr-primary` "pending" state. With immediate persistence (W1-A) there is no real pending window, and the brief asks for neutral. The failure state lives in the notice and in `data-save-state="failed"`, not in the dot colour.
- **D-W1B-3. 008 option (a)**, as in the architect's recommendation. When the visit is not all complete and the active study is complete, preview, print and download all export the active study through the existing `renderSingleStudyPdfBlob`, with filename `baseFilename` (for example `venous-le-…pdf`). The combined report is never filtered down to the complete studies. An empty active study keeps everything disabled. The caller gate (`exportsDisabled`, pelvic) still wins.
- **D-W1B-4. Inline reason instead of a tooltip.** The English `formActions.completeAllFirst` tooltip is gone. The reason is a visible line under the buttons (`data-testid="export-note"`), and each export button points to it with `aria-describedby`.
- **D-W1B-5. Interpolation is done locally.** `t(key, fallback)` and then `.replace('{studies}', names)`. This app's `t()` returns the raw key when params are passed for a missing key, so the bar would show `formActions.thisStudyOnly` until W1-H lands. Study names reuse existing `studies.<x>.short` keys; all venous variants map to `studies.venousLE.short`.
- **D-W1B-6. The print iframe lifetime is not on a timer.** It is removed at the next print or on unmount, so a long print dialog is never cut off.
- **`BLOCK_STALE_WRITES` was not flipped.** It is in W1-A's file, and D11 ratified keeping it `false`. The notice it was waiting on now exists. Flipping it is the orchestrator's call and needs the untested block-mode test first.

## Live evidence (http://localhost:3001, ka, Playwright context `w1b`, now closed)

Visit `ed603528-030b-4b7f-878b-3772980b5232` was created through intake ("W1B ტესტი პაციენტი", venous bilateral + carotid).

1. **Gate, blocked.** Venous with no findings yet: download disabled, note "Record at least one finding in this study to export its PDF. Not finished: ქვ. კიდურების ვენები, საძილე არტერიები". The English part is a fallback until W1-H.
2. **U-1002, a finished study's PDF while another is empty.** After venous "ყველა ნორმაში" (all normal), with carotid still empty, download is enabled. An in-page hook on `URL.createObjectURL` + anchor `click` captured `{type: "application/pdf", size: 47083}` downloaded as **`venous-le-W1B-ტესტი-პაციენტი-2026-11-12.pdf`**. The filename comes from the single-study branch, not `encounter-…`. The carotid page in the same visit stays blocked, with its note naming საძილე არტერიები.
3. **The save time survives a reload.** After clicking the notice's reload button, the save line reads `ბოლოს შენახული: 17:30:39`, which equals the stored `updatedAt` `2026-11-12T13:30:39.036Z` (Tbilisi +4). `data-save-state="saved"`, and there is no stale notice after the reload.
4. **Stale tab.** Tab B was opened with `window.open` from tab A in the same context, so both share storage. B typed "B ჩანართის დასკვნა" into the impression. The store `updatedAt` moved 13:29:47 → 13:30:10, and B's text was stored. Tab A shows the stale notice and the "Reload page" button, and A's save line caught up to 17:30:10. B itself is not flagged. The reload button reloads A (navigation type `reload`), and the notice clears.
5. **Width 375.** Venous: `scrollWidth 375 / clientWidth 375`, the bar is 375 wide, buttons wrap to two rows (save + preview, then print + download at x 174–363), and the note wraps below. Carotid: `scrollWidth 375`. Some section-header elements extend to x=441, but they are clipped and do not widen the page.
6. **Dark mode.** The dot computes to `rgb(148,163,184)` (neutral), the bar background is the card surface, and `backdrop-filter: none`.
7. **Console.** After clicking save draft + preview, a hooked `console.error`, `error` and `unhandledrejection` recorded **0** entries.
8. **Print, Chrome 147.** The print blob is `application/pdf`, 47080 B, the same render path as preview, loaded into the hidden frame. The browser then blocks `contentWindow.print`: `SecurityError … cross-origin frame`. Chrome's out-of-process PDF viewer gives a framed PDF an opaque origin. Probing the viewer's scripting message (`postMessage({type:'print'})`) got no `documentLoaded` reply. The code therefore takes its fallback: it opens the PDF in a new tab 828 ms after the click, while `navigator.userActivation.isActive` is still `true`, so the popup blocker lets it through.

Screenshots (`/Users/toko/Desktop/medimind-angio/screenshots/`): `w1b-venous-open.png`, `w1b-after-normal.png`, `w1b-tabA-stale-notice.png`, `w1b-after-reload.png`, `w1b-venous-375.png`, `w1b-carotid-375.png`, `w1b-carotid-dark.png`.

## Keys for W1-H (ka / en / ru)

Reuse W1-A's four `venousLE.actions.*` keys exactly as handed over: `staleOtherTab`, `reloadPage`, `saveFailed`, `saveCacheFailed`. New keys:

| Key | ka | en | ru |
|---|---|---|---|
| `venousLE.actions.printPDF` | ბეჭდვა | Print | Печать |
| `formActions.thisStudyOnly` | PDF შეიცავს მხოლოდ ამ კვლევას. ერთიანი ანგარიში ხელმისაწვდომი გახდება ყველა კვლევის დასრულების შემდეგ. დაუსრულებელი: {studies} | The PDF contains this study only. The combined report unlocks when every study is done. Not finished: {studies} | PDF содержит только это исследование. Общий отчёт станет доступен, когда все исследования будут завершены. Не завершено: {studies} |
| `formActions.recordThisStudyFirst` | ამ კვლევის PDF-ისთვის შეიყვანეთ მინიმუმ ერთი მონაცემი. დაუსრულებელი: {studies} | Record at least one finding in this study to export its PDF. Not finished: {studies} | Чтобы выгрузить PDF этого исследования, внесите хотя бы одну находку. Не завершено: {studies} |
| `formActions.pdfPrintFailed` | PDF-ის ბეჭდვა ვერ მოხერხდა | Failed to print PDF | Не удалось распечатать PDF |

`venousLE.actions.*` lives in `src/translations/venous-le/{ka,en,ru}.json`, and `formActions.*` in the root `src/translations/{ka,en,ru}.json`. `{studies}` is filled in by FormActions with a comma-joined list of existing `studies.<x>.short` names. `formActions.completeAllFirst` is no longer used; it never existed in any locale.

## Unproven / open

- **Print does not reach the dialog in one click on Chrome 147.** The framed PDF is opaque-origin, so `print()` is blocked and the fallback opens the PDF tab; the viewer's own print button is then click 2. That is still within the ≤3-click budget, but Print equals Preview on Chrome. Firefox, where pdf.js renders same-origin, should open the dialog directly; that was **not tested**. A true one-click print on Chrome needs the PDF rasterised in-page (for example pdf.js → canvas → `window.print()`). That means a new dependency and a second print layout, so it was not done (§4.4). Architect L0, a human checking the browser viewer, still stands.
- **The failed-save notice was not forced live.** It is covered by Vitest only. W1-A proved the context side live (forced IDB `put` failure → `saveError 'write-failed'`); I did not repeat the IDB monkeypatch on the shared server.
- **Opening a second tab alone flags the first tab as stale.** Tab A showed the notice as soon as B mounted, before B's edit, because B writes on mount (storage event). This belongs to W1-A, or to whichever form writes on mount: the notice is correct, but it fires earlier than a human edit.
- **Arterial and pelvic pages at 375** were not measured live; the test visit only had venous + carotid. The bar CSS is shared, so it should hold, but the 024 "all 4 study pages" check is only 2/4 proven by me.
- Bar buttons are `size="sm"` (38 px), below the 44 px mobile tap target. This is unchanged from before; enlarging them would change the desktop bar and is outside the brief.
- **`ArterialLEForm.test.tsx` was not green on this machine.** Whichever test runs first overruns the 60 s cap at load average 35–50. I could not re-run it at low load or against the pre-change bar without disturbing the shared dev server. The orchestrator should re-run it when the box is quiet, with `--no-file-parallelism` (CLAUDE.md flake guidance).
