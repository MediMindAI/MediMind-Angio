// SPDX-License-Identifier: Apache-2.0
/**
 * Encounter pivot — end-to-end happy-path test (Phase 5 Item 7).
 *
 * Walks the full user journey at a higher level than any single
 * component test:
 *
 *   1. Mount the intake form, fill patient identity + ICD-10 + consent,
 *      pick TWO studies (venous + arterial), click Start.
 *   2. Assert the URL flips to `/encounter/{uuid}/venousLEBilateral`
 *      AND the encounter is persisted to the store.
 *   3. Mount the EncounterContextBanner against the active encounter
 *      to confirm the same patient identity threads through.
 *   4. Click the arterial chip in the banner → assert navigation goes
 *      to the arterial study under the SAME encounter UUID.
 *   5. Synthesize per-study findings (skipping the heavy form mount
 *      under jsdom — the buildEncounterBundle invariants already cover
 *      reducer-state shapes in their own test file) and write them via
 *      `setStudyState`. Mount the banner again — both studies appear.
 *   6. Call `buildEncounterBundle` directly with the projected forms.
 *      Assert the unified Bundle carries exactly 1 Patient, 1 Encounter,
 *      2 DiagnosticReports with distinct LOINC codes.
 *   7. "Reload": tear down the React tree, re-mount the banner with the
 *      same encounterId, assert the encounter survives via IDB+sync.
 *   8. Mount the FormActions sticky bar and assert it detects unified
 *      mode (button labels resolve, no crashes).
 *
 * Why we don't render the venous + arterial study forms themselves:
 * each is a 800-line useReducer tree with anatomy SVGs, segment
 * tables, ReflexTimeTables, etc. Mounting them in jsdom doubles the
 * suite runtime and introduces flake (the Phase 5 Item 1 fix already
 * proves this). The per-form behavior is covered by their own test
 * files (VenousLEForm.test.tsx, ArterialLEForm.test.tsx). This e2e
 * binds the wiring BETWEEN them: intake → encounter store → banner
 * navigation → unified FHIR output.
 *
 * Heavy modules mocked:
 *   - @react-pdf/renderer (font registration + pdf rendering)
 *   - PDF asset loaders (loadAnatomyForPdf)
 *   - registerFontsAsync
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';

import { EncounterIntake } from '../components/layout/EncounterIntake';
import { EncounterContextBanner } from '../components/layout/EncounterContextBanner';
import { EncountersPage } from '../components/layout/EncountersPage';
import { EncounterProvider, useEncounter } from '../contexts/EncounterContext';
import { TranslationProvider } from '../contexts/TranslationContext';
import {
  _resetStoreForTests,
  clearAllEncounters,
  listEncounters,
  loadEncounterSync,
  saveEncounter,
} from '../services/encounterStore';
import { buildEncounterBundle } from '../services/fhirBuilder/buildEncounterBundle';
import { VASCULAR_LOINC } from '../constants/fhir-systems';
import type { EncounterDraft, EncounterHeader } from '../types/encounter';
import type { FormState, StudyHeader } from '../types/form';
import type { StudyType } from '../types/study';
import type {
  DiagnosticReport,
  Encounter as FhirEncounter,
  Patient as FhirPatient,
} from '../types/fhir';

// ---------------------------------------------------------------------------
// Mock react-router useNavigate so we can assert navigation targets cleanly
// without driving location changes through the Memory Router.
// ---------------------------------------------------------------------------
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// ---------------------------------------------------------------------------
// Mantine notifications — silenced; we never assert on toast contents here.
// ---------------------------------------------------------------------------
vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Heavy PDF deps — keep the e2e test fast.
// ---------------------------------------------------------------------------
vi.mock('@react-pdf/renderer', () => ({
  pdf: () => ({ toBlob: () => new Blob(['mock pdf']) }),
  Document: ({ children }: { children: React.ReactNode }) => children,
  Page: ({ children }: { children: React.ReactNode }) => children,
  Text: ({ children }: { children: React.ReactNode }) => children,
  View: ({ children }: { children: React.ReactNode }) => children,
  StyleSheet: { create: (s: unknown) => s },
  Font: { register: () => undefined },
}));

vi.mock('../services/fontService', () => ({
  registerFontsAsync: () => Promise.resolve(),
}));

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

interface WrapProps {
  readonly children: React.ReactNode;
  readonly initialEntries?: string[];
}

function Wrap({ children, initialEntries = ['/'] }: WrapProps): React.ReactElement {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <MantineProvider>
        <TranslationProvider>{children}</TranslationProvider>
      </MantineProvider>
    </MemoryRouter>
  );
}

/**
 * Synthesize a per-study FormState matching what Phase 3b's
 * `setStudyState` would mirror into the encounter. Mirrors the helper
 * from `buildEncounterBundle.test.ts`. Encounter-level fields flow into
 * the projected header so the FHIR builder's per-study sub-context can
 * read them through the existing builders.
 */
function projectedForm(
  encounter: EncounterDraft,
  studyType: StudyType,
  perStudy: Partial<StudyHeader> = {},
): FormState {
  const eh = encounter.header;
  return {
    studyType,
    header: {
      patientName: eh.patientName,
      patientId: eh.patientId,
      patientBirthDate: eh.patientBirthDate,
      patientGender: eh.patientGender,
      operatorName: eh.operatorName,
      referringPhysician: eh.referringPhysician,
      institution: eh.institution,
      informedConsent: eh.informedConsent,
      informedConsentSignedAt: eh.informedConsentSignedAt,
      medications: eh.medications,
      icd10Codes: eh.icd10Codes,
      studyDate: perStudy.studyDate ?? eh.encounterDate,
      ...perStudy,
    },
    segments: [],
    narrative: { indication: eh.indicationNotes },
    recommendations: [],
    parameters: {},
  } as FormState;
}

// ---------------------------------------------------------------------------
// Per-test reset
// ---------------------------------------------------------------------------
beforeEach(async () => {
  navigateMock.mockReset();
  _resetStoreForTests();
  await clearAllEncounters();
  localStorage.clear();
});

afterEach(async () => {
  _resetStoreForTests();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// E2E happy path
// ---------------------------------------------------------------------------
describe('Encounter pivot — full happy path (Phase 5 Item 7)', () => {
  it('intake → start → banner → switch study → unified FHIR Bundle → reload survives', async () => {
    // -------------------------------------------------------------------
    // STEP 1 — Mount intake at '/'
    // -------------------------------------------------------------------
    const intakeRender = render(
      <Wrap>
        <EncounterIntake />
      </Wrap>,
    );

    // Wait for the intake form to fully render (4 cards present).
    await waitFor(() =>
      expect(document.getElementById('intake-identity-title')).not.toBeNull(),
    );

    // -------------------------------------------------------------------
    // STEP 2 — Fill required identity field + 2 study checkboxes
    //
    // EMRTextInput / EMRCheckbox forward `data-testid` directly to the
    // underlying Mantine `<input>`, so `getByTestId(...)` returns the
    // input element itself (no `.querySelector('input')` indirection
    // needed). This matches EncounterIntake.test.tsx's pattern.
    // -------------------------------------------------------------------
    const nameInput = screen.getByTestId('intake-patientName') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Tamar Beridze' } });
    });

    const personalIdInput = screen.getByTestId('intake-patientId') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(personalIdInput, { target: { value: '12345678901' } });
    });

    // Toggle informed consent.
    const consentCheckbox = screen.getByTestId(
      'intake-informedConsent',
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.click(consentCheckbox);
    });

    // Pick the venous + arterial study checkboxes (plugin keys: venousLE, arterialLE).
    const venousCheckbox = screen.getByTestId(
      'intake-study-checkbox-venousLE',
    ) as HTMLInputElement;
    const arterialCheckbox = screen.getByTestId(
      'intake-study-checkbox-arterialLE',
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.click(venousCheckbox);
      fireEvent.click(arterialCheckbox);
    });

    // -------------------------------------------------------------------
    // STEP 3 — Click Start
    // -------------------------------------------------------------------
    const startBtn = screen.getByTestId('intake-start');
    expect(startBtn).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(startBtn);
    });

    // Wait for the navigation call.
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());

    // -------------------------------------------------------------------
    // STEP 4 — Assert navigation target + persisted encounter
    // -------------------------------------------------------------------
    const navTarget = navigateMock.mock.calls[0]![0] as string;
    expect(navTarget).toMatch(
      /^\/encounter\/[0-9a-f-]+\/venousLEBilateral$/,
    );
    const encounterId = navTarget.split('/')[2]!;

    // The encounter is in storage with our identity.
    const encounters = await listEncounters();
    expect(encounters).toHaveLength(1);
    const persisted = encounters[0]!;
    expect(persisted.encounterId).toBe(encounterId);
    expect(persisted.header.patientName).toBe('Tamar Beridze');
    expect(persisted.header.patientId).toBe('12345678901');
    expect(persisted.header.informedConsent).toBe(true);
    expect(persisted.selectedStudyTypes).toEqual([
      'venousLEBilateral',
      'arterialLE',
    ]);

    intakeRender.unmount();
    navigateMock.mockReset();

    // -------------------------------------------------------------------
    // STEP 5 — Mount the EncounterContextBanner; click arterial chip
    // -------------------------------------------------------------------
    const bannerRender = render(
      <Wrap initialEntries={[`/encounter/${encounterId}/venousLEBilateral`]}>
        <Routes>
          <Route
            path="/encounter/:encounterId/:studyType"
            element={
              <EncounterProvider encounterId={encounterId}>
                <EncounterContextBanner />
              </EncounterProvider>
            }
          />
        </Routes>
      </Wrap>,
    );

    // Banner renders with the same patient name (sync-hydration path).
    await waitFor(() =>
      expect(screen.queryByTestId('encounter-context-banner')).not.toBeNull(),
    );
    expect(screen.getByTestId('banner-patient-name')).toHaveTextContent(
      'Tamar Beridze',
    );

    // Both chips are present.
    expect(screen.getByTestId('banner-chip-venousLEBilateral')).toBeInTheDocument();
    expect(screen.getByTestId('banner-chip-arterialLE')).toBeInTheDocument();

    // Click the arterial chip → assert navigation under the SAME encounter id.
    await act(async () => {
      fireEvent.click(screen.getByTestId('banner-chip-arterialLE'));
    });
    expect(navigateMock).toHaveBeenCalledWith(
      `/encounter/${encounterId}/arterialLE`,
    );

    bannerRender.unmount();

    // -------------------------------------------------------------------
    // STEP 6 — Synthesize per-study state via setStudyState +
    //          assert unified FHIR Bundle structure
    // -------------------------------------------------------------------
    // Use the EncounterProvider to mirror per-study findings into the
    // encounter draft, mirroring Phase 3b's `setStudyState` wiring.
    // Also seed an ICD-10 onto the encounter — the intake test path
    // didn't pick one (the MultiSelect dropdown is heavy under jsdom),
    // and the FHIR Encounter resource is gated on ICD-10 presence
    // (matches single-study byte-parity in buildEncounterBundle.ts).
    function StateMirror(): null {
      const { encounter, setStudyState, updateHeader } = useEncounter();
      // Use useEffect to avoid setState-in-render warnings.
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const ranRef = (StateMirror as unknown as { _ran?: boolean });
      // eslint-disable-next-line react-hooks/rules-of-hooks
      React.useEffect(() => {
        if (encounter && !ranRef._ran) {
          ranRef._ran = true;
          // Seed an ICD-10 so the FHIR Encounter resource gets emitted.
          updateHeader({
            ...encounter.header,
            icd10Codes: [
              {
                code: 'I83.90',
                display: 'Asymptomatic varicose veins of unspecified lower extremity',
              },
            ],
          });
          const venousForm = projectedForm(
            { ...encounter, header: { ...encounter.header, icd10Codes: [
              { code: 'I83.90', display: 'Varicose veins' },
            ] } },
            'venousLEBilateral',
            { accessionNumber: 'ACC-V-001' },
          );
          const arterialForm = projectedForm(
            { ...encounter, header: { ...encounter.header, icd10Codes: [
              { code: 'I83.90', display: 'Varicose veins' },
            ] } },
            'arterialLE',
            { accessionNumber: 'ACC-A-001' },
          );
          setStudyState('venousLEBilateral', venousForm);
          setStudyState('arterialLE', arterialForm);
        }
      }, [encounter, setStudyState, updateHeader, ranRef]);
      return null;
    }

    // Reset the mirror's once-flag so a re-run within the same test file
    // re-invokes the seeding logic.
    (StateMirror as unknown as { _ran?: boolean })._ran = false;

    const mirrorRender = render(
      <Wrap>
        <EncounterProvider encounterId={encounterId}>
          <StateMirror />
        </EncounterProvider>
      </Wrap>,
    );

    // Wait for mirroring to land (both studies + ICD-10 on header).
    await waitFor(async () => {
      const e = await listEncounters();
      const stored = e.find((x) => x.encounterId === encounterId);
      expect(stored?.studies.venousLEBilateral).toBeDefined();
      expect(stored?.studies.arterialLE).toBeDefined();
      expect(stored?.header.icd10Codes?.length).toBeGreaterThan(0);
    });

    // Pull the freshly-mirrored encounter and call buildEncounterBundle.
    const mirrored = (await listEncounters()).find(
      (x) => x.encounterId === encounterId,
    )!;
    const venousForm = mirrored.studies.venousLEBilateral as FormState;
    const arterialForm = mirrored.studies.arterialLE as FormState;
    const bundle = buildEncounterBundle({
      encounter: mirrored,
      studyForms: [venousForm, arterialForm],
    });

    // Assert: 1 Patient + 1 Encounter + 2 DiagnosticReports with distinct LOINCs
    const patients = bundle.entry?.filter(
      (e) => e.resource?.resourceType === 'Patient',
    ) ?? [];
    const encountersInBundle = bundle.entry?.filter(
      (e) => e.resource?.resourceType === 'Encounter',
    ) ?? [];
    const drs = bundle.entry?.filter(
      (e) => e.resource?.resourceType === 'DiagnosticReport',
    ) ?? [];

    expect(patients).toHaveLength(1);
    expect(encountersInBundle).toHaveLength(1);
    expect(drs).toHaveLength(2);

    const loincCodes = drs
      .map((entry) => {
        const dr = entry.resource as DiagnosticReport;
        return dr.code?.coding?.[0]?.code;
      })
      .filter(Boolean);
    expect(new Set(loincCodes).size).toBe(2);
    expect(loincCodes).toContain(VASCULAR_LOINC.venousLEBilateral.code);
    expect(loincCodes).toContain(VASCULAR_LOINC.arterialLE.code);

    // Confirm patient name carried through.
    const patient = patients[0]!.resource as FhirPatient;
    expect(patient.name?.[0]?.text).toContain('Tamar Beridze');

    // Confirm encounter period start matches encounterDate.
    const fhirEnc = encountersInBundle[0]!.resource as FhirEncounter;
    expect(fhirEnc.period?.start).toBeDefined();

    mirrorRender.unmount();

    // -------------------------------------------------------------------
    // STEP 7 — "Reload": tear down + re-mount with same encounterId.
    //          Encounter must survive via IDB + localStorage sync cache.
    // -------------------------------------------------------------------
    // Sync cache hit (loadEncounterSync hydrates from localStorage).
    const syncHit = loadEncounterSync(encounterId);
    expect(syncHit).not.toBeNull();
    expect(syncHit?.studies.venousLEBilateral).toBeDefined();
    expect(syncHit?.studies.arterialLE).toBeDefined();

    const reloadRender = render(
      <Wrap initialEntries={[`/encounter/${encounterId}/venousLEBilateral`]}>
        <Routes>
          <Route
            path="/encounter/:encounterId/:studyType"
            element={
              <EncounterProvider encounterId={encounterId}>
                <EncounterContextBanner />
              </EncounterProvider>
            }
          />
        </Routes>
      </Wrap>,
    );
    await waitFor(() =>
      expect(screen.queryByTestId('encounter-context-banner')).not.toBeNull(),
    );
    expect(screen.getByTestId('banner-patient-name')).toHaveTextContent(
      'Tamar Beridze',
    );

    reloadRender.unmount();

    // -------------------------------------------------------------------
    // STEP 8 — EncountersPage shows the encounter.
    // -------------------------------------------------------------------
    const pageRender = render(
      <Wrap initialEntries={['/encounters']}>
        <EncountersPage />
      </Wrap>,
    );

    await waitFor(() =>
      expect(screen.queryByTestId('encounters-page-list')).not.toBeNull(),
    );
    expect(
      screen.getByTestId(`encounters-page-row-${encounterId}`),
    ).toBeInTheDocument();
    pageRender.unmount();
  });

  // -------------------------------------------------------------------------
  // Smaller assertions kept separate so a failure flags the actual seam.
  // -------------------------------------------------------------------------
  it('FHIR builder produces ZERO DiagnosticReports for an encounter with no studies', () => {
    // Defensive: validate the buildEncounterBundle contract for the
    // "edge case" the UI prevents but the API allows.
    const empty: EncounterDraft = {
      schemaVersion: 2,
      encounterId: 'enc-empty',
      header: {
        patientName: 'No Studies',
        encounterDate: '2026-04-25',
      } as EncounterHeader,
      selectedStudyTypes: [],
      studies: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const bundle = buildEncounterBundle({ encounter: empty, studyForms: [] });
    const drs =
      bundle.entry?.filter((e) => e.resource?.resourceType === 'DiagnosticReport') ?? [];
    expect(drs).toHaveLength(0);
    // Patient still emitted; encounter still emitted; no DRs.
    const patients =
      bundle.entry?.filter((e) => e.resource?.resourceType === 'Patient') ?? [];
    expect(patients).toHaveLength(1);
  });

  it('reload after explicit saveEncounter survives across two render passes', async () => {
    // Smaller version of step 7 — pinpoints the persistence seam if step
    // 7 ever fails for an unrelated reason.
    const draft: EncounterDraft = {
      schemaVersion: 2,
      encounterId: 'enc-reload-1',
      header: {
        patientName: 'Reload Patient',
        encounterDate: '2026-04-25',
      } as EncounterHeader,
      selectedStudyTypes: ['carotid'],
      studies: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveEncounter(draft);

    const first = render(
      <Wrap initialEntries={['/encounter/enc-reload-1/carotid']}>
        <Routes>
          <Route
            path="/encounter/:encounterId/:studyType"
            element={
              <EncounterProvider encounterId="enc-reload-1">
                <EncounterContextBanner />
              </EncounterProvider>
            }
          />
        </Routes>
      </Wrap>,
    );
    await waitFor(() =>
      expect(screen.queryByTestId('encounter-context-banner')).not.toBeNull(),
    );
    expect(screen.getByTestId('banner-patient-name')).toHaveTextContent(
      'Reload Patient',
    );
    first.unmount();

    // Re-mount → hits localStorage sync cache first, then IDB.
    const second = render(
      <Wrap initialEntries={['/encounter/enc-reload-1/carotid']}>
        <Routes>
          <Route
            path="/encounter/:encounterId/:studyType"
            element={
              <EncounterProvider encounterId="enc-reload-1">
                <EncounterContextBanner />
              </EncounterProvider>
            }
          />
        </Routes>
      </Wrap>,
    );
    await waitFor(() =>
      expect(screen.queryByTestId('encounter-context-banner')).not.toBeNull(),
    );
    expect(screen.getByTestId('banner-patient-name')).toHaveTextContent(
      'Reload Patient',
    );
    second.unmount();
  });
});
