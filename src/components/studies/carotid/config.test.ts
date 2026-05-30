// SPDX-License-Identifier: Apache-2.0
/**
 * Diagram-coloring tests for the carotid severity model.
 *
 * Pins two rules that previously mis-colored the neck-carotid diagram:
 *  1. NASCET/SRU grade is an ICA-bifurcation property — it must color the ICA
 *     segments + the bulb ONLY, never the CCA/ECA/vertebral/subclavian on the
 *     same side (the "stenosis bleeds across every branch" bug).
 *  2. A chosen plaque morphology implies plaque is present even when the
 *     explicit `plaquePresent` flag was never set (the segment-table Plaque
 *     column writes morphology only), so the vessel colors mild.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveCarotidBand,
  deriveCarotidCompetency,
  type CarotidFindings,
  type CarotidVesselFinding,
} from './config';

/** Seed a finding object on every passed vessel id (both sides irrelevant here). */
function findings(
  parts: Partial<Record<string, Partial<CarotidVesselFinding>>>,
): CarotidFindings {
  const out: Record<string, CarotidVesselFinding> = {};
  for (const [id, f] of Object.entries(parts)) {
    out[id] = { ...(f ?? {}) } as CarotidVesselFinding;
  }
  return out as CarotidFindings;
}

describe('resolveCarotidBand — NASCET scope', () => {
  // Every left vessel carries a (normal) finding, mirroring how `allVessels()`
  // seeds a template. A left ≥70% NASCET must color ONLY the ICA + bulb.
  const allLeftSeeded = findings({
    'cca-prox-left': {},
    'cca-mid-left': {},
    'cca-dist-left': {},
    'ica-prox-left': {},
    'ica-mid-left': {},
    'ica-dist-left': {},
    'eca-left': {},
    'vert-v1-left': {},
    'subclav-prox-left': {},
  });
  const nascet = { left: 'ge70' as const };

  it('colors ICA segments severe', () => {
    expect(resolveCarotidBand(allLeftSeeded, nascet, 'ica-prox-left')).toBe('severe');
    expect(resolveCarotidBand(allLeftSeeded, nascet, 'ica-dist-left')).toBe('severe');
  });

  it('colors the bulb severe (mirrors proximal ICA)', () => {
    // No bulb finding exists; it mirrors ica-prox AND inherits the NASCET grade.
    expect(resolveCarotidBand(allLeftSeeded, nascet, 'bulb-left')).toBe('severe');
  });

  it('does NOT bleed onto CCA / ECA / vertebral / subclavian', () => {
    for (const id of [
      'cca-prox-left',
      'cca-mid-left',
      'cca-dist-left',
      'eca-left',
      'vert-v1-left',
      'subclav-prox-left',
    ]) {
      expect(resolveCarotidBand(allLeftSeeded, nascet, id)).toBe('normal');
    }
  });

  it('leaves the opposite side untouched', () => {
    expect(resolveCarotidBand(allLeftSeeded, nascet, 'ica-prox-right')).toBe('normal');
  });
});

describe('deriveCarotidCompetency — plaque morphology colors mild', () => {
  it('a chosen morphology turns the vessel mild even without plaquePresent', () => {
    expect(deriveCarotidCompetency({ plaqueMorphology: 'type3' })).toBe('mild');
  });

  it('morphology "none" stays normal', () => {
    expect(deriveCarotidCompetency({ plaqueMorphology: 'none' })).toBe('normal');
  });

  it('explicit plaquePresent still colors mild', () => {
    expect(deriveCarotidCompetency({ plaquePresent: true })).toBe('mild');
  });

  it('a higher NASCET grade outranks plaque', () => {
    expect(deriveCarotidCompetency({ plaqueMorphology: 'type3' }, '50to69')).toBe('moderate');
  });
});
