# W1-A report: draft core (UX-ANGIO-001 L1–L2, UX-ANGIO-002 L1)

Run `angio-module-2026-11-12` · worker W1-A · 2026-11-12 · status **DONE (one decision for the orchestrator to ratify, D-W1A-1)**

## In plain language

- **An idle arterial page no longer rewrites the visit twice a second.** Before, it kept saving with nobody typing, and that wiped edits made in another tab within half a second. Now it saves only when an answer actually changes.
- **A tab with an older copy no longer wipes another tab's saved answers.** Each tab remembers which version of the visit it last saw. If another tab has saved since then, the next change is applied on top of the newest saved copy, and the tab raises a "changed in another window" flag.
- **The save status now has one truthful source.** The context reports when the visit was last confirmed saved (also right after a reload) and whether a save failed. W1-B will show this in the bar.

## Touched files (fence only)

| File | Change |
|---|---|
| `src/components/studies/arterial-le/ArterialLEForm.tsx` | 001 L1 only. The self-re-arming 500 ms `setTimeout` mirror effect is replaced by the `lastPersistedRef` guard copied from `CarotidForm.tsx`. Each change persists immediately, with no timer. `lastSavedAt` / `hasUnsavedChanges` / `saveNow` / props are unchanged. Pre-existing WIP was built on top of, not reverted. |
| `src/contexts/EncounterContext.tsx` | 001 L2 + 002 L1. One write funnel `mutate()` runs **outside** the `setEncounter` updaters (StrictMode double-invoked them, so every save fired twice). It has a freshness check, a `storage` listener for this encounter key, the new `lastSavedAt` / `saveError` / `staleFromOtherTab` values, the `BLOCK_STALE_WRITES` constant, and a "never step back" guard on the mount-time IDB load. |
| `src/services/encounterStore.ts` | `saveEncounter(draft, { keepUpdatedAt? })` now returns `{ saved, localCacheWritten }` (it used to return `void`, and every caller still compiles). A localStorage quota failure is reported back instead of only going to `console.warn`, which is kept. The LS→IDB self-heal in `loadEncounter` is now an atomic fill-if-empty (`idb-keyval` `update`), so it can no longer overwrite a newer save. |
| `src/contexts/EncounterContext.test.tsx` | +8 tests (new describe block) |
| `src/services/encounterStore.test.ts` | +2 tests |
| `src/components/studies/arterial-le/ArterialLEForm.test.tsx` | +1 test (idle form writes nothing) |

No translation files, no FormActions, and no other fence was touched.

## Tests and results

- `npx vitest run src/contexts/EncounterContext.test.tsx src/services/encounterStore.test.ts src/components/studies/arterial-le/ArterialLEForm.test.tsx`: **3 files, 33/33 pass**.
- Callers of the changed `saveEncounter` return type: `npx vitest run src/services/encounterMigration.test.ts src/components/studies/EncounterStudyWrapper.test.tsx`: **14/14 pass**.
- `npm run typecheck`: clean in the fence. The only error is `scripts/w1c-pdf-proof.tmp.ts` (W1-C's temp script, `getTemplateById`), which is not mine.
- `npm run lint` on the fence: **0 errors**. Two pre-existing warnings: `ArterialLEForm.tsx:517` (`isBuiltInTemplate` deps, not in my hunk) and `TranslationContext.tsx:120`.
- New cases:
  - lastSavedAt = stored updatedAt after reload
  - lastSavedAt moves once IDB confirms
  - forced IDB failure → `saveError 'write-failed'`, answer kept in memory, next good save clears it
  - LS quota → `'cache-failed'`, IDB still has the draft
  - own writes never flag stale
  - **stale tab's arterial edit keeps the other tab's carotid note** (the freshness-check case the move asks for)
  - a storage event raises the flag and catches the copy up
  - unrelated storage keys are ignored
  - `keepUpdatedAt` + default re-stamp
  - `localCacheWritten=false`
  - idle arterial form: 0 writes in 1.5 s after one edit

A real race came to light along the way. The old 500 ms debounce had been hiding it. An edit made before the mount-time IDB load finished was overwritten twice: once by the LS self-heal writing the older copy into IDB, and once by the load adopting that older copy into memory. Both are fixed: the self-heal now fills only an empty slot, and the load never adopts a copy older than this tab's last write.

## Decisions

- **D-W1A-1 (needs orchestrator ratification).** With `BLOCK_STALE_WRITES = false`, a stale tab does not skip its write, as the architect's L2 wording says. Instead it applies its **own one change** (one study slot, the header, or the study list, which is already the write unit of `setStudyState`/`updateHeader`/`addStudy`/`removeStudy`) on top of the newest stored draft, and raises `staleFromOtherTab`. Why: a skip-the-write default would silently stop the stale tab's saves until W1-B's notice exists, which loses the clinician's own answers. Plain detect-only would keep the M-real wipe. The rebase blocks nothing and loses nothing when the two tabs edit different studies, which is the M-real repro. It is not a field-by-field merge: nothing inside a slot is combined.
  - **Remaining gap:** if both tabs edit the **same** study, the later writer's slot still replaces the earlier one. The flag is raised in both tabs.
  - **To fix it:** after W1-B shows the reload notice (001 L3), flip `BLOCK_STALE_WRITES = true` in `EncounterContext.tsx`. A stale tab then keeps its edits on screen but writes nothing until reload, which is the §4.6 block-and-reload policy. The storage listener also stops catching the copy up in that mode.
- **D-W1A-2.** The three new context fields are **optional on the type** (`?:`), and the provider always sets them. `src/components/form/FormActions.test.tsx` (W1-B's fence) hand-builds a full `EncounterContextValue`, and adding required fields broke its typecheck. W1-B can make them required once it owns that test.
- **D-W1A-3.** `lastSavedAt` means **confirmed** saved: the stored `updatedAt` on load, then a write's `updatedAt` only once IndexedDB resolves. It is not the optimistic stamp. That way a failed save never shows as saved (live proof below).
- **D-W1A-4.** A storage event whose value is gone (the other tab deleted or discarded the visit) raises `staleFromOtherTab` but does not empty this tab. In default mode, this tab's next edit recreates the visit.

## Live evidence (http://localhost:3001, Playwright context `w1a`)

Visit `e6c79a15-44d5-4fea-94b3-37dc9bf0ff76`, created through intake with arterialLE + carotid.

1. **Idle arterial tab: 0 writes in 10 s.** 40 samples, 250 ms apart. Distinct LS `updatedAt` = `["2026-11-12T13:06:47.269Z"]`, distinct IDB `updatedAt` = the same single value. Before the fix, the source trace measured a new value every ~520 ms. A real edit still saves at once: `updatedAt` → `13:07:22.673Z`, arterial impression stored.
2. **Two tabs on one visit.** Tab B was opened with `window.open` from tab A (carotid route). Separate harness contexts do not share storage, so a true two-tab test needs two pages in one context; `w1a-2` was therefore not needed and was never created.
   - B types the carotid note "B: კაროტიდის შენიშვნა", and A stays idle for 3 s. Store: B's note kept, A's arterial kept. Tab A: `staleFromOtherTab: true`, copy caught up (B's note in memory).
   - Stale tab A edits arterial ("A: მეორე შენიშვნა (B-ს შემდეგ)"). Store `13:08:15.128Z` has **both** B's carotid note and A's new arterial text.
   - Reverse direction: B (now stale) edits carotid again. Store `13:08:23.120Z` has B's new note and A's arterial text. Both tabs: `stale: true`, `saveError: null`, `lastSavedAt` = the stored time.
3. **Both stores, then reload.** IDB and LS both hold `encounter-e6c79a15-…` with `updatedAt 13:08:23.120Z`, carotid "B: მეორე კაროტიდის შენიშვნა" and arterial "A: მეორე შენიშვნა (B-ს შემდეგ)". After reload, the arterial field shows the A text. The context reads `lastSavedAt = 13:08:23.120Z` (the real time, not "never saved"), `stale: false`, `saveError: null`. On carotid, the field shows the B text.
4. **Bonus, 002 L1 failure path.** With `IDBObjectStore.prototype.put` forced to throw, typing in carotid gave `saveError: 'write-failed'`, `lastSavedAt` stayed `13:08:23.120Z`, the field and memory kept the new text, and storage kept the last good copy. After restoring and making the next edit, `saveError: null`.

Screenshots: `/Users/toko/Desktop/medimind-angio/screenshots/w1a-arterial-idle-start.png`, `w1a-tabA-after-two-tab-edits.png`, `w1a-arterial-after-reload.png`, `w1a-carotid-after-reload.png` (same folder). Context `w1a` was closed at the end; `w1a-2` reported "not found", meaning it was never opened.

## API for W1-B (`FormActions`, 001 L3 + 002 L2)

Read through `useContext(EncounterCtx)` (FormActions already does this, and the value can be null outside a provider):

```ts
import { EncounterCtx, BLOCK_STALE_WRITES, type EncounterSaveError } from '../../contexts/EncounterContext';

ctx?.lastSavedAt        // Date | null | undefined: last CONFIRMED save; the stored updatedAt right after load/reload
ctx?.saveError          // 'write-failed' | 'cache-failed' | null | undefined
                        //   'write-failed': IndexedDB rejected; newest answers are only on screen. Keep the warning up.
                        //   'cache-failed': IDB fine, localStorage mirror full; a reload may show older answers. Warn.
                        //   Cleared automatically by the next fully successful save.
ctx?.staleFromOtherTab  // boolean | undefined: another tab saved/deleted this visit since this tab loaded it.
                        //   Sticky until reload. Show the persistent reload notice + reload action (window.location.reload()).
```

- All three are always present under `EncounterProvider`. They are optional on the type only (D-W1A-2), so read them with `?? null` / `?? false`.
- Dot mapping per 002: neutral `--emr-text-secondary` when clean, `--emr-primary` when pending, `--emr-warning` **only** when `saveError` is set.
- With immediate persistence there is no real "pending" window in the context. The old `lastSavedAt` / `hasUnsavedChanges` props still arrive from the four forms, and W2 removes them later.
- After the notice ships, the switch to flip is `export const BLOCK_STALE_WRITES = false` in `src/contexts/EncounterContext.tsx`. It sits in W1-A's file, so the orchestrator or the next owner flips it.

## Keys for W1-H (ka / en / ru)

Proposed under the existing `venousLE.actions.*` namespace that FormActions already uses. W1-B may rename them.

| Key | ka | en | ru |
|---|---|---|---|
| `venousLE.actions.staleOtherTab` | ეს ვიზიტი სხვა ფანჯარაში შეიცვალა — განაახლეთ გვერდი | This visit was changed in another window. Reload the page. | Этот визит изменён в другом окне. Обновите страницу. |
| `venousLE.actions.reloadPage` | გვერდის განახლება | Reload page | Обновить страницу |
| `venousLE.actions.saveFailed` | შენახვა ვერ მოხერხდა — პასუხები ჯერ მხოლოდ ეკრანზეა. არ დახუროთ გვერდი. | Saving failed. Your answers are only on screen for now. Do not close the page. | Не удалось сохранить: ответы пока только на экране. Не закрывайте страницу. |
| `venousLE.actions.saveCacheFailed` | ბრაუზერის მეხსიერება სავსეა — გვერდის განახლებისას შეიძლება ძველი პასუხები გამოჩნდეს | Browser storage is full. A reload may show older answers. | Память браузера заполнена: после обновления могут показаться старые ответы. |

## Unproven / open

- **Block mode (`BLOCK_STALE_WRITES = true`) is not exercised** by any Vitest case or live run. It is a module constant, and I did not toggle it on the shared dev server while three other workers use it. The code path is short (skip write + `console.warn`, keep in memory), but it needs a test when it is switched on.
- **Same-study edits in two tabs** still end with the later writer's slot winning (flag raised), until block mode is on. See D-W1A-1.
- **Residual race window.** `saveEncounter` writes IDB first and the localStorage mirror after, so two tabs saving within the same few milliseconds can still miss each other's write. The storage listener then still raises the flag, because it compares with `!==`.
- **IDB-only writes** (when the LS mirror failed) fire no `storage` event, so a second tab learns of them only at its next write's freshness check, which reads LS.
- The idle-loop fix is in arterial only. Carotid and pelvic already had the guard, and venous depends on `[state]` only (no loop), so no other study needed it.
- The "before" baseline for the idle loop (~520 ms) comes from the source trace (C4), not from a fresh run on the old code.
