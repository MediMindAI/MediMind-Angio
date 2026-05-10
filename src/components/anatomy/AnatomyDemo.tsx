/**
 * AnatomyDemo — Phase 0 smoke test page.
 *
 * Shows both `le-anterior` and `le-posterior` diagrams side by side and
 * provides a few buttons that mutate the segment map so a reviewer can
 * visually confirm the coloring pipeline works end-to-end (load, parse,
 * recolor, hover, click).
 */

import { useCallback, useMemo, useState } from 'react';
import { Container, Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import type { Competency, SegmentId } from '../../types/anatomy';
import { useTranslation } from '../../contexts/TranslationContext';
import { EMRButton } from '../common';
import { AnatomyView } from './AnatomyView';
import { AnatomyLegend } from './AnatomyLegend';

// Segments present in each view — derived from the SVG `<path id>` list.
const ANTERIOR_SEGMENTS: readonly SegmentId[] = [
  'cfv-right', 'sfj-right', 'pfv-right',
  'fv-prox-right', 'fv-mid-right', 'fv-dist-right',
  'pop-ak-right', 'pop-bk-right', 'ptv-right', 'per-right',
  'gsv-prox-thigh-right', 'gsv-mid-thigh-right', 'gsv-dist-thigh-right', 'gsv-knee-right', 'gsv-calf-right',
  'cfv-left', 'sfj-left', 'pfv-left',
  'fv-prox-left', 'fv-mid-left', 'fv-dist-left',
  'pop-ak-left', 'pop-bk-left', 'ptv-left', 'per-left',
  'gsv-prox-thigh-left', 'gsv-mid-thigh-left', 'gsv-dist-thigh-left', 'gsv-knee-left', 'gsv-calf-left',
] as const;

const POSTERIOR_SEGMENTS: readonly SegmentId[] = [
  'pop-ak-right', 'pop-bk-right', 'spj-right',
  'ssv-right', 'gastroc-right', 'soleal-right', 'ptv-right', 'per-right',
  'gsv-calf-right',
  'pop-ak-left', 'pop-bk-left', 'spj-left',
  'ssv-left', 'gastroc-left', 'soleal-left', 'ptv-left', 'per-left',
  'gsv-calf-left',
] as const;

const ALL_DEMO_SEGMENTS: readonly SegmentId[] = Array.from(
  new Set<SegmentId>([...ANTERIOR_SEGMENTS, ...POSTERIOR_SEGMENTS]),
);

const ALL_COMPETENCIES: readonly Competency[] = [
  'normal',
  'ablated',
  'incompetent',
  'inconclusive',
] as const;

/**
 * Pick a uniformly-random element from a non-empty readonly array. The
 * `arr.length > 0` runtime guard upgrades `T | undefined` (under
 * `noUncheckedIndexedAccess`) to `T` without a defensive fallback value.
 */
function pickRandom<T>(arr: readonly T[]): T {
  if (arr.length === 0) {
    throw new Error('pickRandom called with empty array');
  }
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx] as T;
}

function randomCompetency(): Competency {
  return pickRandom(ALL_COMPETENCIES);
}

/** Seed a realistic-ish sample map for the initial render. */
function initialSample(): Record<SegmentId, Competency> {
  return {
    'gsv-prox-thigh-left': 'incompetent',
    'gsv-calf-left': 'incompetent',
    'ssv-right': 'ablated',
    'sfj-left': 'incompetent',
    'pop-ak-right': 'inconclusive',
  };
}

export function AnatomyDemo(): React.ReactElement {
  const { t } = useTranslation();
  const [segments, setSegments] = useState<Record<SegmentId, Competency>>(initialSample);
  const [lastClicked, setLastClicked] = useState<string | null>(null);

  const segmentCount = Object.keys(segments).length;

  const randomize = useCallback(() => {
    const next: Record<SegmentId, Competency> = {};
    for (const id of ALL_DEMO_SEGMENTS) {
      next[id] = randomCompetency();
    }
    setSegments(next);
  }, []);

  const reset = useCallback(() => {
    setSegments(initialSample());
    setLastClicked(null);
  }, []);

  const allIncompetent = useCallback(() => {
    const next: Record<SegmentId, Competency> = {};
    for (const id of ALL_DEMO_SEGMENTS) next[id] = 'incompetent';
    setSegments(next);
  }, []);

  const allNormal = useCallback(() => {
    setSegments({});
  }, []);

  const handleSegmentClick = useCallback((id: SegmentId, current: Competency) => {
    // Cycle through the four competencies on click. `ALL_COMPETENCIES` is
    // a non-empty constant, so `nextIdx` always lands on a valid element.
    const idx = ALL_COMPETENCIES.indexOf(current);
    const nextIdx = (idx + 1) % ALL_COMPETENCIES.length;
    const next = ALL_COMPETENCIES[nextIdx] as Competency;
    setSegments((prev) => ({ ...prev, [id]: next }));
    setLastClicked(`${id} → ${next}`);
  }, []);

  // Cast to the object shape used by AnatomyView.
  const segmentsProp = useMemo(() => segments, [segments]);

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <Stack gap={4}>
          <Title
            order={1}
            style={{
              color: 'var(--emr-text-primary)',
              fontSize: 'var(--emr-font-3xl)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            {t('anatomy.demo.title', 'Anatomy diagram smoke test')}
          </Title>
          <Text
            style={{
              color: 'var(--emr-text-secondary)',
              fontSize: 'var(--emr-font-md)',
            }}
          >
            {t(
              'anatomy.demo.subtitle',
              'Phase 0 verification — click a segment to cycle its competency. Hover for segment labels.',
            )}
          </Text>
        </Stack>

        <Paper
          p="md"
          radius="md"
          style={{
            background: 'var(--emr-bg-card)',
            border: '1px solid var(--emr-border-default)',
            boxShadow: 'var(--emr-shadow-sm)',
          }}
        >
          <Stack gap="md">
            <Group gap="sm" wrap="wrap">
              <EMRButton variant="primary" size="sm" onClick={randomize}>
                {t('anatomy.demo.randomize', 'Randomize')}
              </EMRButton>
              <EMRButton variant="secondary" size="sm" onClick={allIncompetent}>
                {t('anatomy.demo.allIncompetent', 'All incompetent')}
              </EMRButton>
              <EMRButton variant="secondary" size="sm" onClick={allNormal}>
                {t('anatomy.demo.allNormal', 'All normal')}
              </EMRButton>
              <EMRButton variant="ghost" size="sm" onClick={reset}>
                {t('anatomy.demo.reset', 'Reset')}
              </EMRButton>
            </Group>

            <Group gap="xs" wrap="wrap">
              <Text
                style={{
                  color: 'var(--emr-text-secondary)',
                  fontSize: 'var(--emr-font-sm)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {t('anatomy.demo.segmentCount', 'Segments set:')} {segmentCount}
              </Text>
              {lastClicked && (
                <Text
                  style={{
                    color: 'var(--emr-text-tertiary)',
                    fontSize: 'var(--emr-font-xs)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    fontFamily: 'var(--emr-font-mono)',
                  }}
                >
                  {t('anatomy.demo.lastClick', 'Last click:')} {lastClicked}
                </Text>
              )}
            </Group>
          </Stack>
        </Paper>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          <Paper
            p="md"
            radius="md"
            style={{
              background: 'var(--emr-bg-card)',
              border: '1px solid var(--emr-border-default)',
              boxShadow: 'var(--emr-shadow-sm)',
            }}
          >
            <Stack gap="sm" align="center">
              <Text
                style={{
                  color: 'var(--emr-text-primary)',
                  fontSize: 'var(--emr-font-lg)',
                  fontWeight: 600,
                }}
              >
                {t('anatomy.view.le-anterior', 'Anterior view')}
              </Text>
              <AnatomyView
                view="le-anterior"
                segments={segmentsProp}
                size="lg"
                onSegmentClick={handleSegmentClick}
              />
            </Stack>
          </Paper>

          <Paper
            p="md"
            radius="md"
            style={{
              background: 'var(--emr-bg-card)',
              border: '1px solid var(--emr-border-default)',
              boxShadow: 'var(--emr-shadow-sm)',
            }}
          >
            <Stack gap="sm" align="center">
              <Text
                style={{
                  color: 'var(--emr-text-primary)',
                  fontSize: 'var(--emr-font-lg)',
                  fontWeight: 600,
                }}
              >
                {t('anatomy.view.le-posterior', 'Posterior view')}
              </Text>
              <AnatomyView
                view="le-posterior"
                segments={segmentsProp}
                size="lg"
                onSegmentClick={handleSegmentClick}
              />
            </Stack>
          </Paper>
        </SimpleGrid>

        <Paper
          p="md"
          radius="md"
          style={{
            background: 'var(--emr-bg-card)',
            border: '1px solid var(--emr-border-default)',
            boxShadow: 'var(--emr-shadow-sm)',
          }}
        >
          <AnatomyLegend />
        </Paper>
      </Stack>
    </Container>
  );
}
