# Scorecard delta — angio-module-2026-11-12

Source: `qa-reports/ux/runs/angio-module-2026-11-12-{sono,phys}{,-after}/scoreboard.json` (same task models, same recorder, 23 tasks per persona).

## UX lens (clicks per shift, lower is better)

| Persona | Before | After | Δ | Over budget | Discoverability fails | Blocked | Critical |
|---|---|---|---|---|---|---|---|
| Vascular sonographer | 279 | 228 | −51 (−18 %) | 5 → 5 | 2 → 0 | 1 → 1 | 0 → 0 |
| Vascular physician | 340 | 244 | −96 (−28 %) | 2 → 2 | 0 → 0 | 2 → 1 | 1 → 0 |
| **Both** | **619** | **472** | **−147 (−24 %)** | 7 → 7 | 2 → 0 | 3 → 2 | 1 → 0 |

Worse on no task. Remaining blocked:
- **Sonographer:** the gonadal finding can't be shown on the pelvic diagram. That is a product decision (U-1032).
- **Physician:** Chrome's print dialog can't be driven by the harness, so it needs a manual check.

## UI lens (design-critic verdicts, 5 screens × 4 variants)

| Screen | Baseline | Round 2 | Round 3 (final) |
|---|---|---|---|
| intake | 4× REDESIGN | 4× REDESIGN | 4× REWORK |
| venous-le | REWORK/REDESIGN | 2 PASS · 2 REWORK | **4× PASS** |
| arterial-le | REWORK/REDESIGN | 3 PASS · 1 REWORK | 4× REWORK ¹ |
| carotid | REWORK/REDESIGN | 4 REWORK | 4× REWORK ² |
| iliac-pelvic-venous | REWORK/REDESIGN | 4 REWORK | **2 PASS** (1440, dark) · 2 REWORK ³ |
| **Total** | 1 PASS · 19 REWORK/REDESIGN | 5 PASS · 11 REWORK · 4 REDESIGN | **6 PASS · 14 REWORK · 0 REDESIGN** |

Evidence: `critic-after3/*.json`, `screens-after3/`, `metrics-after3/`.

¹ **Arterial** went 3 PASS → 0. The cause is different test data, not a code regression. Round 3 used the normal template plus a 70–99 % stenosis. That triggered three things:
- the red "check this data" box, which borrows the stenosis red;
- every template-normal card expanding;
- in dark mode, the token alias between `--emr-info` and the brand gradient's middle stop.

² **Carotid** is held at REWORK only by founder-level calls:
- the NASCET R/L duplicated option labels;
- in dark mode, the token alias between `--emr-info` and brand selected states.

³ **Pelvic** at 768/375: after "all normal", every row opens by default, giving 21 identical cards.

Remaining blockers on the 14 REWORK verdicts:
- **Founder/token calls:** the NASCET grade grid; the dark `--emr-info` vs brand blue; collapsing template-normal rows; the static pelvic picture.
- **Small composition fixes:** merge the language and theme switchers on intake; collapse the empty intake summary; make the arterial "check this data" an info-rail note; demote the selected waveform chips; give the abnormal arterial row an error rail.

Round 3 was the last allowed round, so these go to the next program.

Fixed between round 2 and round 3:
- **Intake:** restyled (UIX2).
- **Report bar:** one row at 375 px, with dark-mode tokens (UIX3).
- **Venous:** a ✓ replaces the repeated "normal" summary.
- **Pelvic:** the empty SVP row is now compact.
- **Carotid:** the NASCET grade moved under its table.
- **All studies:** bigger diagrams; the dropdown × no longer covers long values.
