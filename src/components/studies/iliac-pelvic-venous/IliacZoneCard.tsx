// SPDX-License-Identifier: Apache-2.0
/**
 * IliacZoneCard — presentational shell for one anatomical zone of the
 * iliac/pelvic venous form (icon-free Paper card with title + optional
 * subtitle + body slot). Keeps the form's JSX flat and the zones visually
 * consistent.
 */

import { memo, type ReactNode } from 'react';
import { Paper, Stack, Title, Text } from '@mantine/core';

export interface IliacZoneCardProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
  readonly testId?: string;
}

export const IliacZoneCard = memo(function IliacZoneCard({
  title,
  subtitle,
  children,
  testId,
}: IliacZoneCardProps): React.ReactElement {
  return (
    <Paper withBorder radius="md" shadow="sm" p="md" data-testid={testId}>
      <Stack gap="sm">
        <div>
          <Title order={5} mb={2}>
            {title}
          </Title>
          {subtitle ? (
            <Text size="sm" c="dimmed">
              {subtitle}
            </Text>
          ) : null}
        </div>
        {children}
      </Stack>
    </Paper>
  );
});

export default IliacZoneCard;
