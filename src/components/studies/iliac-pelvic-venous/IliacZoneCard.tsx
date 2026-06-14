// SPDX-License-Identifier: Apache-2.0
/**
 * IliacZoneCard — presentational shell for one anatomical zone of the
 * iliac/pelvic venous form. A thin adapter over the standardized
 * `EMRContentSection` (the Command gradient tick-bar header + hairline + deck),
 * so every zone reads as a first-class section AND shares one source of truth
 * with the rest of the platform instead of re-implementing the header.
 */

import { memo, type ReactNode } from 'react';
import { EMRContentSection } from '../../common';

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
    <EMRContentSection
      title={title}
      subtitle={subtitle}
      showAccent={false}
      padding="lg"
      {...(testId ? { 'data-testid': testId } : {})}
    >
      {children}
    </EMRContentSection>
  );
});

export default IliacZoneCard;
