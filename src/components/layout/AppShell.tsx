import { AppShell as MantineAppShell, Button, Container, Group, Stack, Text, Title } from '@mantine/core';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../contexts/TranslationContext';

/**
 * Minimal AppShell — Phase 0 stub.
 * The frontend-designer agent will replace this with a production-grade
 * layout (logo lockup, language switcher, theme toggle, study picker grid).
 */
export function AppShell() {
  const { t, lang, setLang } = useTranslation();
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <MantineAppShell
      header={{ height: 64 }}
      padding="md"
      styles={{
        main: {
          background: 'var(--emr-bg-page)',
          color: 'var(--emr-text-primary)',
          minHeight: '100vh',
        },
        header: {
          background: 'var(--emr-gradient-primary)',
          borderBottom: 'none',
          color: 'var(--emr-text-inverse)',
        },
      }}
    >
      <MantineAppShell.Header>
        <Container fluid h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Group gap="md">
              <Title
                order={3}
                style={{
                  color: 'var(--emr-text-inverse)',
                  fontSize: 'var(--emr-font-lg)',
                  fontWeight: 'var(--emr-font-semibold)',
                  letterSpacing: '-0.01em',
                }}
              >
                {t('app.title')}
              </Title>
              <Text
                style={{
                  color: 'var(--emr-text-inverse-secondary)',
                  fontSize: 'var(--emr-font-sm)',
                }}
                visibleFrom="sm"
              >
                {t('app.subtitle')}
              </Text>
            </Group>

            <Group gap="xs" wrap="nowrap">
              <Group gap={4}>
                {(['ka', 'en', 'ru'] as const).map((l) => (
                  <Button
                    key={l}
                    size="compact-sm"
                    variant={lang === l ? 'white' : 'subtle'}
                    color={lang === l ? 'blue.9' : 'gray.0'}
                    onClick={() => setLang(l)}
                    styles={{
                      root: {
                        color: lang === l ? 'var(--emr-primary)' : 'var(--emr-text-inverse)',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      },
                      label: { overflow: 'visible', height: 'auto' },
                    }}
                  >
                    {t(`language.${l}`)}
                  </Button>
                ))}
              </Group>

              <Button
                size="compact-sm"
                variant="subtle"
                onClick={toggleTheme}
                aria-label={t('theme.toggle')}
                styles={{
                  root: {
                    color: 'var(--emr-text-inverse)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  },
                  label: { overflow: 'visible', height: 'auto' },
                }}
              >
                {resolvedTheme === 'dark' ? '☀' : '☾'}
              </Button>
            </Group>
          </Group>
        </Container>
      </MantineAppShell.Header>

      <MantineAppShell.Main>
        <Container size="lg">
          <Stack gap="lg" py="xl">
            <Stack gap={4}>
              <Title
                order={1}
                style={{
                  color: 'var(--emr-text-primary)',
                  fontSize: 'var(--emr-font-3xl)',
                  fontWeight: 'var(--emr-font-bold)',
                  letterSpacing: 'var(--emr-letter-spacing-tight)',
                }}
              >
                {t('studyPicker.title')}
              </Title>
              <Text
                style={{
                  color: 'var(--emr-text-secondary)',
                  fontSize: 'var(--emr-font-md)',
                }}
              >
                {t('studyPicker.subtitle')}
              </Text>
            </Stack>

            {/* Phase 0 placeholder — study picker grid comes from frontend-designer */}
            <Text
              style={{
                color: 'var(--emr-text-tertiary)',
                fontSize: 'var(--emr-font-sm)',
                fontStyle: 'italic',
              }}
            >
              Phase 0 scaffolding — study picker UI pending.
            </Text>
          </Stack>
        </Container>
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
