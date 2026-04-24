import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ThemeProvider } from './contexts/ThemeContext';
import { TranslationProvider } from './contexts/TranslationContext';
import { mantineTheme, cssVariablesResolver, createAppColorSchemeManager } from './styles/mantineTheme';
import { STORAGE_KEYS } from './constants/storage-keys';
import { AppShell } from './components/layout/AppShell';
import { AnatomyDemo } from './components/anatomy';
import { findPluginByPath } from './components/studies';
import { VersionFooter } from './components/layout/VersionFooter';

const colorSchemeManager = createAppColorSchemeManager(STORAGE_KEYS.THEME);
const initialColorScheme = colorSchemeManager.get('auto');

/**
 * Very lightweight route switch.
 *
 * Routes:
 *   /demo/anatomy       → AnatomyDemo smoke test
 *   Every STUDY_PLUGINS entry with a `route` wires its FormComponent.
 *     - Legacy alias `/studies/<tail>` also resolves.
 *   (anything else)     → AppShell landing page
 */
function renderRoute(): React.ReactElement {
  if (typeof window === 'undefined') return <AppShell />;
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path.endsWith('/demo/anatomy')) return <AnatomyDemo />;
  const plugin = findPluginByPath(path);
  if (plugin?.FormComponent) {
    const Form = plugin.FormComponent;
    return <Form />;
  }
  return <AppShell />;
}

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
          {renderRoute()}
          <VersionFooter />
        </TranslationProvider>
      </ThemeProvider>
    </MantineProvider>
  );
}
