# Pipeline lessons — angio-module-2026-11-12

| # | What went wrong in the pipeline | Cost | Suggested skill change | Status |
|---|---|---|---|---|
| L1 | `.claude/` is gitignored in angio, so the ported skills/agents exist only on this Mac | coworkers can't run it | un-ignore `.claude/skills` + `.claude/agents` | open |
| L3 | metrics script without `--reuse-context` closes the context → wipes IndexedDB → study routes redirect to `/` | M-ui detour | document `--reuse-context` + own navigation as the standard way to measure study routes | open |
| L4 | `ensure-server.ts` server dies with the calling shell; M-ui had to run `server.ts` as its own background task (dies with that agent) | walkers at risk | orchestrator starts the harness as a long-lived background task in Preflight | open |
| L5 | design-critic agents are read-only and light; counted outside the ≤4 heavy-worker cap (5 ran at once) | none | say so in the skill | open |
| L6 | Real PDF export found a glyph bug no unit test caught (font lacks ≥ and Cyrillic) | would have shipped | add a glyph-coverage check for every char in ka/en/ru translations vs registered PDF fonts | open |
| L2 | `<html lang>` empty on fresh load; metrics locale check needed a Georgian-glyph fallback | 1 port detour | app should set `<html lang>` on load | open |
| L7 | design-critic is read-only (can't write `critic/<slug>.json`); orchestrator extracts the JSON block from the agent transcript with a script | none | port `save-critic.mjs` into `scripts/ui/` and name it in the skill | open |
| L8 | design-critic cites a "Content & layout" section that angio's DESIGN-DIRECTION.md lacks | lower critic confidence | port that section or drop the reference from the agent | open |
| L9 | metrics `elevation-contrast` passes when ≥1 card has a shadow even if pageBg = cardBg (ratio 1.0); 3 critics flagged it | under-reports | fail when ratio < 1.05 unless ≥50% of decks are shadowed | open |
| L10 | full-page screenshots at 768/375 repeat the page top after ~16,000px (capture limit) → critic confidence 0.5 | weaker verdicts | capture long pages in viewport-height slices | open |
| L11 | Machine load 30–44 driven by other projects' dev servers/headless chrome; arterial form test timed out at 60 s under load | flaky reds | Preflight: record load per project; schedule heavy form-tree tests only when load < 12 | open |
| L12 | A worker's named Playwright context (`w2c`) was navigated/closed by another worker mid-run (storage wiped) | re-run of every check | harness should refuse `close-context` / navigate on a context the caller didn't create (owner token) | open |
| L13 | Workers' "keys for W1-H" kept arriving after W1-H finished (W2 keys) | extra merge pass | run the i18n merge worker once at the very end of the build phase, not mid-wave | open |
