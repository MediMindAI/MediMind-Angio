# MediMind Angio — Phase 1 PDF Report (FULL)

Corestudycast-style bilateral venous LE duplex report.

## Plan
- Write a lightweight SVG→@react-pdf converter that reuses `public/anatomy/*.svg` with fetch (browser) / readFile (node).
- Use `metadata.json` for segment labels + bbox (where needed for callouts).
- ReportDocument is a dispatcher; Phase 1 implements the venous LE variants.
- Every section is a small, focused file in `src/components/pdf/sections/`.
- PDFGenerator becomes async-aware (loads the SVGs before rendering).
- Add a `scripts/test-pdf.ts` that mock-renders a full report and saves to `/tmp/sample-report.pdf`.

## Tasks
- [x] 1. Add SVG→PDF converter: `src/components/pdf/anatomyToPdfSvg.ts`
- [x] 2. Add styles module: `src/components/pdf/styles.ts` (shared StyleSheet helpers)
- [x] 3. Add `src/components/pdf/sections/HeaderSection.tsx`
- [x] 4. Add `src/components/pdf/sections/PatientBlock.tsx`
- [x] 5. Add `src/components/pdf/sections/DiagramSection.tsx`
- [x] 6. Add `src/components/pdf/sections/FindingsTable.tsx`
- [x] 7. Add `src/components/pdf/sections/NarrativeSection.tsx`
- [x] 8. Add `src/components/pdf/sections/CEAPSection.tsx`
- [x] 9. Add `src/components/pdf/sections/RecommendationsSection.tsx`
- [x] 10. Add `src/components/pdf/sections/FooterSection.tsx`
- [x] 11. Rewrite `src/components/pdf/ReportDocument.tsx`
- [x] 12. Update `src/components/pdf/PDFGenerator.tsx` (pre-load anatomy svgs, pass `form`/`org`/`preliminary`)
- [x] 13. Add `scripts/test-pdf.ts` + generate sample PDF preview PNG
- [x] 14. Typecheck + build + sample render

## Summary
All 14 tasks completed successfully. Implementation details in the conversation.
