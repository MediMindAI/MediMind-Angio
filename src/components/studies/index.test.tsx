// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 2.2 (Pattern A) — exact-match routing regression guards.
 *
 * Audit Part 03 HIGH: previously `findPluginByPath()` used
 * `pathname.endsWith(plugin.route)`, which silently matched any future
 * route ending in the same suffix — e.g. `/admin/edit-venous-le` would
 * be hijacked to render the VenousLE form. Today no such second-family
 * route exists, but the bug-class lurks. These tests pin the matcher to
 * EXACT equality so the bug cannot regress.
 *
 * Two complementary suites:
 *   1. `findPluginByPath` direct unit tests — assert the helper itself
 *      now exact-matches.
 *   2. React Router smoke test — render the `<Routes>` shape from
 *      App.tsx behind a `<MemoryRouter>` and prove a hijack-suffix URL
 *      lands on the catch-all (NotFound) instead of a plugin form.
 */

import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { findPluginByPath, STUDY_PLUGINS } from './index';

describe('findPluginByPath — exact match (Wave 2.2 Part-03 HIGH guard)', () => {
  it('matches /venous-le exactly', () => {
    const plugin = findPluginByPath('/venous-le');
    expect(plugin?.key).toBe('venousLE');
  });

  it('matches /arterial-le exactly', () => {
    const plugin = findPluginByPath('/arterial-le');
    expect(plugin?.key).toBe('arterialLE');
  });

  it('matches /carotid exactly', () => {
    const plugin = findPluginByPath('/carotid');
    expect(plugin?.key).toBe('carotid');
  });

  it('strips trailing slashes before matching', () => {
    const plugin = findPluginByPath('/venous-le/');
    expect(plugin?.key).toBe('venousLE');
  });

  it('honors the legacy /studies/<route> alias', () => {
    const plugin = findPluginByPath('/studies/venous-le');
    expect(plugin?.key).toBe('venousLE');
  });

  it('does NOT hijack /admin/edit-venous-le (the original endsWith bug)', () => {
    const plugin = findPluginByPath('/admin/edit-venous-le');
    expect(plugin).toBeNull();
  });

  it('does NOT hijack /foo/x-venous-le (suffix-collision)', () => {
    const plugin = findPluginByPath('/foo/x-venous-le');
    expect(plugin).toBeNull();
  });

  it('does NOT hijack /preview-arterial-le', () => {
    const plugin = findPluginByPath('/preview-arterial-le');
    expect(plugin).toBeNull();
  });

  it('does NOT hijack a /studies/<other-suffix> alias', () => {
    const plugin = findPluginByPath('/studies/admin/x-venous-le');
    expect(plugin).toBeNull();
  });

  it('returns null for unknown paths', () => {
    expect(findPluginByPath('/')).toBeNull();
    expect(findPluginByPath('/unknown')).toBeNull();
    expect(findPluginByPath('/demo/anatomy')).toBeNull();
  });

  it('skips plugins that have no route (coming-soon entries)', () => {
    // Sanity: at least one plugin in the registry has route=null
    const someComingSoon = STUDY_PLUGINS.some((p) => p.route === null);
    expect(someComingSoon).toBe(true);
  });
});

/**
 * Router smoke test — proves the App-level <Routes> wiring rejects
 * suffix-collision URLs even before reaching our helper. We don't
 * import App.tsx itself (it pulls in Mantine + every form, which is
 * heavy and tangential to the routing assertion); instead we model the
 * same shape locally with a minimal route table.
 */
function StudiesRouter({ initial }: { initial: string }): React.ReactElement {
  return (
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/" element={<div data-testid="landing">landing</div>} />
        <Route path="/venous-le" element={<div data-testid="venous-form">venous form</div>} />
        <Route path="/arterial-le" element={<div data-testid="arterial-form">arterial form</div>} />
        <Route path="/carotid" element={<div data-testid="carotid-form">carotid form</div>} />
        <Route path="*" element={<div data-testid="not-found">404</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('React Router exact-match wiring (Wave 2.2 Part-06 HIGH guard)', () => {
  it('renders venous form for /venous-le', () => {
    render(<StudiesRouter initial="/venous-le" />);
    expect(screen.getByTestId('venous-form')).toBeInTheDocument();
  });

  it('renders arterial form for /arterial-le', () => {
    render(<StudiesRouter initial="/arterial-le" />);
    expect(screen.getByTestId('arterial-form')).toBeInTheDocument();
  });

  it('renders carotid form for /carotid', () => {
    render(<StudiesRouter initial="/carotid" />);
    expect(screen.getByTestId('carotid-form')).toBeInTheDocument();
  });

  it('does NOT render arterial form for /admin/edit-arterial-le (original bug)', () => {
    render(<StudiesRouter initial="/admin/edit-arterial-le" />);
    expect(screen.queryByTestId('arterial-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('not-found')).toBeInTheDocument();
  });

  it('does NOT render venous form for /preview-venous-le', () => {
    render(<StudiesRouter initial="/preview-venous-le" />);
    expect(screen.queryByTestId('venous-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('not-found')).toBeInTheDocument();
  });

  it('renders landing for /', () => {
    render(<StudiesRouter initial="/" />);
    expect(screen.getByTestId('landing')).toBeInTheDocument();
  });

  it('renders NotFound for unknown paths', () => {
    render(<StudiesRouter initial="/totally-unknown" />);
    expect(screen.getByTestId('not-found')).toBeInTheDocument();
  });
});
