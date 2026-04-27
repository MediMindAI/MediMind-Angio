import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { TranslationProvider } from './contexts/TranslationContext';
import { mantineTheme, cssVariablesResolver, createAppColorSchemeManager } from './styles/mantineTheme';
import { STORAGE_KEYS } from './constants/storage-keys';
import { AnatomyDemo } from './components/anatomy';
import { STUDY_PLUGINS } from './components/studies';
import { EncounterStudyWrapper } from './components/studies/EncounterStudyWrapper';
import { EncounterIntake } from './components/layout/EncounterIntake';
import { VersionFooter } from './components/layout/VersionFooter';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { NotFound } from './components/layout/NotFound';

const colorSchemeManager = createAppColorSchemeManager(STORAGE_KEYS.THEME);
const initialColorScheme = colorSchemeManager.get('auto');

/**
 * Wave 2.2 (Pattern A): real React Router replaces the previous
 * `window.location.pathname.endsWith(...)` switch. Exact-match routing
 * closes the audit Part-03 HIGH (route-hijack risk) and Part-06 HIGH
 * (full-page reload navigation) findings.
 *
 * Phase 3a (encounter pivot): the new front door is
 * `/encounter/:encounterId/:studyType`. The bare study routes
 * (`/venous-le`, `/arterial-le`, `/carotid`) and their `/studies/*`
 * legacy aliases now redirect to `/` so users always pass through the
 * encounter intake flow (Phase 2b owns the `/` element swap).
 *
 * Routes:
 *   /                                        → EncounterIntake (Phase 2b — swapped here)
 *   /demo/anatomy                            → AnatomyDemo smoke test
 *   /encounter/:encounterId/:studyType       → EncounterStudyWrapper
 *   <plugin.route>                           → redirect to /
 *   /studies<plugin.route>                   → redirect to /
 *   *                                        → NotFound
 */
const routableStudies = STUDY_PLUGINS.filter(
  (p): p is typeof p & { route: string; FormComponent: NonNullable<typeof p.FormComponent> } =>
    Boolean(p.route) && Boolean(p.FormComponent),
);

export default function App() {
  return (
    <MantineProvider
      theme={mantineTheme}
      cssVariablesResolver={cssVariablesResolver}
      colorSchemeManager={colorSchemeManager}
      defaultColorScheme={initialColorScheme}
    >
      <ThemeProvider>
        <TranslationProvider>
          <Notifications position="top-right" zIndex={2000} />
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<EncounterIntake />} />
              <Route path="/demo/anatomy" element={<AnatomyDemo />} />
              {/*
                `/encounters` was the standalone management view in Phase
                5. The list moved onto the landing page (OngoingVisitsPanel
                above the intake form), so the route now redirects to keep
                old links + the existing banner button working.
              */}
              <Route path="/encounters" element={<Navigate to="/" replace />} />
              <Route
                path="/encounter/:encounterId/:studyType"
                element={<EncounterStudyWrapper />}
              />
              {/*
                Phase 3a: bare study routes (Wave 2.2) and the /studies/*
                legacy aliases now redirect to / so users go through
                encounter intake. The old direct-form-mount paths are
                preserved as registered routes so we keep exact-match
                semantics (Part-03 HIGH guard) — they just resolve to a
                redirect element instead of the form component.
              */}
              {routableStudies.map((p) => (
                <Route
                  key={p.key}
                  path={p.route}
                  element={<Navigate to="/" replace />}
                />
              ))}
              {routableStudies.map((p) => (
                <Route
                  key={`alias-${p.key}`}
                  path={`/studies${p.route}`}
                  element={<Navigate to="/" replace />}
                />
              ))}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
          <VersionFooter />
        </TranslationProvider>
      </ThemeProvider>
    </MantineProvider>
  );
}
