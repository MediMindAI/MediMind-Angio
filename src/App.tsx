import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { TranslationProvider } from './contexts/TranslationContext';
import { mantineTheme, cssVariablesResolver, createAppColorSchemeManager } from './styles/mantineTheme';
import { STORAGE_KEYS } from './constants/storage-keys';
import { AppShell } from './components/layout/AppShell';
import { AnatomyDemo } from './components/anatomy';
import { STUDY_PLUGINS } from './components/studies';
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
 * Routes:
 *   /                     → AppShell landing page
 *   /demo/anatomy         → AnatomyDemo smoke test
 *   <plugin.route>        → plugin.FormComponent (one Route per study)
 *   /studies<plugin.route> → legacy alias for the same FormComponent
 *   *                     → NotFound
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
              <Route path="/" element={<AppShell />} />
              <Route path="/demo/anatomy" element={<AnatomyDemo />} />
              {routableStudies.map((p) => {
                const Form = p.FormComponent;
                return <Route key={p.key} path={p.route} element={<Form />} />;
              })}
              {routableStudies.map((p) => {
                const Form = p.FormComponent;
                return (
                  <Route
                    key={`alias-${p.key}`}
                    path={`/studies${p.route}`}
                    element={<Form />}
                  />
                );
              })}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
          <VersionFooter />
        </TranslationProvider>
      </ThemeProvider>
    </MantineProvider>
  );
}
