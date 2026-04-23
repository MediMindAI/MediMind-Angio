import { MantineProvider } from '@mantine/core';
import { ThemeProvider } from './contexts/ThemeContext';
import { TranslationProvider } from './contexts/TranslationContext';
import { mantineTheme, cssVariablesResolver, createAppColorSchemeManager } from './styles/mantineTheme';
import { STORAGE_KEYS } from './constants/storage-keys';
import { AppShell } from './components/layout/AppShell';

const colorSchemeManager = createAppColorSchemeManager(STORAGE_KEYS.THEME);
const initialColorScheme = colorSchemeManager.get('auto');

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
          <AppShell />
        </TranslationProvider>
      </ThemeProvider>
    </MantineProvider>
  );
}
