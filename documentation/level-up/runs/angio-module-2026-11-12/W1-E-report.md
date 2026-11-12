# W1-E report — Banner (UX-ANGIO-012 L1–L2 + coordinator add-on)

Run `angio-module-2026-11-12` · fence W1-E · status **DONE** (one root-cause item handed to W1-A)

## Touched files (fence only)

- `src/components/layout/EncounterContextBanner.tsx`
- `src/components/layout/EncounterContextBanner.module.css`
- `src/components/layout/EncounterContextBanner.test.tsx`

No other files were edited. No git state changes. No translation files touched.

## What changed

1. **L1, clipped menu (C15).** The hand-rolled `position:absolute` dropdown, plus its click-outside effect, `useState` and `useRef`, is replaced by Mantine `<Menu position="bottom-end" offset={8} zIndex="var(--emr-z-dropdown)">`. It is the same pattern as the sibling at `IliacPelvicVenousForm.tsx:445`. The dropdown portals to `<body>`, so the banner's `overflow: hidden` stays (it clips the accent rail to the rounded corner) and can't cut the menu off. Existing CSS classes skin the Menu through `classNames`. I removed the absolute positioning and the bespoke 160ms keyframe, because Mantine handles position and its transition is 150ms. I added `[data-hovered]` states so keyboard navigation gets the same highlight as mouse hover. All testids are kept (`banner-add-study`, `banner-add-study-menu`, `banner-add-option-<type>`).
2. **L2, distinct venous labels (C16).** The three venous entries now use separate keys: `studies.venousLE.shortBilateral`, `shortRight`, `shortLeft`. Until W1-H adds them, the label is built from keys that are already translated: `studies.venousLE.short` + ` (` + `anatomy.side.<side>` + `)`. So in ka the labels already read differently: `ქვ. კიდურების ვენები (ორმხრივი / მარჯვენა / მარცხენა)`. Both the menu and the study chips use the same helper (`studyLabel`).
3. **Coordinator add-on.** "+ კვლევის დამატება" is now `EMRButton variant="secondary"`, a white deck with a hairline border. PDF download is the only gradient primary left on the screen (see the screenshots).
4. **Bug found once the menu could be clicked: adding a study bounced to `/`.** `addStudy()` → `saveEncounter()` writes IndexedDB first and the localStorage read-cache only after that (HEAD does the same). `navigate()` ran immediately, and `EncounterStudyWrapper` guard 4 (`loadEncounterSync(...).selectedStudyTypes.includes`) read a stale cache and redirected to `/`. I confirmed this live: the study was saved, and opening its URL directly worked. **In-fence bridge:** `handleAddStudy` now navigates once `loadEncounterSync` shows the new study (the same check the guard runs). It polls every 25ms and is capped at 2s, so a failed cache write still moves on.
5. **Dead option removed: IVC.** `ivcDuplex` has no study plugin, so the wrapper always redirects it to `/`. Live, clicking it left an `ivcDuplex` study stuck in the visit that could never be opened or completed (which would likely keep the combined export shut, U-1002). The new `addable: false` flag on its meta hides it from the add menu only. Its chip still renders for visits that already contain one. This is reversible in one line.

## Decisions

- I chose Mantine `Menu` over dropping `overflow: hidden`: it portals, flips and shifts inside the viewport at 375, and matches the iliac sibling. `Menu` is an allowed behavior primitive. `ui:orphans` lists it in section B (no wrapper yet), next to `IliacPelvicVenousForm.tsx`. Sections A and C are clean. With two callers now, an `EMRMenu` wrapper in `components/common/` is worth doing, but that directory is outside this fence.
- I used a composed fallback instead of a bare English fallback, so Georgian is correct before the W1-H merge. Once the keys land, the new keys take over.
- The navigation bridge is a stopgap. The root-cause fix belongs to W1-A (see below). After that fix, the bridge resolves on its first check with no delay.

## Hand-offs

### W1-A (draft core): root cause of item 4
`src/services/encounterStore.ts` `saveEncounter`: write the sync cache (`writeSyncRaw`) **before** `await set(...)` to IndexedDB, or otherwise make the sync cache current within the same tick. Anything that navigates right after a mutation hits the same race with `EncounterStudyWrapper` guard 4.

### W1-H (i18n): keys needed

| key | ka | en | ru |
|---|---|---|---|
| `studies.venousLE.shortBilateral` | ქვ. კიდურების ვენები (ორმხრივი) | Venous LE (bilateral) | Вены НК (двусторонне) |
| `studies.venousLE.shortRight` | ქვ. კიდურების ვენები (მარჯვენა) | Venous LE (right) | Вены НК (справа) |
| `studies.venousLE.shortLeft` | ქვ. კიდურების ვენები (მარცხენა) | Venous LE (left) | Вены НК (слева) |

Optional, pre-existing: `encounter.banner.addStudy` begins with "+" in ka/en/ru, while the button already shows a plus icon, so the button reads "+ + კვლევის დამატება". Suggest dropping the leading "+" in all three locales. The menu header reuses this key.

## Tests + results

- `npx vitest run src/components/layout/EncounterContextBanner.test.tsx`: **14/14 pass**. New tests: the menu renders outside the banner; the three venous labels are non-empty and distinct; add-study waits for the stored cache before navigating (asserts the cache contains the study); `ivcDuplex` is not offered. Existing menu tests now `await findBy…` because the Mantine dropdown mounts after its transition.
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors (14 pre-existing warnings, none in fence files). `npx eslint` on the fence files: clean.
- Self-audit greps (forbidden blues, purple/orange/yellow, `backdrop-filter`, hex/rgb, dark-mode overrides): none in the fence files. `npm run ui:orphans`: fence files absent from sections A and C.
- I didn't run the full vitest suite, as instructed.

## Live evidence (http://localhost:3001, Georgian UI, context `w1e`, now closed)

All files are under `/Users/toko/Desktop/medimind-angio/screenshots/`.

- `w1e-1440-banner-closed.png`: secondary add-study button; PDF download is the only gradient.
- `w1e-1440-menu-open-final.png`: menu open at 1440. Probe: 5 options, each 36px tall, inside the viewport, and the topmost element at its center (clickable). Dropdown sits outside the banner; no horizontal scroll.
- `w1e-1440-after-add-left.png` / `w1e-1440-after-add-right.png`: right leg, then left leg added from the menu. URL ends `/venousLELeft` and the chips read distinctly. No page errors.
- 1440, fresh visit: added `venousLEBilateral`. Landed on `/venousLEBilateral` with the chip active.
- `w1e-375-menu-open.png`: at 375, 5 options, each 44px, inside the viewport (menu x 5–302), no horizontal scroll, button 44px tall.
- `w1e-375-after-add-right.png`: added `venousLERight` at 375; landed on `/venousLERight`.
- `w1e-1440-dark-menu-open.png`: dark mode, menu on the dark card surface.
- `w1e-1440-menu-open.png`: the first pass, before the secondary/IVC changes. Kept as history.

## Unproven / out of scope

- **L3 hypothesis (not mine to fix):** the `venousLERight` route shows the bilateral form's right/left tabs (`w1e-1440-dark-menu-open.png`). That fits C16: the form mounts as bilateral. Whether findings land in the `venousLEBilateral` slot still needs the L3 check (W2-venous / L4).
- The test visits created during verification still sit in local storage (W1E ტესტი, W1E დესკტოპი, W1E მობილური). The first one contains a stranded `ivcDuplex` study from the probe that happened before the fix.
- I watched page errors with a `window.onerror` hook (none appeared), not the full DevTools console.
- I didn't run `validate:fhir` for a single-leg bundle; that depends on L4.
