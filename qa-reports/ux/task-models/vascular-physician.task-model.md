# vascular-physician — task model (run angio-module-2026-11-12)

The machine record is `vascular-physician.task-model.json`. This file only explains it.

**Persona:** the interpreting vascular physician. They take over an encounter the sonographer already filled, check
and correct findings, write the conclusion and comments, set CEAP/SVP when needed, check the NASCET category, then
preview, download or print the report PDF (one study or the whole encounter). The UI is in Georgian.

**This is the first model for this persona:** 23 tasks, 23 new, 0 kept, 0 retired. Every goal is now frozen.
Change one only by retiring it and adding a new task.

**Entry route:** every task starts at `/` (EncounterIntake). Angio has no roles and no server, so the sonographer's
encounter is a local draft in the same browser. The physician gets back into it through the "In progress" panel on
`/`, which is collapsed by default (`OngoingVisitsPanel`, `expanded=false`). Study forms live at
`/encounter/:encounterId/:studyType` (`src/App.tsx`, `EncounterStudyWrapper.tsx`). Available studies are venousLE,
arterialLE, carotid and iliacPelvicVenous (`STUDY_PLUGINS`).

**Preconditions:** the walker seeds each encounter through the intake, with `[UXWALK-angio-module-2026-11-12]` in
the patient name. `e2e/helpers/seedEncounter.ts` shows the same pattern. No task names an encounter id.

## Frequency basis

I assume a busy outpatient vascular lab where one physician signs off about 20 duplex studies per shift, in about
15 encounters (visits). Rough mix by study:

- venous LE about 8
- carotid about 5
- arterial LE about 4
- pelvic venous about 1

About 4 of the 15 visits have two studies. CEAP, SVP, recommendations and NASCET overrides are optional, so they
get a fraction of their study's count. These numbers are estimates, not measurements. Founder can correct them
before the first walk freezes the yardstick.

## How each budget class was picked

Ratified rows from §1 are used where they fit: `angio-resume` and `angio-resume-export` (ratified D4). Everything else uses
`class-default`, with the class shown in the extra field `budgetClass`. Class mapping used:

- **find/open 4**: reach a surface and act on it once.
- **review/read 5**: reach a surface and read it in full.
- **order 6**: a structured, coded clinical entry committed to the report. Examples: a segment finding, CEAP, SVP,
  a NASCET override, a recommendation row. In the EMR, an order is a coded pick plus a commit, which is the same
  shape.
- **note 15**: one study's conclusion and comments. §1 defines "note" in angio as one study's findings plus
  conclusion.

The orchestrator should check this class mapping. No number was tuned to look achievable.

## Per-task rationale

| taskId | area | goal | freq | budget (source) | safety | why |
|---|---|---|---|---|---|---|
| d45cf28e1a49 | intake | Reopen a sonographer's in-progress visit from the start page | 15 | 2 (angio-resume) | routine | Happens once per visit reviewed (about 15). angio-resume is exactly "from `/` back to an in-progress encounter". |
| 84c9daf274e4 | intake | Move from one study to the other inside a two-study visit | 5 | 4 (find/open) | routine | About 4 two-study visits plus occasional back-and-forth. Uses the banner chips. Measured from `/`, so it includes the resume. |
| eac7013f7172 | intake | Correct a wrong birth date on an in-progress visit | 2 | 4 (find/open) | routine | Occasional demographic typo found during review. The edit lives on `/?edit=<id>`. It also tests angio-no-reentry: the fix is made once and shows on every study. |
| d238785449bc | intake | Remove a finished visit from the in-progress list | 5 | 4 (find/open) | **high-alert** | Deleting the only local copy of a clinical draft cannot be undone, so it is a custodial act. The walker stops at the Georgian confirm button (წაშლა). Readiness audit X1 found that this button was once mislabelled "Cancel", so Georgian clinicians could not discard at all. |
| acfa2ced1941 | venousLE | Review the venous findings and diagram for both legs | 8 | 5 (review/read) | routine | Done on every venous study. |
| e54837a93442 | venousLE | Correct one venous segment finding the sonographer entered | 4 | 6 (order) | routine | The physician corrects about half of venous studies. A coded segment finding is a structured entry. |
| 6c8627b00e20 | venousLE | Write the venous conclusion and clinician comment | 8 | 15 (note) | routine | Every venous study. The conclusion is doctor-written since the 2026-10-07 clinician feedback (`ConclusionBlock`: right findings, left findings, impression, plus the clinician comment). |
| b9b131e672b8 | venousLE | Set the CEAP classification for a venous study | 5 | 6 (order) | routine | Optional. Done for chronic venous disease patients, about 60% of venous studies. |
| 42d763c1e133 | venousLE | Add a follow-up recommendation to the venous report | 6 | 6 (order) | routine | Most venous reports carry a compression or follow-up advice line. |
| 51f8fdd2aebb | arterialLE | Review the arterial findings and ankle-brachial index for both legs | 4 | 5 (review/read) | routine | Every arterial study. |
| 7f498505079c | arterialLE | Correct one arterial segment finding the sonographer entered | 2 | 6 (order) | routine | About half of arterial studies. |
| 4694a7f74e68 | arterialLE | Write the arterial conclusion and clinician comment | 4 | 15 (note) | routine | Every arterial study. |
| d14d2d29a594 | carotid | Check the NASCET stenosis category for each internal carotid artery | 5 | 5 (review/read) | routine | Every carotid study. It is reading only; the override is the next task. |
| c4a29c48523e | carotid | Override the NASCET category when it does not match the images | 1 | 6 (order) | routine | Rare. The SRU calculator auto-fills the category. Sign-off item S1 is about exactly this behaviour. The override is reversible, so it stays routine. |
| f0a93328734a | carotid | Write the carotid impression and clinician comments | 5 | 15 (note) | routine | Every carotid study. |
| 802d04f6063d | iliacPelvicVenous | Review the pelvic venous findings for the iliac veins, cava and gonadal veins | 1 | 5 (review/read) | routine | Rare study. |
| 4f1b689e4374 | iliacPelvicVenous | Set the SVP classification for a pelvic venous study | 1 | 6 (order) | routine | Optional. Done on most pelvic studies. |
| c2ca3d94fcb2 | iliacPelvicVenous | Write the pelvic venous conclusion and comments | 1 | 15 (note) | routine | Every pelvic study. |
| afc608e3416b | report | Preview the report PDF before giving it to the patient | 10 | 4 (angio-resume-export) | routine | Most reports are checked once on screen. Previewing is reading. |
| 2b116c3dbda9 | report | Download the report PDF for a single-study visit | 12 | 4 (angio-resume-export) | **high-alert** | About 11 single-study visits. Angio has no sign button, so exporting the PDF is the de-facto sign-off of the record a regulator (IAC) reads. The download is harmless to repeat, so there is no stop threshold. |
| b349de748732 | report | Download one combined report PDF for a visit with two studies | 4 | 4 (angio-resume-export) | **high-alert** | One per two-study visit. A combined export that drops a study is a clinical-safety failure, and the done criterion checks for it. |
| 3088c351aa84 | report | Download the finished study's report while the visit's other study is still empty | 2 | 4 (angio-resume-export) | **high-alert** | Same act as above. Evidence: `FormActions.tsx` disables both export buttons until every study is complete ("TODO Phase 5: per-study escape hatch"). Example: an acute DVT report waits behind an empty carotid study. This task is likely to fail as blocked; under the safety floor it would then be CRITICAL. |
| 7ddfddbf4c8b | report | Print the report on paper | 8 | 4 (angio-resume-export) | routine | Most reports leave the clinic on paper. There is no in-app print control, so the walker will probably go through Preview and the browser's PDF viewer. Routine, because printing an already-generated PDF commits no new content; the content risk is covered by the download tasks. |

**Safety mix:** 4 high-alert, 19 routine, 0 emergency. Angio has no resuscitation pathway. No task races a clock.

## Budget ratified mid-run (decisions.md D4), now applied in the JSON

**`angio-resume-export`: at most 4 clicks from `/` to a previewed, downloaded or printed PDF.** The number is the
sum of two already-ratified rules, `angio-resume` (2) and `angio-export` (2). Nothing new is invented.

- **The problem:** `angio-export` is defined from a completed study. But every walk must start at `/`, so the
  scorer's total `clicks` for the 5 report tasks always includes the 1-2 resume clicks. The tasks affected are
  afc608e3416b, 2b116c3dbda9, b349de748732, 3088c351aa84 and 7ddfddbf4c8b.
- **The effect:** `budgetDelta` overstates those tasks by the resume cost, which gives fake over-budget events.
  Example: 12/shift × 2 over-budget ÷ 25 rounds up to 1 (LOW). Any extra click on top makes it MEDIUM.
- **Applied:** the orchestrator ratified it as D4, and the JSON now uses it on all 5 report tasks (`budgetSource` and
  `clickBudget` changed, nothing else).
- **If ratified before the first walk:** change only `budgetSource` and `clickBudget` on those 5 tasks. Nothing is
  frozen yet, because no walk has used these numbers.

## Cut list (considered, not modelled)

- Apply a normal-study template, use "+ New case", draw on the anatomy diagram, add a study to the visit. These are
  sonographer tasks; they belong to the `vascular-sonographer` model.
- Return to a half-written conclusion after a reload. Already covered: the reopen task uses angio-resume, and every
  write task requires `persistenceVerified`.
- Export the FHIR Bundle. There is no FHIR export control in the UI (`buildEncounterBundle` is not called from any
  component), so there is no surface to walk.
- Correct a carotid velocity, an arterial pressure, or a pelvic row. Left out to stay within the 25-task cap; the
  per-study "correct one finding" tasks cover the editing pattern.
- Set CEAP on the pelvic study (the `CEAPPicker` is present there too). Lower value than SVP on that study.
