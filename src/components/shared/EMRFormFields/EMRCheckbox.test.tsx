// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 4.5 — Area 06 MEDIUM (EMRCheckbox controlled-mode no-double-fire).
 *
 * Pre-fix: the wrapper Group had its own `onClick` handler that flipped
 * `internalChecked` AND called `onChange`, while the hidden native input
 * also fired `change`. Result: `onChange` fired twice per click. After the
 * fix, the row is wrapped as a native `<label htmlFor>` that defers all
 * click semantics to the input, and `setInternalChecked` is skipped in
 * controlled mode so the parent's `checked` prop is the single source of
 * truth.
 */

import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { EMRCheckbox } from './EMRCheckbox';

function Wrap({ children }: { children: React.ReactNode }): React.ReactElement {
  return <MantineProvider>{children}</MantineProvider>;
}

describe('EMRCheckbox — onChange fires exactly once per click (Wave 4.5)', () => {
  it('rapid double-click triggers onChange exactly twice (not 4×)', () => {
    const onChange = vi.fn();
    function Controlled(): React.ReactElement {
      const [checked, setChecked] = useState(false);
      return (
        <EMRCheckbox
          label="Test"
          checked={checked}
          onChange={(c) => {
            onChange(c);
            setChecked(c);
          }}
          data-testid="cbx"
        />
      );
    }
    render(
      <Wrap>
        <Controlled />
      </Wrap>,
    );

    const input = screen.getByTestId('cbx') as HTMLInputElement;

    fireEvent.click(input);
    fireEvent.click(input);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[0]![0]).toBe(true);
    expect(onChange.mock.calls[1]![0]).toBe(false);
  });
});
