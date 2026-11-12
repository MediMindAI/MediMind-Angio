# Closing — angio-module-2026-11-12

Scope: the whole angio module (intake + venous LE, arterial LE, carotid, iliac/pelvic venous), lenses ux · ui · real.
Generated from: `findings.jsonl` (rendered to `findings.md`), `scorecard-delta.md`, `critic-after3/`, `program.md` test runs.

## Gate V — verdict

> **GO.** The journey runs end to end in Georgian (intake → 4 studies → PDF). Drafts survive reload, the PDF prints Georgian glyphs, and every test is green: 73 files / 594 unit tests, e2e 8/8.
>
> The founder delegated the clinical sign-offs ("make decisions based on best judgment"), and all of them are closed in `decisions.md`. S1–S9 and the design calls D15–D21 each list their standard. They are **delegated decisions pending clinician review**, not clinician signatures.
>
> A follow-up audit of the original clinician feedback found 13/21 items done and 8 partial. All 8 partial items are now closed (U-1050…U-1060 plus orchestrator fixes).
>
> Open, non-blocking:
> - U-1032: colourable pelvic diagram, deferred (D21).
> - U-1020: `test-pdf.ts` covers only venous.

## Numbers

| | Before | After |
|---|---|---|
| Clicks per shift (both personas) | 619 | **472** (−24 %) |
| Discoverability fails | 2 | **0** |
| Critical UX tasks | 1 | **0** |
| Critic verdicts (20 screen-variants) | 1 PASS · 19 REWORK/REDESIGN | **6 PASS · 14 REWORK · 0 REDESIGN** |
| Unit tests | 54 files / 462 | **73 files / 594**, 0 red |
| e2e | 3 / 8 | **8 / 8** |
| Findings | — | 60 logged · **58 fixed** · 2 open (non-blocking) |

## Tests on the final tree (2026-11-12 ~22:25)

- **Static checks:** typecheck 0 errors · lint 0 errors / 14 warnings (all pre-existing) · i18n:check pass · validate:fhir pass · build green.
- **Unit tests:** full serial run 69 files / 565 tests. Touched folders re-run after the last fixes: 167 + 16 tests.
- **e2e:** 8/8.

## Open rows (each with an owner)

| ID | Sev | Owner | What | Needs |
|---|---|---|---|---|
| U-1026 | high | clinician | Arterial normal template TBI 0.85 grades "mild PAD" | Which TBI counts as normal (S6) |
| U-1027 | high | clinician | 'perforator' is stored as `inconclusive` | Add a real `perforator` value? (S7) |
| U-1032 | medium | founder | The pelvic diagram is a static picture; findings never colour it | Make it colourable, or drop it |
| U-1048 | medium | founder | At 1440 the venous table cells (108 px) cut Georgian values ("რესპირ…") because the diagram got bigger | More table width, or keep the big diagram |
| U-1020 | low | P-real | `scripts/test-pdf.ts` renders only venous, in English | Next program |

## Next program (round-3 critic leftovers; the round cap was reached)

1. **Intake:**
   - Merge the language and theme switchers into one menu. This clears density-tier-overflow in all 4 variants.
   - Collapse the empty summary card. This clears empty-state-parity.
2. **Arterial:**
   - Turn "check this data" into an info-rail note under the row it questions. Red then means stenosis only.
   - Give the abnormal row an error rail.
   - Outline the selected waveform chips instead of filling them navy.
3. **Template-normal rows (arterial + pelvic at 768/375):** collapse them like unrecorded rows, and auto-open only rows that differ from normal.
4. **Dark mode:** give `--emr-info` a value different from the brand gradient and selected states (a token decision).
5. **Pelvic diagram asset:** transparent background, so it isn't a white block in dark mode.

## Touched files

All uncommitted on `main`: `git status` lists 149 entries. The diff covers the clinician-feedback rebuild plus this program.

This-session highlights:
- **Fonts:** `fontService.ts` and `pdfTheme.ts` (Roboto fallback).
- **Saving:** `encounterStore.ts` and `EncounterContext.tsx` (write order, `sameAnswers`).
- **Combined report:** `encounterProjection.ts`.
- **PDF:** `src/components/pdf/**` (legends, headings, marks, filenames).
- **Conclusion review note:** `CarotidForm.tsx` and `ArterialLEForm.tsx` (`impressionStale`).
- **Layout:**
  - `NASCETPicker.*`
  - `IliacPelvicVenousForm.*` (wrap, rail breakpoint)
  - `EncounterIntake.module.css` (stepper)
  - `emr-fields.css` (Select right padding)
  - `neck-carotid.svg` (R/L labels)
  - bigger diagrams across the study CSS modules
- **e2e:** the specs and the seed helper.
- **Playwright scripts:** `scripts/playwright/{server,cmd,ensure-server}.ts`, so a `PORT` setting gets its own temp files.
- **Translations:** ka, en and ru keys.

## Pipeline lessons applied this run

- A Mac restart kills background agents and wipes `/private/tmp`. Keep helper scripts that must survive in the repo, or recreate them.
- A Playwright full-page capture can mis-size autosize textareas. Confirm a "giant field" in the live pane before fixing anything.
- The user wants visual checks in the in-app browser pane, not pop-up Chromium. Run script-only browsers hidden on their own `PORT`. This is saved to memory.
