# W1-D report: start page and in-progress visits

Run `angio-module-2026-11-12`, fence W1-D. Moves covered: UX-ANGIO-009 (L1–L3), 010 (L1–L2), 017 (L1–L2), 022 L1, 024 L2. Skipped: 012 L5, which waits on 012 L4.

## Touched files (all inside the fence)

| File | Change |
|---|---|
| `src/components/layout/EncounterIntake.tsx` | 009 L1: the footer resume button opens the newest in-progress visit (first study, or `/?edit=` for a draft that has no study yet). It shows that patient's name and stays hidden when nothing is in progress. 017 L2: `?edit=` scrolls the form into view. 022 L1: the study-card tick renders only when the card is chosen. |
| `src/components/layout/EncounterIntake.module.css` | 009/024 (C12): the footer wraps (`flex-wrap`). The resume button can shrink and wrap. The hint wraps at ≤576px and the right group takes the full row. The page gets 180px bottom padding at ≤576px so the 3-row footer doesn't cover the end of the page. Pre-existing `backdrop-filter` (footer and hero eyebrow) is gone, along with the dark-mode override in this module. The footer now uses the solid `--emr-bg-card` token. |
| `src/components/layout/OngoingVisitsPanel.tsx` | 009 L2: the open/folded state is remembered per device. A fresh device still starts folded. 009 L3: rows are sorted locally by `createdAt`, newest first. 010: the trash button gets an EMRTooltip and is named `<delete word>: <patient>`. The discard confirm shows the patient name, the visit date and the existing warning text. `destructive` was already set (L2 verified). |
| `src/constants/storage-keys.ts` | New key: `ONGOING_VISITS_EXPANDED: 'angio-ongoing-visits-expanded'`. |
| `src/App.tsx` | 017 L1: `ScrollToTop` (named export) calls `window.scrollTo(0,0)` when the pathname changes. It renders outside `<Routes>`. The bare-route redirects are not touched. |
| `src/App.test.tsx`, `src/components/layout/EncounterIntake.test.tsx`, `src/components/layout/OngoingVisitsPanel.test.tsx` (new) | Tests below. |

## Tests and results

- `npx vitest run src/components/layout/OngoingVisitsPanel.test.tsx src/components/layout/EncounterIntake.test.tsx src/App.test.tsx`: **3 files, 22/22 passed**. New tests:
  - Footer resume opens the newest visit (`/encounter/enc-newer/arterialLE`), names the patient, and never calls `navigate('/')`.
  - Footer resume falls back to `/?edit=<id>` for a draft with no study.
  - The study-card tick SVG is absent when unchosen and present when chosen.
  - The panel is folded on a fresh device. An opened list stays open after remount, and folding writes `'false'`.
  - Row order stays newest-created first even when the older visit was saved last.
  - The trash accessible name contains the patient and is not `გაუქმება`. The confirm shows the patient and the date.
  - `ScrollToTop` fires when the pathname changes and does not fire on a query-only change.
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors. None of the 14 warnings are in W1-D files.
- Self-audit on touched files: zero raw Mantine visuals (only `MantineProvider` in App.tsx), zero `@mantine/dates`, zero forbidden blues, no purple/orange/yellow, zero `backdrop-filter`, no dark overrides, no hex. `npm run ui:orphans` lists none of the W1-D files.

## Decisions

1. **The footer shows the patient's name.** "Continue current visit" is now a real one-click jump, so the button says whose visit it opens (`მიმდინარე ვიზიტის გაგრძელება · ნინო ბერიძე`). This guards against opening the wrong patient. No new key: the name is plain data.
2. **The footer opens the newest-updated visit; the panel lists by created date.** The footer uses `listEncounters()[0]`, which is the visit last worked on. The panel sorts locally by `createdAt` so rows don't jump. `encounterStore.ts` is untouched (W1-A owns it).
3. **Discard copy uses existing keys now.** The confirm body is built from existing ka/en/ru strings (patient name, `encounter.banner.dateLabel` and date, `discardConfirmBody`), so it is fully Georgian today. The trash label calls the new key `encounter.list.discardVisit` and falls back to the existing `discardConfirmAction` ('წაშლა' = delete), never to `encounter.list.discard` ('გაუქმება' = cancel). The patient name is appended so the trash buttons on different rows are distinguishable.
4. **Edit scroll runs inside the IDB-load `.then`, one frame later,** so the hydrated form and the visits list above it have already rendered. The scroll is instant (§4.1). The App-level reset is pathname-only, so it doesn't fight this.
5. **Removing `backdrop-filter`** (footer and hero eyebrow pill) was a Command hard rule for files I edited. The dark-mode footer override became unnecessary once the surface switched to `--emr-bg-card`. No visual regression in light or dark (screenshots below).
6. **The global dark `.tabler-icon` rule in theme.css is untouched** (W1-G's file). The fix is scoped to not rendering the icon.

## Clicks from `/` to a resumed visit (ka, 1440)

| Path | Before | After |
|---|---|---|
| Footer "continue current visit" | dead: stays on `/` (verified `url = /`) | **1 click** → `/encounter/<newest>/<firstStudy>` (verified) |
| Panel row resume, fresh device | 2 (open list + Resume) | 2 (folded default kept, as planned) |
| Panel row resume, clinician who opened the list before | 2: the list re-folded on every load (verified `expanded=false` after reload) | **1**: the list stays open (verified `expanded=true`, stored `'true'` after reload) |

## Live evidence (`screenshots/`, context `w1d`, Georgian UI)

- BEFORE: `w1d-BEFORE-intake-1440.png`, `w1d-BEFORE-intake-panel-open.png`, `w1d-BEFORE-study-after-start.png` (study opened at scrollY 1067.5), `w1d-BEFORE-intake-dark-studies.png` (all 4 unchosen ticks computed white), `w1d-BEFORE-intake-375.png` (start button right edge 517px > 375).
- AFTER 1440 light: `w1d-AFTER-intake-1440-light.png`, `w1d-AFTER-resumed-visit-top.png` (footer resume from page bottom → study at scrollY 0, banner visible), `w1d-AFTER-edit-scrolls-to-form.png` (Edit → form title at 32px from viewport top), `w1d-AFTER-discard-confirm-light.png` (name, date, red confirm).
- AFTER dark: `w1d-AFTER-intake-1440-dark.png`, `w1d-AFTER-intake-dark-studies.png` (unchosen = empty circle, only the chosen card has the tick SVG), `w1d-AFTER-discard-confirm-dark.png`.
- AFTER 375: `w1d-AFTER-intake-375-light.png` (start button 14→361px, scrollWidth 375), `w1d-AFTER-intake-375-bottom.png` (last card ends at 614px, footer top at 662px, no overlap), `w1d-AFTER-resumed-375.png` (scrollY 0), `w1d-AFTER-intake-375-dark.png` (scrollWidth 375).
- Trash accessible names: `["წაშლა: თამარ ლომიძე","წაშლა: გიორგი კაპანაძე","წაშლა: ნინო ბერიძე"]` (before: `["გაუქმება","გაუქმება"]`).
- Console: a hooked `console.error`/`console.warn`/`window.onerror` recorded **0 entries** across these actions: toggle ×2, open and cancel discard, Edit, New patient, footer resume.

## Keys for W1-H (ka / en / ru)

| Key | ka | en | ru | Why |
|---|---|---|---|---|
| `encounter.list.discardVisit` | ვიზიტის წაშლა | Discard encounter | Удалить визит | 010 trash tooltip and accessible-name prefix (falls back to 'წაშლა' until merged) |
| `encounter.list.edit` | რედაქტირება | Edit | Изменить | Row button shows English 'Edit' in ka (missing in all 3 files) |
| `encounter.listPage.eyebrow` | მიმდინარე | In progress | В процессе | Panel eyebrow shows English 'IN PROGRESS' in ka (missing in all 3 files) |
| `encounter.list.discardConfirmTitle` (value change, suggested) | გსურთ ვიზიტის წაშლა? | (unchanged) | (unchanged) | The ka title still uses 'გაუქმება' (cancel), the same word as the dialog's Cancel button (U-1031 pattern) |

## Not proven / open

- The EMRTooltip on the trash button was not hover-tested live (the harness has no hover command). Its accessible name was verified.
- The re-walk task IDs (d45cf28e1a49, 332f579ec7b3, the PDF tasks) were not replayed by a walker. I reproduced the click counts by hand only.
- The `discardVisit` tooltip shows 'წაშლა' until W1-H merges the key.
- These were seen but are outside W1-D:
  - ConfirmDialog's overlay uses `blur: 3` (backdrop blur, `src/components/common/`).
  - The chosen study card's tick uses `--emr-success` green, where Command says checked = solid primary. It sits in my file, but it wasn't in any move, so I left it.
  - In dark mode the hero stepper and moon icon read poorly. That is the W1-G hypothesis.
- The seeded test visits lived only in the `w1d` browser context, which is now closed.
