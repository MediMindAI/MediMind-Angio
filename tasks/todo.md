# Phase 1 Logic Layer — MediMind Angio

## Tasks
- [ ] 1. Create `src/components/studies/venous-le/narrativeGenerator.ts` — auto-generate findings prose + i18n keys
- [ ] 2. Create `src/services/narrativeService.ts` — re-export wrapper + `narrativeFromFormState(form: FormState)` helper
- [ ] 3. Create `src/services/ceapService.ts` — CEAP 2020 formatting, descriptions, FHIR component emission
- [ ] 4. Create `src/services/fhirBuilder.ts` — `buildFhirBundle(form: FormState): Bundle` + `downloadFhirBundle(...)`
- [ ] 5. Create `src/hooks/useAutoSave.ts` — localStorage autosave hook with 2s debounce + `loadDraft`/`clearDraft`
- [ ] 6. Create `src/translations/venous-le/{ka,en,ru}.json` — segment labels, params, enum values, help text
- [ ] 7. Create `src/translations/ceap/{ka,en,ru}.json` — CEAP 2020 descriptions + modifiers
- [ ] 8. Create `scripts/validate-sample-bundle.ts` — builds sample bundle, validates refs + required fields
- [ ] 9. Add npm script `"validate:fhir": "tsx scripts/validate-sample-bundle.ts"` (replace placeholder if needed)
- [ ] 10. Run `npx tsc -p tsconfig.json --noEmit` — must pass clean
- [ ] 11. Run `npx vite build` — must pass clean
- [ ] 12. Run `npm run validate:fhir` — must exit 0
