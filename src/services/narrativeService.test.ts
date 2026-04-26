// SPDX-License-Identifier: Apache-2.0
/**
 * narrativeService tests — Wave 3.8 regression guards.
 *
 * Two findings closed by Wave 3.8 (Part 03 HIGH):
 *   1. `subclavianStealLeft` template painted only V2 retrograde — should
 *      paint V1 + V2 + V3 because the steal physiology reverses flow
 *      throughout the entire ipsilateral vertebral.
 *   2. `resolveEntry` only special-cased venous-LE keys (`vein`, bare
 *      `side`). Carotid + arterial generators emit `vessel`, `severity`,
 *      `morphology`, `waveform`, etc. — those used to fall through
 *      unresolved, leaving raw key strings in the localized impression.
 */

import { describe, expect, it } from 'vitest';
import { resolveEntry, type TranslateFn } from './narrativeService';
import { CAROTID_TEMPLATES } from '../components/studies/carotid/templates';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Echo translator: returns the key (or `key(k=v,...)` when params present),
 * so we can assert which params reached `t()` and how they were namespaced.
 */
const echoT: TranslateFn = (key, paramsOrDefault) => {
  if (paramsOrDefault === undefined) return key;
  if (typeof paramsOrDefault === 'string') return paramsOrDefault;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(paramsOrDefault)) {
    parts.push(`${k}=${String(v)}`);
  }
  return `${key}(${parts.join(',')})`;
};

/**
 * Marked translator: prefixes `[T]` to every direct-key resolution so we can
 * prove the resolver actually called `t()` on a param value (rather than
 * keeping it verbatim).
 */
const markedT: TranslateFn = (key, paramsOrDefault) => {
  if (paramsOrDefault === undefined || typeof paramsOrDefault === 'string') {
    return `[T]${key}`;
  }
  const parts: string[] = [];
  for (const [k, v] of Object.entries(paramsOrDefault)) {
    parts.push(`${k}=${String(v)}`);
  }
  return `${key}(${parts.join(',')})`;
};

// ---------------------------------------------------------------------------
// 1. subclavianStealLeft template — retrograde flow on V1 + V2 + V3 left
// ---------------------------------------------------------------------------

describe('Wave 3.8 — subclavianStealLeft template', () => {
  const tpl = CAROTID_TEMPLATES.find(
    (t) => t.id === 'carotid-subclavian-steal-left',
  );

  it('exists', () => {
    expect(tpl).toBeDefined();
  });

  it('sets retrograde flow on V1 + V2 + V3 left (Wave 3.8)', () => {
    expect(tpl?.findings['vert-v1-left']?.flowDirection).toBe('retrograde');
    expect(tpl?.findings['vert-v2-left']?.flowDirection).toBe('retrograde');
    expect(tpl?.findings['vert-v3-left']?.flowDirection).toBe('retrograde');
  });

  it('sets steal phase 3 on V1 + V2 + V3 left (Wave 3.8)', () => {
    expect(tpl?.findings['vert-v1-left']?.subclavianStealPhase).toBe(3);
    expect(tpl?.findings['vert-v2-left']?.subclavianStealPhase).toBe(3);
    expect(tpl?.findings['vert-v3-left']?.subclavianStealPhase).toBe(3);
  });

  it('keeps right vertebrals at phase 0 with antegrade flow', () => {
    expect(tpl?.findings['vert-v1-right']?.subclavianStealPhase).toBe(0);
    expect(tpl?.findings['vert-v2-right']?.subclavianStealPhase).toBe(0);
    expect(tpl?.findings['vert-v3-right']?.subclavianStealPhase).toBe(0);
    expect(tpl?.findings['vert-v2-right']?.flowDirection).toBe('antegrade');
  });

  it('keeps the proximal subclavian stenosis on the left', () => {
    expect(tpl?.findings['subclav-prox-left']?.psvCmS).toBe(280);
  });
});

// ---------------------------------------------------------------------------
// 2. resolveEntry — generalized translation-key passthrough
// ---------------------------------------------------------------------------

describe('Wave 3.8 — resolveEntry (carotid + arterial key resolution)', () => {
  it('returns t(key) when entry has no params', () => {
    const out = resolveEntry({ key: 'simple.key' }, echoT);
    expect(out).toBe('simple.key');
  });

  it('resolves carotid `vessel` + pre-prefixed `side` + `morphology` + numeric `length`', () => {
    const out = resolveEntry(
      {
        key: 'carotid.narrative.plaque',
        params: {
          vessel: 'carotid.vessel.cca-prox',
          side: 'carotid.side.left',
          morphology: 'carotid.plaque.mixed',
          length: 12,
        },
      },
      echoT,
    );
    // Every dotted-string param round-trips through echoT (proving t() was
    // called on the value), the numeric passes through unchanged.
    expect(out).toContain('vessel=carotid.vessel.cca-prox');
    expect(out).toContain('side=carotid.side.left');
    expect(out).toContain('morphology=carotid.plaque.mixed');
    expect(out).toContain('length=12');
  });

  it('resolves arterial `vein` + pre-prefixed `side` + `severity` + numeric `psv`', () => {
    const out = resolveEntry(
      {
        key: 'arterialLE.narrative.stenosis',
        params: {
          vein: 'arterialLE.segment.sfa-mid',
          side: 'arterialLE.side.left',
          severity: 'arterialLE.stenosis.severe',
          psv: 280,
        },
      },
      echoT,
    );
    expect(out).toContain('vein=arterialLE.segment.sfa-mid');
    expect(out).toContain('side=arterialLE.side.left');
    expect(out).toContain('severity=arterialLE.stenosis.severe');
    expect(out).toContain('psv=280');
  });

  it('actually calls t() on dotted-string params (not verbatim passthrough)', () => {
    const out = resolveEntry(
      {
        key: 'carotid.narrative.occluded',
        params: { vessel: 'carotid.vessel.bulb' },
      },
      markedT,
    );
    // markedT prefixes `[T]` to single-arg lookups → proves the value
    // was routed through t() and not passed as a literal.
    expect(out).toContain('vessel=[T]carotid.vessel.bulb');
  });

  it('namespaces a bare venous `side` into venousLE.sides.<v> (legacy back-compat)', () => {
    const out = resolveEntry(
      {
        key: 'venousLE.narrative.normalSide',
        params: { side: 'left' },
      },
      echoT,
    );
    expect(out).toContain('side=venousLE.sides.left');
  });

  it('still calls t() on the bare-side namespaced lookup', () => {
    const out = resolveEntry(
      {
        key: 'venousLE.narrative.normalSide',
        params: { side: 'right' },
      },
      markedT,
    );
    expect(out).toContain('side=[T]venousLE.sides.right');
  });

  it('passes numeric values (phase, abi) through unchanged', () => {
    const out = resolveEntry(
      {
        key: 'carotid.narrative.stealPhase',
        params: { phase: 3, abi: 0.78 },
      },
      echoT,
    );
    expect(out).toContain('phase=3');
    expect(out).toContain('abi=0.78');
  });

  it('passes bare non-side strings (no dots) through unchanged', () => {
    const out = resolveEntry(
      {
        key: 'some.note',
        params: { note: 'free-text' },
      },
      echoT,
    );
    expect(out).toContain('note=free-text');
  });

  it('asserts no raw dotted key fragments leak when t() returns localized text', () => {
    // Real-world translator: returns Georgian-ish localized strings for
    // the dotted lookups. Verifies the localized impression has zero
    // raw `carotid.*` substrings — the bug the audit flagged.
    const localT: TranslateFn = (key, paramsOrDefault) => {
      const localized: Record<string, string> = {
        'carotid.vessel.cca-prox': 'CCA proximal',
        'carotid.side.left': 'მარცხენა',
        'carotid.stenosis.severe': 'მძიმე',
      };
      if (paramsOrDefault === undefined || typeof paramsOrDefault === 'string') {
        return localized[key] ?? key;
      }
      // Top-level call: substitute params.
      const tpl = localized[key] ?? `${key} {vessel} {side} {severity}`;
      let out = tpl;
      for (const [k, v] of Object.entries(paramsOrDefault)) {
        out = out.replaceAll(`{${k}}`, String(v));
      }
      return out;
    };

    const out = resolveEntry(
      {
        key: 'carotid.narrative.severeStenosis',
        params: {
          vessel: 'carotid.vessel.cca-prox',
          side: 'carotid.side.left',
          severity: 'carotid.stenosis.severe',
        },
      },
      localT,
    );
    expect(out).not.toContain('carotid.vessel.');
    expect(out).not.toContain('carotid.side.');
    expect(out).not.toContain('carotid.stenosis.');
    // Sanity: localized fragments are present.
    expect(out).toContain('CCA proximal');
    expect(out).toContain('მარცხენა');
    expect(out).toContain('მძიმე');
  });
});
