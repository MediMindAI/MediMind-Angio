import { describe, expect, it } from 'vitest';
import { ILIAC_CAVAL_ROW_ORDER } from './config';
import { ILIAC_PELVIC_VENOUS_TEMPLATES, NORMAL_CAVAL } from './templates';

describe('iliac pelvic venous templates', () => {
  it('normal template fills every row it claims is normal (level-up U-1025)', () => {
    const normal = ILIAC_PELVIC_VENOUS_TEMPLATES.find((tpl) => tpl.id === 'iliac-normal');
    expect(normal).toBeDefined();
    for (const id of ILIAC_CAVAL_ROW_ORDER) {
      expect(normal?.findings.caval?.[id]).toEqual({
        patency: 'patent',
        filling: 'full',
        competency: 'competent',
        ...(/^(civ|eiv|iiv|cfv)/.test(id) ? { phasicity: 'respirophasic' } : {}),
      });
    }
    expect(normal?.findings.gonadal?.left?.refluxPresent).toBe(false);
  });

  it('table rows: IVC prox/mid/dist + LRV, then per side, no ovarian rows', () => {
    expect(ILIAC_CAVAL_ROW_ORDER.slice(0, 4)).toEqual(['ivc-prox', 'ivc-mid', 'ivc-dist', 'lrv']);
    expect(ILIAC_CAVAL_ROW_ORDER).toHaveLength(20);
    expect(ILIAC_CAVAL_ROW_ORDER.some((id) => id.startsWith('ov-'))).toBe(false);
    expect(NORMAL_CAVAL.lrv).toEqual({ patency: 'patent', filling: 'full', competency: 'competent' });
  });

  it('the all-normal action and the normal template share one value set (UX-ANGIO-011)', () => {
    const normal = ILIAC_PELVIC_VENOUS_TEMPLATES.find((tpl) => tpl.id === 'iliac-normal');
    expect(normal?.findings.caval).toBe(NORMAL_CAVAL);
    expect(Object.keys(NORMAL_CAVAL)).toHaveLength(ILIAC_CAVAL_ROW_ORDER.length);
    // Sign-off S5: iliac + femoral rows are respirophasic; IVC and LRV stay blank.
    for (const id of ILIAC_CAVAL_ROW_ORDER) {
      const expected = /^(civ|eiv|iiv|cfv)/.test(id) ? 'respirophasic' : undefined;
      expect(NORMAL_CAVAL[id]?.phasicity).toBe(expected);
    }
  });
});
