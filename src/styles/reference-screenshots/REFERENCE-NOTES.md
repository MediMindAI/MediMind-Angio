# Command reference screenshots — gold-standard composition

**These are static reference artifacts, not shipping code.** Nothing in this directory is
imported, bundled, routed to, or executed by the application. Each `.html` file is a
self-contained mockup with inline CSS using literal values copied from
`src/styles/theme.css` (light mode) and the two self-hosted webfonts
inlined as base64 — they render identically with **zero network requests**. Hardcoded hex
here is correct and deliberate; the orphan/hex sweeps (`node scripts/audit/ui-library-sweep.mjs`) only scan
`.tsx` / `.module.css`, so these files are out of their scope by construction.

**What they are for.** The `design-critic` agent receives one of these PNGs as
`REFERENCE_SCREENSHOT_PATH` and judges a real screen relative to it. They exist to answer
"what does a 3 look like?" on all five dimensions of the
`### Composition, hierarchy & severity` rubric in
`src/styles/DESIGN-DIRECTION.md`. Every mockup demonstrates all five
rules simultaneously; a reference that only demonstrated one would let four failures
through.

| Shape | Density tier | Light | Dark | Answers |
|---|---|---|---|---|
| Board / queue | `triage` | `triage.png` | `triage-dark.png` | "who needs me next" |
| Table / worklist | `triage` | `list-table.png` | `list-table-dark.png` | "what is blocking release" |
| Detail / entry | `deep-dive` | `deep-dive.png` | `deep-dive-dark.png` | "what is this patient's state" |

`design-critic` picks its reference by **shape AND scheme**. Judging a dark screen
against a light reference reports the theme itself as a defect — every surface value
differs by design.

## One language, two themes — the property that must not be lost

Each light/dark pair is **one shared fragment concatenated onto two `:root` token
blocks**. Everything below `:root` is byte-identical between them — verify with
`md5` on the post-`:root` portion of any pair.

That makes structure, type scale, hairline treatment, spacing rhythm and the
sparkline **theme-independent**. So when a real page diverges from its reference on
any of those, it is a genuine finding and not a theme difference — which is exactly
what makes these files usable as evidence.

**When editing: change a token block, never one theme's structure alone.** The
moment the pair diverges structurally it stops proving a language and becomes two
unrelated screens.

### The design language in five decisions

1. **Type carries hierarchy, not boxes.** An ~84px hero numeral against 10px
   uppercase wide-tracked micro-labels — roughly a 9× ratio nothing else on screen
   approaches, so the focal element is settled before a word is read. All clinical
   values use tabular/lining numerals so columns align optically.
2. **Hairlines, not outlines.** Regions are separated by 1px rules and whitespace.
   Only genuine surfaces (the hero band, the main sheet, the rail) get a deck.
3. **The gradient is a precision line, never a slab** — the chrome hairline, the
   active-mode underline, the hero's lit edge, the sparkline stroke.
4. **The sparkline is the signature.** Smooth gradient-stroked path, soft area
   fill, haloed current point, and a dashed labelled reference line that says *why*
   the number matters. Its ramp inverts per theme (toward navy on light, toward
   `#bee3f8` on dark) because weight reads as "now" on paper and brightness does on
   black — same geometry, inverted emphasis.
5. **One accent, one meaning.** Red is clinical severity only — six marks in
   `deep-dive`, all of them severity, in two treatments (solid chip = graded,
   3px rail = severe region). Actions wear the brand gradient; counts and workflow
   states (overdue, pending, awaiting) are solid navy.

> **`deep-dive` is a 1:1 redesign, not an easier screen.** It deliberately carries the
> SAME inventory as the live nursing-station patient detail: all 10 mode tabs
> (მიმოხილვა · სამუშაო სია · MAR · სასიცოცხლო ნიშნები · ჭრილობა · შენიშვნები ·
> განათლება · პაციენტის გადაბარება · მოვლის გეგმა · გაწერა), the Code Blue action, the
> duty bar with its overdue count, and a comparable data load. **Nothing was deleted to
> make it look calm.** An earlier version of this file had only 5 tabs and no Code Blue
> button — it "solved" density by dropping content, which made it useless as a reference
> (a critic comparing them would only learn "the reference has fewer tabs"). If you edit
> this mockup, keep the inventory and change the weight; the moment it carries less than
> the real screen it stops being evidence.

One page-level convention is shared by all three: the page field is `#edeff2`
(= `--emr-bg-accent-primary`, `rgba(26,54,93,.08)`, composited over white) so that white
`--emr-bg-card` decks sit at a measured 1.15 contrast ratio above it, well clear of the
1.05 floor `composition-metrics.mjs` enforces.

---

## `triage.html` — ward bed board

**Elevation contrast.** Every deck is `#ffffff` at 12px radius on `--emr-shadow-card`
(`0 1px 3px / 0 4px 14px` navy-tinted), floating on the `#edeff2` field. Inner chrome —
the 16 bed cards — uses `--emr-bg-hover` (`#f7fafc`) at 8px radius with **no shadow**, so
"deck" and "row inside a deck" are two visibly different planes rather than a field of
equal boxes.

**Status-color reservation.** Red appears in exactly two channels and one meaning: solid
`#e53e3e` chips (`კრიტიკული`, `კრიტიკული რისკი`) and 4px left rails on the escalation deck
and the two critical bed cards. The escalate button — the single most important control on
the screen — wears `--emr-gradient-primary`, not red. Elevated-but-not-critical beds
(`საყურადღებო`) use solid navy, because "watch this one" is an information state, not a
severity.

**No duplicate primary data.** Bed 412 is the focal escalation *and* the first cell of the
grid. The focal renders the patient at 18px/700 with the NEWS2 score at 50px/700; the grid
cell renders the same patient at 13px/600 with the score at 17px/700 — roughly a third the
weight, unmistakably a back-reference rather than a second display. This is progressive
disclosure, and it is the pattern a critic should recognise as *allowed*.

**Empty states collapse.** Free beds are not rendered as a grid of full-height empty cards;
they collapse into one 40px dashed strip listing all six bed numbers. The
`გადაყვანის მოთხოვნები` deck holds only a compact header plus one muted line — roughly 35%
the height of its populated `მოლოდინში მიღებაზე` sibling, against a 75% ceiling.

**Density tier — triage.** Sixteen beds are shown out of twenty-six occupied, with
"კიდევ 10 დაკავებული საწოლი" stating the remainder explicitly: bounded, not exhaustive.
There is exactly one scan ordering (NEWS2 descending, 9 → 0, no exceptions), severity is
carried by rail colour and a 17px score legible at arm's length, and only four interactive
controls sit above the fold against the tier cap of twelve.

---

## `list-table.html` — lab verification worklist

**Elevation contrast.** Same deck recipe. The table lives inside one deck with hairline
`--emr-border-color` row separators *inside* it and no outer border, per the Command rule
that hairlines stay internal. The KPI deck adds the 3px `--emr-gradient-primary` top ribbon
that marks a stat surface.

**Status-color reservation.** Exactly one red chip on the screen — `კრიტიკული` on the
potassium 6.8 mmol/L row — plus the matching `inset 3px 0 0` row rail and the 4px rail on
the callback alert. Green marks `დადასტურებული` and nothing else. The callback action
(`ინფორმირების დაფიქსირება`) is a gradient button sitting inside a red-railed alert: the
severity and the action are adjacent but never the same colour.

**No duplicate primary data.** The critical value `6.8` renders at full weight (14px/700)
in exactly one place, the table row. The alert deliberately carries only what the row
cannot — the barcode, the patient, the attending to call, the call time — so the two
surfaces complement rather than repeat.

**Empty states collapse.** `გამეორების მოთხოვნები` is a header plus one muted line at
roughly 30% the height of the populated `ბოლო დადასტურებები` deck directly above it.

**Density tier — triage.** Ten of eighteen rows are shown with the remainder stated in the
footer. The default state of this tab (`დასადასტურებელი`) is rendered as plain 12px muted
text rather than a chip on every row — a badge repeated ten times encodes nothing — so the
one red chip and three green chips are the only marks competing for attention. Five
interactive controls above the fold.

---

## `deep-dive.html` — patient detail

This is the direct counter-example to the nursing-station patient-detail page that created
the `design-critic` agent, and it inverts each of that page's four defects.

**Elevation contrast.** Eight decks across three columns, all white-on-`#edeff2` with
`--emr-shadow-card`. The failing page had card backgrounds identical to the page background
with no shadow anywhere; here the grouping is legible before a single word is read.

**Status-color reservation.** Red carries one meaning across the whole screen — clinical
severity — in four places: the NEWS2 rail + `მაღალი რისკი` chip, the fall-risk alert rail,
the `მძიმე` penicillin-allergy chip, and the `კრიტიკული` lactate chip. **The overdue
medication is the teaching case: `ვადაგადაცილებული · 1 სთ 42 წთ` wears a solid navy chip
with a navy row rail, because lateness is a workflow state, not a clinical severity.** On
the failing page that exact element was red, alongside a red resuscitation button — four
unrelated meanings on one screen. The primary action here (`ჩანაწერის დამატება`) wears the
brand gradient.

**No duplicate primary data.** NEWS2 renders once at full weight — `6` at 56px/700, the
only element above 20px on the page — and appears in the patient banner only as an 11px
`NEWS2 6` muted chip. The allergy list renders once at full weight in its own deck (14px/600
substance names with reaction, severity and date) and appears in the banner only as an 11px
red `ალერგია · პენიცილინი` chip. Both are ~5× smaller than their primary display; neither
is a second card of comparable size.

**Empty states collapse.** The `ინციდენტები` deck is a compact header plus one muted line,
~39% the height of `ალერგიები და უკუჩვენებები` and `მოვლის გუნდი` beside it. A quiet shift
looks quieter.

**Density tier — deep-dive.** Eight decks, five MAR rows, four lab rows and six vitals rows
is genuinely dense — which the tier permits — but boldness is spent exactly once. The NEWS2
`6` at 56px/700 is 2.8× the patient name (20px/700) and everything else caps at 15px/600,
so the density never becomes a flat field. That is the deep-dive standard: rich, ordered,
one focal point.

---

## Regenerating the PNGs

```bash
npx tsx scripts/playwright/ensure-server.ts
npx tsx scripts/playwright/cmd.ts --context ref-mockups viewport 1440 900
npx tsx scripts/playwright/cmd.ts --context ref-mockups navigate \
  "file:///$(pwd)/src/styles/reference-screenshots/triage.html"
npx tsx scripts/playwright/cmd.ts --context ref-mockups screenshot "ref-triage"
# → screenshots/ref-triage.png, copy into this directory as triage.png
npx tsx scripts/playwright/cmd.ts --context ref-mockups contexts --close ref-mockups
```

All three are authored to fit within 1440×900 without scrolling (855–900px tall), so the
screenshot is the whole screen — a clipped reference would teach the critic the wrong
above-the-fold budget.
