# ux-task-cartographer — vascular-sonographer (run angio-module-2026-11-12)

- Model: `qa-reports/ux/task-models/vascular-sonographer.task-model.json` (+ `.md` sibling). Valid JSON, taskIds = sha1(persona|area|goal)[:12].
- Tasks: **23 active** (23 new, 0 kept, 0 retired). No prior model.
- Areas: intake 3 · encounter 5 · venous-le 3 · arterial-le 2 · carotid 2 · iliac-pelvic-venous 2 · anatomy 2 · conclusion 1 · report 3.
- Budget sources (after D4–D7): angio-start ×3 · angio-resume ×1 · angio-resume-export ×3 · angio-switch ×1 · angio-annotate ×2 · class-default ×13 (note 15 ×10, find/open 4 ×3).
- Safety: high-alert ×3 (download single PDF, download combined PDF, discard encounter; only discard has a stopAtThreshold) · routine ×20.
- Headline: every export task enters at `/`, and the in-progress list starts collapsed, so reaching a finished study costs 2 clicks before the download click. As written, `angio-export` (≤2) will always score over-budget. **Ratified D4–D7 and applied:** `angio-resume-export` = 4 from `/` (3 PDF tasks), `angio-switch` ≤1, `angio-annotate` ≤3 (2 drawing tasks); rows added to ux-contracts.md §1; `angio-no-reentry` stays a DONE criterion.
- Walker watch-items: unilateral venous (venousLERight) is not offered on the intake cards, only bilateral. Unified export stays disabled until every study is complete.
