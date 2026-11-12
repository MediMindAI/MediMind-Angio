# Angio module (all studies) → production grade — level-up run 2026-11-12

Orchestrator: Opus 5.5, main session. Workers: ≤4 at once (Agent-tool workers; automated turns cannot start sessions). Source: whole module — intake + 4 study forms + PDF.
Base commit: 1d71415 + uncommitted clinician-feedback work (pelvic rebuild, arterial/carotid colors, SRU NASCET calculator). Dev server: http://localhost:3001. Findings: `documentation/level-up/runs/angio-module-2026-11-12/findings.jsonl`.
Lenses: ux · ui · real (`off: moh, legacy, data` — angio has no MoH docs, no predecessor, no seats).
Parallel sessions touching this checkout: none running (pelvic-veins, art-carotid, pipeline-port all idle and done).

## In-scope screens

| Screen | Route | Tier | Shape reference |
|---|---|---|---|
| intake | `/` | triage | triage |
| venousLE | `/encounter/<id>/venousLE…` | deep-dive | deep-dive |
| arterialLE | `/encounter/<id>/arterialLE` | deep-dive | deep-dive |
| carotid | `/encounter/<id>/carotid` | deep-dive | deep-dive |
| iliacPelvicVenous | `/encounter/<id>/iliacPelvicVenous` | deep-dive | deep-dive |
| report | PDF export of each study | final form | — |

Variants per screen: 1440×900 light, 768×1024 light, 375×812 light, 1440×900 dark. Locale `ka`.

## 0. The rule we build to

One action, not a ceremony. Every save gives instant feedback and never loses the clinician's answers; the encounter
draft survives reload. Clinical standards (IAC, SVU, CEAP 2020, ESVS 2022, SRU 2003) are never relaxed. FHIR output stays valid.

## 1. Critical analysis

(filled in Plan)

## 2. Work packages

(filled in Plan)

## 3. Status (the resume point)

Last gate passed: B (2026-11-12 ~19:00): waves 1+2 built (W1-A…I, W2 venous/iliac/arterial/carotid) + orchestrator fixes; every report read, tests re-run per package. Next: Prove (gates, re-measure + critics, re-walk + scorer, GO/NO-GO). Blocked on sign-off: UX-ANGIO-006 (S6), 007 + 003 L2 (S7).

| WP | Worker | State |
|---|---|---|
| M-ux | 2 cartographers (23+23 tasks) → 2 walkers → scorer | done: sono 5 over/2 disc/1 blocked; phys 2 over/2 blocked, 1 CRITICAL |
| M-ui | 20 metrics + 20 screens + 5 PDFs → 5 design-critics | done: 17/20 REDESIGN or REWORK, pelvic dark PASS |
| M-real | standing checks | done: 4 pass / 6 fail (two-tab data loss, PDF content, dates, i18n, 375 overflow, stale e2e) |
| Early lane | orchestrator | U-1000 PDF glyphs fixed · U-1025 pelvic normal template fixed |
| P-trace | ux-source-tracer | done: 28 causes, 10 hidden-but-built surfaces (`.parts/source-trace.md`) |
| P-arch | ux-ia-architect | done: 27 moves, 3 waves, fence map (`.parts/architect-moves.md`, `moves.json`) |
| W1-G shared chrome | frontend-designer | running (batch 1) |
| W1-A draft core | general-purpose | running (batch 1) |
| W1-C venous report + labels | general-purpose | running (batch 1) |
| W1-D start page | frontend-designer | running (batch 1) |
| W1-B, W1-E, W1-F, W1-I | — | batch 2 (after batch 1) |
| W1-H i18n | — | last in wave 1 (takes key hand-overs) |
| Blocked on sign-off | — | 006 (S6), 007 + 003 L2 (S7) |

Gate P passed 2026-11-12 16:45: every move has evidence, fence, done-when, risk; fences disjoint; do-not-do list in architect-moves.md.

Gate M note: 768/375 captures of arterial + carotid are truncated after ~16,000 px (critic confidence 0.5) — re-capture in Prove.

## 5. Test runs

Pre-existing reds at baseline: none.

- 2026-11-12 15:17 baseline (combined feedback work): typecheck 0 errors · lint 0 errors / 14 warnings · i18n:check parity · vitest 54 files / 462 tests passed (83 s).
- 2026-11-12 ~19:10 Prove: typecheck 0 · lint 0 errors / 14 warnings (same as baseline) · i18n:check pass (incl. new code-key pass) · validate:fhir 3 single + 1 multi-study bundle valid · build green (13.4 s) · vitest parallel run killed (exit 143, machine load ~100); serial re-run `--no-file-parallelism`: **68 files / 562 tests passed** (baseline 54 / 462 — +14 files, +100 tests, 0 reds).

### Wave 2 carry-overs (from wave 1 reports)
- W1-G: add `component="h2"` to section titles in SegmentAssessmentCard, ReflexTimeTable, SegmentTable, ArterialSegmentTable, SegmentalPressureTable, CarotidSegmentTable (018 target ≥5 headings per screen).
- W1-G: 375 overflow remaining source = SegmentAssessmentCard title (W2-venous) + FormActions (W1-B).
- DONE (orchestrator): opening a 2nd tab no longer flags the 1st — `sameAnswers()` in EncounterContext ignores re-stamps with identical answers; test added (19/19); live: open-only → no notice, real edit → 'Reload page' + caught-up note.
- Load: machine at 30–44 from OTHER projects' vite/playwright (medplum worktrees, landing page) — not ours to stop; keep ≤3 workers.
- DONE (orchestrator): SVP + CEAP pickers always `variant="soft"` (no gradient band on any study); EMRContentSection title group `nowrap` (tick bar no longer wraps in narrow rail). Tests 25/25; live: no wide gradient bands on pelvic page.
- PENDING final i18n merge after wave 2: W2-iliac 7 keys (`iliacPelvicVenous.actions.allNormal*`, `.rowStatus.*`, `.zone.classification.title`) + W2-venous/arterial/carotid keys.
- W2-venous skipped 002 L3a; checked: FormActions prefers ctx.lastSavedAt whenever an encounter is open (FormActions.tsx:620-621), so the venous save line is already truthful — local lastSavedAt/dirty is dead-ish legacy, left alone (no behaviour change).
- DONE (orchestrator): combined report (encounterProjection) now carries venous right/left doctor-written findings, drawings for venous/arterial/carotid, arterial runoff (U-1038). Test 8/8.
- Open from W2-venous: EMRSelect clear × overlaps long values (U-1039); competency options duplicated in SegmentAssessmentCard (sync with W3-perforator/S7).
- DONE (orchestrator): NASCETPicker soft header (no blue band), neutral preview chip + 'auto (SRU)' text (no success green), side cards fill the column when stacked (preventGrowOverflow=false). Carotid tests 48/48; live: no wide gradient bands, chip rgb(247,250,252)/rgb(31,41,55).

### Prove — re-judge round 2 (design-critic on screens-after)
| Screen | default | 768 | 375 | dark | Remaining blocker |
|---|---|---|---|---|---|
| intake | REDESIGN | REDESIGN | REDESIGN | REDESIGN | layout untouched by waves → UIX2-intake restyle running; picker move + summary removal = founder decision |
| venous-le | **PASS** | REWORK | REWORK | **PASS** | 18× identical normal summary (fixed by orchestrator: ✓ for default-normal) |
| arterial-le | **PASS** | **PASS** | REWORK | **PASS** | phone R/L words duplicated, ABI chip clipped, 3-row bar → UIX3 |
| carotid | REWORK | REWORK | REWORK | REWORK | NASCET R/L option labels repeat → founder decision (merged grade grid vs accept) |
| iliac | REWORK | REWORK | REWORK | REWORK | empty SVP row = CEAP height (fixed by orchestrator: compact empty SVP, chip only on recorded rows) |
Baseline: 17/20 REDESIGN or REWORK, 1 PASS. Round 2: 5 PASS, 11 REWORK, 4 REDESIGN (all intake).
- DONE (orchestrator): bigger diagrams on every study (D14) — AnatomyDiagram xl + wider stage/columns; measured at 1440: venous 456, carotid 513, pelvic 462, arterial 424 px wide; no new side-scroll.
- DONE (orchestrator): carotid NASCET grade moved out of the sticky diagram column into the page flow under the segment table (re-walkers + critic: grade hidden in the aside's own scroll box). CarotidForm tests 9/9; live 1440: nascet top 2106 > table bottom 2074, not in aside, docW 1440.
- DONE (orchestrator): dark selected pills / view toggle keep white text (EMRTabs.module.css, EMRViewToggle).
- 2026-11-12 ~21:10 final tree (after Mac restart; W3-pdf + U-1018/1039/1042): typecheck 0 · lint 0 errors / 14 warnings (baseline) · i18n:check pass · validate:fhir pass · build green · vitest serial **69 files / 565 tests passed** · e2e **8/8** (was 3/8).
- 2026-11-12 ~23:10 FINAL (after delegated sign-offs + feedback-gap closure): typecheck 0 · lint 0 errors/14 warnings · i18n pass · validate:fhir pass · build green · vitest serial **73 files / 594 tests** · e2e **8/8**.
