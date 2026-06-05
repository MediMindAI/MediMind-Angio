// SPDX-License-Identifier: Apache-2.0
/**
 * Coerce a Mantine `NumberInput`/`EMRNumberInput` onChange value
 * (`number | string`) to `number | undefined`. Empty string and NaN → undefined
 * so a cleared field stores no value rather than 0 (audit L5 — shared helper,
 * previously duplicated across the iliac form + caval table).
 */
export function numInputToNumber(v: number | string): number | undefined {
  if (typeof v === 'number') return Number.isNaN(v) ? undefined : v;
  if (v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}
