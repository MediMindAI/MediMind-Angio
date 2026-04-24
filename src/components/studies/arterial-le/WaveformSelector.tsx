// SPDX-License-Identifier: Apache-2.0
/**
 * WaveformSelector — compact 5-option radio group with SVG glyph icons
 * showing the morphology of each arterial Doppler waveform (triphasic,
 * biphasic, monophasic-phasic, monophasic-damped, absent).
 *
 * Rendered inline inside each arterial segment row. Designed to stay
 * the same height as a standard EMRSelect so table rows don't jump.
 */

import { memo } from 'react';
import { Tooltip } from '@mantine/core';
import { WAVEFORM_VALUES, type Waveform } from './config';
import { useTranslation } from '../../../contexts/TranslationContext';
import triphasicGlyph from './waveformGlyphs/triphasic.svg?url';
import biphasicGlyph from './waveformGlyphs/biphasic.svg?url';
import monoPhasicGlyph from './waveformGlyphs/monophasic-phasic.svg?url';
import monoDampedGlyph from './waveformGlyphs/monophasic-damped.svg?url';
import absentGlyph from './waveformGlyphs/absent.svg?url';
import classes from './WaveformSelector.module.css';

const GLYPHS: Record<Waveform, string> = {
  'triphasic': triphasicGlyph,
  'biphasic': biphasicGlyph,
  'monophasic-phasic': monoPhasicGlyph,
  'monophasic-damped': monoDampedGlyph,
  'absent': absentGlyph,
};

export interface WaveformSelectorProps {
  readonly value: Waveform | undefined;
  readonly onChange: (next: Waveform | undefined) => void;
  readonly size?: 'sm' | 'md';
  readonly 'aria-label'?: string;
  readonly 'data-testid'?: string;
  readonly disabled?: boolean;
}

export const WaveformSelector = memo(function WaveformSelector({
  value,
  onChange,
  size = 'sm',
  'aria-label': ariaLabel,
  'data-testid': testId,
  disabled,
}: WaveformSelectorProps): React.ReactElement {
  const { t } = useTranslation();

  const handleClick = (next: Waveform): void => {
    if (disabled) return;
    onChange(value === next ? undefined : next);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel ?? t('arterialLE.param.waveform', 'Waveform')}
      data-testid={testId}
      className={`${classes.group} ${size === 'md' ? classes.groupMd : ''}`}
    >
      {WAVEFORM_VALUES.map((w) => {
        const selected = value === w;
        const labelKey = `arterialLE.waveform.${w}`;
        const labelFallback = WAVEFORM_FALLBACK[w];
        const label = t(labelKey, labelFallback);
        return (
          <Tooltip
            key={w}
            label={label}
            withArrow
            position="top"
            openDelay={250}
            disabled={disabled}
          >
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={label}
              disabled={disabled}
              onClick={() => handleClick(w)}
              className={`${classes.option} ${selected ? classes.optionSelected : ''}`}
              data-testid={testId ? `${testId}-${w}` : undefined}
            >
              <img src={GLYPHS[w]} alt="" aria-hidden className={classes.glyph} />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
});

const WAVEFORM_FALLBACK: Record<Waveform, string> = {
  'triphasic': 'Triphasic',
  'biphasic': 'Biphasic',
  'monophasic-phasic': 'Monophasic, phasic',
  'monophasic-damped': 'Monophasic, damped',
  'absent': 'Absent / no flow',
};

export default WaveformSelector;
