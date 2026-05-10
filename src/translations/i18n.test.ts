// SPDX-License-Identifier: Apache-2.0
/**
 * i18n parity + key-existence tests.
 *
 * Why: Wave 2.3 wired several previously hardcoded surfaces (CEAPPicker,
 * AnatomyView tooltips, PDF "Issued" / page label, EMR form clear/empty
 * messages, VersionFooter) through `t()`. These tests guard against future
 * drift — they fail loudly if a translator drops a key from one locale or
 * if a developer adds a new English key without back-filling Georgian +
 * Russian.
 *
 * Coverage: the core namespace plus all four per-study namespaces +
 * the CEAP namespace. Every namespace must have identical key sets across
 * en / ka / ru.
 */
import { describe, expect, it } from 'vitest';

import enCore from './en.json';
import kaCore from './ka.json';
import ruCore from './ru.json';

import enArterial from './arterial-le/en.json';
import kaArterial from './arterial-le/ka.json';
import ruArterial from './arterial-le/ru.json';

import enCarotid from './carotid/en.json';
import kaCarotid from './carotid/ka.json';
import ruCarotid from './carotid/ru.json';

import enCeap from './ceap/en.json';
import kaCeap from './ceap/ka.json';
import ruCeap from './ceap/ru.json';

import enVenous from './venous-le/en.json';
import kaVenous from './venous-le/ka.json';
import ruVenous from './venous-le/ru.json';

/**
 * Recursively flatten a nested translation object into sorted dotted paths.
 * Arrays are treated as leaves (we have none in practice today, but keeping
 * the guard avoids surprises if translators add lists).
 */
function flatten(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [];
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys.push(...flatten(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

describe('i18n parity (core namespace)', () => {
  it('en/ka/ru have identical key sets', () => {
    const en = flatten(enCore);
    const ka = flatten(kaCore);
    const ru = flatten(ruCore);
    expect(ka).toEqual(en);
    expect(ru).toEqual(en);
  });

  it('contains the keys added by Wave 2.3', () => {
    const en = flatten(enCore);
    expect(en).toContain('pdf.issued');
    expect(en).toContain('pdf.pageLabel');
    expect(en).toContain('common.clearInput');
    expect(en).toContain('common.noOptionsFound');
    expect(en).toContain('versionFooter.aria');
    expect(en).toContain('versionFooter.buildPrefix');
    // Spot-check a few anatomy-segment + side keys (full sweep is parity above).
    expect(en).toContain('anatomy.segment.cfv');
    expect(en).toContain('anatomy.segment.gsv_prox_thigh');
    expect(en).toContain('anatomy.segment.gsv_calf');
    expect(en).toContain('anatomy.segment.avf_inflow');
    expect(en).toContain('anatomy.side.left');
    expect(en).toContain('anatomy.side.bilateral');
  });
});

describe('i18n parity (per-study namespaces)', () => {
  it('arterial-le: en/ka/ru parity', () => {
    expect(flatten(kaArterial)).toEqual(flatten(enArterial));
    expect(flatten(ruArterial)).toEqual(flatten(enArterial));
  });

  it('carotid: en/ka/ru parity', () => {
    expect(flatten(kaCarotid)).toEqual(flatten(enCarotid));
    expect(flatten(ruCarotid)).toEqual(flatten(enCarotid));
  });

  it('carotid: contains psv/edv column-header keys (Wave 4.8)', () => {
    // Wave 4.8: PSV/EDV column headers were hardcoded English. Now they
    // route through t() for consistency with neighboring headers.
    const en = flatten(enCarotid);
    expect(en).toContain('carotid.param.psv');
    expect(en).toContain('carotid.param.edv');
  });

  it('ceap: en/ka/ru parity', () => {
    expect(flatten(kaCeap)).toEqual(flatten(enCeap));
    expect(flatten(ruCeap)).toEqual(flatten(enCeap));
  });

  it('venous-le: en/ka/ru parity', () => {
    expect(flatten(kaVenous)).toEqual(flatten(enVenous));
    expect(flatten(ruVenous)).toEqual(flatten(enVenous));
  });
});
