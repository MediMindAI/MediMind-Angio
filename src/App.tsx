import { MantineProvider } from '@mantine/core';
import { ThemeProvider } from './contexts/ThemeContext';
import { TranslationProvider } from './contexts/TranslationContext';
import { mantineTheme, cssVariablesResolver, createAppColorSchemeManager } from './styles/mantineTheme';
import { STORAGE_KEYS } from './constants/storage-keys';
import { AppShell } from './components/layout/AppShell';
import { AnatomyDemo } from './components/anatomy';

const colorSchemeManager = createAppColorSchemeManager(STORAGE_KEYS.THEME);
const initialColorScheme = colorSchemeManager.get('auto');

/**
 * Very lightweight route switch -- the frontend-designer agent will replace
 * this with a real router later. For now, visiting `/demo/anatomy` renders
 * the AnatomyDemo smoke-test page; everything else renders the AppShell.
 */
function currentRoute(): 'anatomy-demo' | 'shell' {
  if (typeof window === 'undefined') return 'shell';
  const path = window.location.pathname;
  if (path.endsWith('/demo/anatomy') || path.endsWith('/demo/anatomy/')) {
    return 'anatomy-demo';
  }
  return 'shell';
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
          {route === 'anatomy-demo' ? <AnatomyDemo /> : <AppShell />}
        </TranslationProvider>
      </ThemeProvider>
    </MantineProvider>
  );
}
