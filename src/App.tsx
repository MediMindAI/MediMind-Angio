import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ThemeProvider } from './contexts/ThemeContext';
import { TranslationProvider } from './contexts/TranslationContext';
import { mantineTheme, cssVariablesResolver, createAppColorSchemeManager } from './styles/mantineTheme';
import { STORAGE_KEYS } from './constants/storage-keys';
import { AppShell } from './components/layout/AppShell';
import { AnatomyDemo } from './components/anatomy';
import { VenousLEForm } from './components/studies/venous-le/VenousLEForm';
import { ArterialLEForm } from './components/studies/arterial-le/ArterialLEForm';
import { VersionFooter } from './components/layout/VersionFooter';

const colorSchemeManager = createAppColorSchemeManager(STORAGE_KEYS.THEME);
const initialColorScheme = colorSchemeManager.get('auto');

/**
 * Very lightweight route switch — we add the Phase-1 Venous LE form here.
 * The frontend-designer agent will replace this with a real router later.
 *
 * Routes:
 *   /venous-le          → VenousLEForm (Phase 1)
 *   /studies/venous-le  → alias of the above
 *   /demo/anatomy       → AnatomyDemo smoke test
 *   (anything else)     → AppShell landing page
 */
type Route = 'anatomy-demo' | 'venous-le' | 'arterial-le' | 'shell';

function currentRoute(): Route {
  if (typeof window === 'undefined') return 'shell';
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path.endsWith('/demo/anatomy')) return 'anatomy-demo';
  if (path.endsWith('/venous-le') || path.endsWith('/studies/venous-le')) {
    return 'venous-le';
  }
  if (path.endsWith('/arterial-le') || path.endsWith('/studies/arterial-le')) {
    return 'arterial-le';
  }
  return 'shell';
}

function renderRoute(route: Route): React.ReactElement {
  switch (route) {
    case 'anatomy-demo':
      return <AnatomyDemo />;
    case 'venous-le':
      return <VenousLEForm />;
    case 'arterial-le':
      return <ArterialLEForm />;
    case 'shell':
    default:
      return <AppShell />;
  }
}

export default function App() {
  const route = currentRoute();
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
          {renderRoute(route)}
          <VersionFooter />
        </TranslationProvider>
      </ThemeProvider>
    </MantineProvider>
  );
}
