# vascular-sonographer — task model rationale

Persona: the clinician who does the duplex scan and fills in the study form, in the Georgian UI. Run `angio-module-2026-11-12`. No prior model existed, so all 23 tasks are new (0 kept, 0 retired).
The JSON (`vascular-sonographer.task-model.json`) is the source of truth. This file only explains the choices.

## Evidence used

- Routes: `src/App.tsx` has three real routes: `/` (EncounterIntake + the in-progress list), `/encounter/:encounterId/:studyType`, and the bare study redirects. Every task's `entryRoute` is `/`.
- Studies: `src/components/studies/index.ts` lists venousLE, arterialLE, carotid and iliacPelvicVenous as available. `EncounterStudyWrapper.tsx` adds the venous variants venousLEBilateral, venousLERight and venousLELeft.
- Surfaces: the intake study cards (`intake-study-*`, where venous always maps to bilateral), the in-progress list (`OngoingVisitsPanel`, **collapsed by default**, with resume/edit/discard per row), the banner (`EncounterContextBanner`: study chips, "+ Add study", edit encounter), `FormActions` (save, preview PDF, download PDF; unified export stays disabled until every study is complete), venous bulk actions (`bulk-all-normal`, copy R→L) plus template picker, arterial `SegmentalPressureTable` (ABI/TBI calculated automatically), `ArterialSegmentTable` (waveform/PSV/stenosis), `CarotidSegmentTable` + `NASCETPicker` (auto SRU category), `IliacCavalTable` (IVC/right/left rows, 6 columns) + left gonadal fields, `DrawingToolbar` (pen/eraser/text).
- e2e: `e2e/anatomy-drawing.spec.ts` covers the draw-mode and persistence journey. `audit-findings/angio-readiness-2026-05-29.md` lists past failures in what reaches the PDF (drawings and narratives dropped from the PDF), which supports the export and drawing tasks.
- No IA_TREE file. Per contracts §3.1, angio does not build one, so routes were read from source.

## Frequency basis (one 8-hour vascular-lab shift)

About 12 patients/encounters per shift, 9 with one study and 3 with several, giving about 16 studies: venous LE ≈ 8 (3 normal, 3 reflux, 2 DVT rule-in), carotid ≈ 4 (2 normal, 2 stenotic), arterial LE ≈ 3 (1 normal, 2 stenotic), iliac-pelvic ≈ 1. Rare tasks are rounded up to 1/shift so they still appear in the ranking.

## Per-task rationale

| taskId | goal | freq | why this frequency | budget / source | why this source | safety |
|---|---|---|---|---|---|---|
| a93706776962 | Start an encounter for a new patient with one study | 9 | the 9 single-study patients | 3 / angio-start | exactly the §1 rule: `/` to first field of a chosen study form | routine |
| f7d966f9347f | Start an encounter for a new patient with several studies | 3 | the 3 multi-study patients (venous+pelvic, carotid+arterial) | 3 / angio-start | same rule. Selecting 2 cards plus Start fits exactly in 3. Done criterion also checks angio-no-reentry (patient typed once) | routine |
| d5c84bc79cf3 | Start a right-leg-only venous study for a new patient | 1 | single-leg requests are a minority of venous orders | 3 / angio-start | same rule. The intake card only offers bilateral, so this measures whether unilateral can be found at all | routine |
| 0a46facacdbc | Switch to another study of the same patient | 4 | about 1.3 switches per multi-study encounter | 1 / angio-switch | ratified D5 (was class-default view-context 2 when proposed as P1) | routine |
| 17e266d15e6a | Add a forgotten study to the patient's open encounter | 1 | the referring doctor adds a study mid-visit | 4 / class-default find/open | no §1 row. Reaching a control and opening a new form = find/open | routine |
| 332f579ec7b3 | Reopen an unfinished encounter after the browser was closed | 3 | drafts left open between patients, plus the lunch-break reload | 2 / angio-resume | exactly the §1 rule | routine |
| 3a68650e893d | Correct the patient's details in an open encounter | 1 | a typo found at report time | 4 / class-default find/open | no §1 row | routine (see note) |
| 3f161856f938 | Remove an abandoned encounter from the in-progress list | 1 | housekeeping of test or cancelled visits | 4 / class-default find/open | no §1 row | **high-alert**: irreversible deletion of clinical data; stop at threshold |
| 03a18f254204 | Record a normal venous study of both legs | 3 | about 3 of 8 venous studies are normal | 15 / class-default note | §1 says "note" = one study's findings + conclusion | routine |
| ad9b03d7d7d3 | Record great saphenous vein reflux with reflux time and CEAP class | 3 | reflux is the most common abnormal venous result | 15 / class-default note | same | routine |
| a10e45d68aa5 | Record a deep vein thrombosis in one leg | 2 | DVT rule-in requests from the wards | 15 / class-default note | same | routine (charting a finding, not committing an act) |
| 9acf2a952037 | Record a normal arterial study with ankle-brachial index | 1 | about 1 of 3 arterial studies | 15 / class-default note | same | routine |
| 71f3dd3afb01 | Record a femoral artery stenosis with waveform and peak velocity | 2 | SFA disease is the most common abnormal arterial result | 15 / class-default note | same | routine |
| 831ea4f62f94 | Record a normal carotid study | 2 | about half of carotid studies | 15 / class-default note | same | routine |
| 264f943ebf15 | Enter internal carotid velocities and plaque and read the stenosis category | 2 | the stenotic half | 15 / class-default note | same | routine (see note) |
| 85025cca62ba | Record a normal iliac and pelvic venous study | 1 | rare study, rounded up | 15 / class-default note | same | routine |
| fd309042464d | Record left gonadal vein reflux with its diameter | 1 | the main finding in pelvic-congestion work-ups, rounded up | 15 / class-default note | same | routine |
| 4c683280f693 | Draw a freehand mark on the anatomy diagram | 3 | marking perforators and sketches on a minority of studies | 3 / angio-annotate | ratified D6 (was class-default find/open 4 when proposed as P3) | routine |
| 454da3f3a800 | Add a text label on the anatomy diagram | 2 | labelling a mark | 3 / angio-annotate | ratified D6 | routine |
| 5cb8f72c92e1 | Write the conclusion for a finished study | 8 | every abnormal study plus some normal ones get a doctor-written conclusion | 15 / class-default note | conclusion is the "conclusion" half of the note class | routine |
| 6d7af6f56e93 | Download the PDF report of a finished study | 9 | one per single-study patient | 4 / angio-resume-export | ratified D4: entry at `/` costs resume 2 + export 2 | **high-alert**: releases the clinical report a referrer and a regulator read |
| bcbf7f5b50f1 | Preview the PDF report before printing | 6 | many reports are checked or printed from preview | 4 / angio-resume-export | ratified D4 | routine (reading) |
| 8b62e94cf890 | Download one combined PDF for a patient with several studies | 3 | one per multi-study patient | 4 / angio-resume-export | ratified D4 | **high-alert**: same as single export, plus the risk that a study is missing from the combined report |

### Safety-class notes

- 3 of 23 tasks are non-routine. Only the discard task gets a `stopAtThreshold`, because it is the only irreversible act. Downloading or previewing a PDF can be repeated safely, so the walker really clicks them; `persistenceVerified` is `"not-applicable"` for those.
- Carotid stenosis category stays `routine`. The task is charting. Whether the SRU category itself is clinically correct is a correctness question tracked on the clinical sign-off list (decisions.md S1), not a pathway-stakes question.
- Correcting patient details stays `routine`, though it is close. If that pathway fails silently, a wrong-patient PDF could result. Escalate it if the walker finds the correction does not reach the export.

## Budgets proposed by this cartographer — RATIFIED 2026-11-12 (decisions.md D4–D7), now in the JSON and in ux-contracts.md §1

- **P1 `angio-switch` — RATIFIED (D5), applied to `0a46facacdbc`**: at most 1 click from one study form to another study already in the encounter (the banner chip). Basis: `angio-no-reentry` plus the existing banner chips. It would replace class-default view-context 2 on `0a46facacdbc`.
- **P2 `angio-resume-export` = 4 — RATIFIED (D4), applied to `6d7af6f56e93`, `bcbf7f5b50f1`, `8b62e94cf890`.** Original reasoning: `angio-export` (≤2) is measured *from a completed study*. But every task enters at `/`, and the in-progress list there starts **collapsed**, so reaching the study already costs 2 clicks (expand + resume) before the download click. Without a decision, `6d7af6f56e93`, `bcbf7f5b50f1` and `8b62e94cf890` will always show over-budget (+1 or more) caused by navigation, not by export. Options: (a) compare these three tasks on scorer `taskClicks` (the split at `arrivedAtStep`), or (b) ratify `angio-resume-export` = angio-resume 2 + angio-export 2 = **4 from `/`**, which combines two already-ratified rows and invents no number. Recommend (b), since the scorer compares total clicks.
- **P3 `angio-annotate` — RATIFIED (D6), applied to `4c683280f693`, `454da3f3a800`**: at most 3 clicks from an open study form to a committed stroke or label (mode toggle, tool, placement). It would replace class-default find/open 4 on `4c683280f693` and `454da3f3a800`. Optional: find/open is an acceptable fallback.
- **Note on `angio-no-reentry` — confirmed as a DONE criterion, not a click budget (D7).** It counts re-typed patient fields, not clicks, so a click budget cannot express it. It is enforced as a clause in the done criterion of `f7d966f9347f`, `0a46facacdbc` and `17e266d15e6a` (patient not re-typed). The orchestrator may want the walker to record a `fieldsFilled`-on-intake check for it.

## Cut list (considered, not included)

- Save the current findings as my own template and reuse it: weekly, not per shift.
- Copy right-leg findings to the left leg (`bulk-copy-r-to-l`): a step inside the normal-venous task, not its own goal.
- Start a new case inside a study form (destructive reset): rare, and the discard task already covers the high-alert pattern.
- Clear all in-progress encounters (`ongoing-visits-clear-all`): rare admin act.
- Switch the UI language: one-off setup, not daily.
- Upper-extremity and abdominal aortic-iliac studies: listed as "coming soon", no route yet.
- Edit a segment's anatomy path override (`edit-segment-hint`): an expert edge case.
