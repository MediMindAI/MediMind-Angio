// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { validateArterial } from './arterialValidation';
import type { ArterialSegmentFindings, SegmentalPressures } from './config';

describe('validateArterial', () => {
  it('returns no warnings for an empty study', () => {
    expect(validateArterial({}, {})).toEqual([]);
  });

  it('flags a significant stenosis recorded with a triphasic waveform', () => {
    const findings: ArterialSegmentFindings = {
      'sfa-mid-right': { waveform: 'triphasic', stenosisCategory: 'severe' },
    };
    const warnings = validateArterial(findings, {});
    expect(warnings.some((w) => w.key === 'arterialLE.validation.stenosisTriphasic')).toBe(true);
  });

  it('does not flag a monophasic-damped waveform with significant stenosis', () => {
    const findings: ArterialSegmentFindings = {
      'sfa-mid-right': { waveform: 'monophasic-damped', stenosisCategory: 'severe' },
    };
    const warnings = validateArterial(findings, {});
    expect(warnings.some((w) => w.key === 'arterialLE.validation.stenosisTriphasic')).toBe(false);
  });

  it('flags an occluded segment that still carries a flow velocity', () => {
    const findings: ArterialSegmentFindings = {
      'pta-left': { occluded: true, psvCmS: 40 },
    };
    const warnings = validateArterial(findings, {});
    expect(warnings.some((w) => w.key === 'arterialLE.validation.occludedWithFlow')).toBe(true);
  });

  it('flags an incomplete ABI when a side has pressures but no ankle cuff', () => {
    const pressures: SegmentalPressures = { brachialR: 140, highThighR: 150 };
    const warnings = validateArterial({}, pressures);
    expect(warnings.some((w) => w.key === 'arterialLE.validation.abiIncomplete')).toBe(true);
  });

  it('does not flag ABI when both brachial and ankle pressures are present', () => {
    const pressures: SegmentalPressures = { brachialR: 140, ankleDpR: 130 };
    const warnings = validateArterial({}, pressures);
    expect(warnings.some((w) => w.key === 'arterialLE.validation.abiIncomplete')).toBe(false);
  });
});
