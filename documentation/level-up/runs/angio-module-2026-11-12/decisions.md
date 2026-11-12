# Decisions — angio-module-2026-11-12

| # | Decision | Type | By | Date | Source |
|---|---|---|---|---|---|
| D1 | Scope = whole module: intake, venousLE, arterialLE, carotid, iliacPelvicVenous, PDF | P | orchestrator | 2026-11-12 | user: "entire module" |
| D2 | Lenses moh/legacy/data off (no MoH docs, no predecessor, no seats) | P | orchestrator | 2026-11-12 | angio scope |
| D3 | Measure runs on the tree with the clinician-feedback changes applied (uncommitted) | P | orchestrator | 2026-11-12 | build sessions done first |
| D4 | Ratify budget `angio-resume-export` = 4 clicks from `/` (resume 2 + export 2; no new number) for the PDF tasks | P | orchestrator | 2026-11-12 | sonographer cartographer P2 |
| D5 | Ratify budget `angio-switch` ≤ 1 click between studies of one encounter (banner chip) | P | orchestrator | 2026-11-12 | sonographer cartographer P1 |
| D6 | Ratify budget `angio-annotate` ≤ 3 clicks from open form to a finished drawing mark/label | P | orchestrator | 2026-11-12 | sonographer cartographer P3 |
| D9 | UX-ANGIO-003 L1 built now: venous PDF prints the values the clinician entered (competency/compressibility/thrombosis/phasicity as text). Printing entered data is not a clinical value choice; exact column set stays S4 | P | orchestrator | 2026-11-12 | U-1033 critical |
| D10 | Wave 1 runs as Agent workers in 2 batches of ≤4 (automated turns can't start sessions); W1-H owns all translations and runs last, taking key requests from the other reports | P | orchestrator | 2026-11-12 | architect fences |
| D11 | Ratify D-W1A-1: a stale tab applies only its own changed slot on top of the newest saved copy and raises `staleFromOtherTab`; `BLOCK_STALE_WRITES` stays false (block mode is untested). W1-B shows the notice + reload. Known gap: both tabs editing the SAME study → last save wins (both flagged) | P | orchestrator | 2026-11-12 | W1-A report |
| D12 | Ratify reset wording (U-1031): in-form reset button 'ფორმის გასუფთავება', confirm title 'გავასუფთაოთ ეს ფორმა?' (no longer the Cancel word). Pelvic reset confirm to match in W2-iliac/Prove | P | orchestrator | 2026-11-12 | W1-H report |
| D13 | PDF dates DD.MM.YYYY (HH:mm in footer), local time; timezone tag dropped | P | orchestrator | 2026-11-12 | U-1007 |
| D14 | Bigger diagrams (founder request): drawing caps leg 480→640, neck 540→680, pelvis 380→560; AnatomyDiagram size lg→xl; diagram columns venous clamp(420,34vw,620), carotid clamp(460,38vw,680), iliac 420 / clamp(460,35vw,600), arterial 1fr:1.5fr (table floor 918px kept). Measured at 1440: venous ~390→456, carotid ~440→513, pelvic ~345→462, arterial 371→424 (580 at 1680); no table side-scroll introduced. PDF unchanged (print size). | P | user (founder) | 2026-11-12 | screenshots in chat |
| D8 | Pelvic sex labels ka: მდედრობითი / მამრობითი (was მდედრი / მამრი) — matches intake + venous | C | user (founder) | 2026-11-12 | user message |
| D7 | `angio-no-reentry` stays a DONE-criterion (re-typed patient fields = 0), not a click budget | P | orchestrator | 2026-11-12 | sonographer cartographer |

## Sign-off (clinical) — decided under founder delegation 2026-11-12

The founder asked: "can't you make decisions based on best judgment". Each line below was decided by the orchestrator against the cited standard and is **pending clinician review**, not clinician-signed.

| # | Item | Decision | Basis | Status |
|---|---|---|---|---|
| S1 | SRU 2003 carotid calculator: PSV decides when plaque % is missing; near occlusion never auto-filled; PSV = 230 reads 50–69 % | Keep as built | SRU 2003: PSV 125–230 → 50–69 %, > 230 → ≥ 70 %; near occlusion is diagnosed visually, not by velocity | decided (delegated) |
| S2 | Old-layout pelvic table data is not migrated into the new rows | Keep (no migration) | The study is new (merged d7ba275), so no real patient data exists in the old layout; old text is folded into comments | decided (delegated) |
| S3 | "Pulsatile" shown as მოპულსირე | Keep | Plain Georgian for "pulsating" | decided (delegated) |
| S4 | Venous PDF printed every value (a normal report ran 4 pages) | **Changed:** print abnormal values only; normal values are skipped like "no thrombosis" | "Pertinent findings" reporting convention | done (W4, FindingsTable.tsx) |
| S5 | Pelvic normal template left phasicity blank | **Changed:** CIV/EIV/IIV/CFV get respirophasic; IVC/LRV stay blank; "all normal" fills phasicity only where blank | Iliac and femoral veins are normally respirophasic; the IVC carries cardiac pulsatility | done (templates.ts, SET_ALL_NORMAL) |
| S6 | Arterial normal template TBI 0.85 graded "mild PAD" | **Changed:** TBI gets its own scale: ≥ 0.70 normal · 0.50–0.69 mild · 0.25–0.49 moderate · < 0.25 severe | ACC/AHA PAD guideline (TBI ≤ 0.70 abnormal). Severe < 0.25 ≈ toe pressure < 30 mmHg (CLTI); the sub-bands are pragmatic | done (abiCalculator.ts, config TBI_THRESHOLDS) |
| S7 | "Perforator" stored as `inconclusive`, and its narrative printed nothing | **Changed:** key kept (draft compatibility); narrative, PDF and FHIR conclusion now say perforator | Clinician feedback (2026-10-07) made it perforator | done (W4) |
| S8 | Pelvic form pre-filled sex = female | **Changed:** sex comes from the intake patient details, otherwise blank; templates and "clear form" keep it | Never record a guessed demographic | done (IliacPelvicVenousForm.tsx) |
| S9 | Default drawing ink equals a finding colour | Keep grey ("normal") | Grey is the one palette colour that marks no pathology; black = occlusion and red = reflux/stenosis would mislead | decided (delegated) |

## Design decisions — decided under founder delegation 2026-11-12

| # | Item | Decision | Why |
|---|---|---|---|
| D15 | Dark-mode `--emr-info` (#2b6cb0) equal to the brand gradient's middle stop | Set to #3182ce (= accent, as in light mode) | Clears the status-color-collision; one token change |
| D16 | Arterial diagram only ~290 px beside the table at 1280–1439 | Side-by-side from 1440; below that, stacked full width (640 px) | The user asked for bigger diagrams; the 918 px table floor leaves no room at 1280 |
| D17 | Pelvic table scrolled sideways at 1280–1440 | Side-by-side from 1440 with rail clamp(420px, 30vw, 600px); stacked below | Every column stays visible |
| D18 | CEAP header showed "C0,En,An,Pn" when nothing was picked | Hide the chip until classified (same as SVP) | CEAP and SVP are optional; untouched must not look recorded |
| D19 | Carotid NASCET R/L lists repeat the same 6 labels (critic) | Keep two lists | Two independent per-side inputs are clinically clear and standard; a merged grid is a larger redesign for a metric gain |
| D20 | Venous table values truncated at 1440 (U-1048) | Keep the bigger diagram; the full value shows in the dropdown and the PDF | The founder explicitly asked for bigger diagrams |
| D21 | Colourable pelvic diagram (U-1032) | Defer to the next program; the static picture stays | Needs a new segment-tagged SVG asset, not a quick change |
