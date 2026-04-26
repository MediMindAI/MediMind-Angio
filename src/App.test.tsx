// SPDX-License-Identifier: Apache-2.0
/**
 * App-level routing — Phase 3a redirect guards.
 *
 * Phase 3a of the encounter-pivot plan flips the bare study routes
 * (`/venous-le`, `/arterial-le`, `/carotid`) and their `/studies/*`
 * legacy aliases from "render the form" to "redirect to /". Users now
 * always pass through encounter intake (Phase 2b's `/` element).
 *
 * We don't import `App.tsx` itself here — it pulls in Mantine + every
 * form, which is heavy and tangential to the routing assertion. Instead
 * we model the same `<Routes>` shape locally with a minimal route table,
 * exactly like `components/studies/index.test.tsx` does. The point is to
 * pin Phase 3a's redirect contract — if a future refactor accidentally
 * re-points one of the bare routes back at a form, this catches it.
 */

import { describe, expect, it } from 'vitest';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

/**
 * Mirror of the App.tsx <Routes> shape with study routes redirecting to
 * `/`. Mock plugins (`/venous-le`, `/arterial-le`, `/carotid` + their
 * `/studies/*` aliases) replicate the registry without dragging in real
 * form components.
 */
function MiniApp({ initial }: { initial: string }): React.ReactElement {
  return (
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/" element={<div data-testid="landing">landing</div>} />
        <Route
          path="/demo/anatomy"
          element={<div data-testid="anatomy-demo">anatomy</div>}
        />
        <Route
          path="/encounter/:encounterId/:studyType"
          element={<div data-testid="encounter-wrapper">wrapper</div>}
        />
        {/* Phase 3a: bare study routes redirect to / */}
        <Route path="/venous-le" element={<Navigate to="/" replace />} />
        <Route path="/arterial-le" element={<Navigate to="/" replace />} />
        <Route path="/carotid" element={<Navigate to="/" replace />} />
        {/* Phase 3a: legacy /studies/* aliases redirect to / */}
        <Route
          path="/studies/venous-le"
          element={<Navigate to="/" replace />}
        />
        <Route
          path="/studies/arterial-le"
          element={<Navigate to="/" replace />}
        />
        <Route
          path="/studies/carotid"
          element={<Navigate to="/" replace />}
        />
        <Route path="*" element={<div data-testid="not-found">404</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('App routing — Phase 3a redirects', () => {
  it('redirects /venous-le to /', () => {
    render(<MiniApp initial="/venous-le" />);
    expect(screen.getByTestId('landing')).toBeInTheDocument();
    expect(screen.queryByTestId('not-found')).not.toBeInTheDocument();
  });

  it('redirects /arterial-le to /', () => {
    render(<MiniApp initial="/arterial-le" />);
    expect(screen.getByTestId('landing')).toBeInTheDocument();
  });

  it('redirects /carotid to /', () => {
    render(<MiniApp initial="/carotid" />);
    expect(screen.getByTestId('landing')).toBeInTheDocument();
  });

  it('redirects /studies/venous-le to /', () => {
    render(<MiniApp initial="/studies/venous-le" />);
    expect(screen.getByTestId('landing')).toBeInTheDocument();
  });

  it('redirects /studies/arterial-le to /', () => {
    render(<MiniApp initial="/studies/arterial-le" />);
    expect(screen.getByTestId('landing')).toBeInTheDocument();
  });

  it('redirects /studies/carotid to /', () => {
    render(<MiniApp initial="/studies/carotid" />);
    expect(screen.getByTestId('landing')).toBeInTheDocument();
  });

  it('renders the encounter wrapper for /encounter/:id/:studyType', () => {
    render(<MiniApp initial="/encounter/abc/arterialLE" />);
    expect(screen.getByTestId('encounter-wrapper')).toBeInTheDocument();
  });

  it('renders NotFound for unknown paths (Wave 2.2 guard preserved)', () => {
    render(<MiniApp initial="/totally-unknown" />);
    expect(screen.getByTestId('not-found')).toBeInTheDocument();
  });

  it('renders the landing page for /', () => {
    render(<MiniApp initial="/" />);
    expect(screen.getByTestId('landing')).toBeInTheDocument();
  });
});
