# MediMind Angio

Production-grade angiology reporting system — standalone web app, FHIR-native, built to plug into MediMind EMR later.

**Visual target:** Corestudycast-style vascular lab report — structured per-segment findings with live-updating colored anatomical diagram, exportable as a beautiful PDF.

**Scope:** Full angiology — bilateral LE venous duplex, abdominal-pelvic venous, LE arterial/ABI, carotid/vertebral, dialysis access/aortic. Phased delivery.

**Languages:** Georgian (primary), English, Russian.

---

## Stack

Matches MediMind monorepo exactly (for trivial future integration):

- React 19.2.0 · Mantine 8.3.6 · Vite 7.1.12 · TypeScript 5.8 strict ESM
- @react-pdf/renderer 4.3.1 — lazy-loaded PDF export
- Custom TranslationContext + ThemeContext (no i18next, no external state libs)
- FHIR R4 output (QuestionnaireResponse + DiagnosticReport + Observation[] Bundle)

---

## Quickstart

```bash
nvm use                 # Node 20+
npm install
npm run anatomy:all     # fetches + tags + verifies anatomy SVGs (one-time)
npm run dev             # http://localhost:3001
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run anatomy:fetch` | Download raw SVG sources (Wikimedia + Servier) |
| `npm run anatomy:tag` | Rename path IDs to canonical angiology segments |
| `npm run anatomy:verify` | Ensure every catalog segment has a tagged path |
| `npm run anatomy:all` | All three, in order |
| `npm run i18n:check` | Verify ka/en/ru coverage |
| `npm run validate:fhir` | Validate sample Bundle against FHIR R4 |
| `npm run preview` | Preview production build |

## Deployment

GitHub Actions deploys `main` to GitHub Pages automatically.
Live at: _(pending initial deploy)_

---

## Architecture

```
Vite SPA
├── Theme system (ported MediMind theme.css, dark/light/system)
├── i18n (ka/en/ru, localStorage persistence)
├── EMR mini-components (EMRModal, EMRButton, EMR*FormFields)
├── Anatomy system (SVG + segment-ID color mapping, same SVG in web + PDF)
├── Form engine (per-study config → table + diagram + metadata)
├── FHIR builder (form state → valid R4 Bundle)
└── PDF engine (react-pdf, NotoSansGeorgian fonts registered)
```

See [MediMind integration migration path](#migration-to-medimind) at end of this README.

---

## Clinical Standards

Built to ratified vascular-lab protocols:

- **IAC Vascular Testing Standards** — accreditation-grade protocol
- **SVU Lower Extremity Venous Duplex Guideline** — segment list + parameter matrix
- **CEAP 2020** — clinical classification (C0–C6 + `r`/`s`/`a`/`n` modifiers)
- **ESVS 2022** — venous thrombosis management
- **LOINC 39420-5** — bilateral LE venous duplex coding

---

## License

- Code: [MIT](./LICENSE)
- Anatomical illustrations: CC BY 4.0 (see [NOTICE](./NOTICE))
- Noto Sans Georgian font: SIL OFL 1.1

## Migration to MediMind

When the user is ready to fold this into MediMind:

1. Copy `src/components/studies/` → `packages/app/src/emr/components/angiology/`
2. Copy `public/anatomy/` → `packages/app/public/anatomy/`
3. Copy per-study translation folders → `packages/app/src/emr/translations/angiology/`
4. Delete `src/components/common/` and `src/contexts/` (use MediMind's real ones — identical APIs)
5. Rewire `src/services/fhirBuilder.ts` to POST via `MedplumClient` instead of downloading JSON
6. Add `/emr/angiology/*` route + main-menu entry
