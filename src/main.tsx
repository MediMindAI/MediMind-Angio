import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { migrateLocalStorageDrafts } from './services/draftStore';
import { migrateLegacyDrafts } from './services/encounterMigration';
// Mantine first so theme.css overrides on equal specificity (Wave 4.4).
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import './styles/theme.css';
import './styles/print.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

// Wave 4.1 — fire-and-forget migration of any pre-existing localStorage
// drafts into IndexedDB. The new drafts banner + clear-all UX reads from
// IDB; without this hop, drafts written before the upgrade would never
// surface in the banner. The migration keeps the localStorage copy as a
// 30-day safety net so reducer-init `loadDraft` (sync) still works.
//
// Phase 2.b — also promote legacy per-study drafts to encounter-keyed
// shape via `migrateLegacyDrafts()`. Both migrations are independent and
// idempotent; order doesn't matter.
void Promise.all([
  migrateLocalStorageDrafts().catch((err) => {
    console.warn('[main] localStorage migration failed', err);
  }),
  migrateLegacyDrafts().catch((err) => {
    console.warn('[main] legacy → encounter migration failed', err);
  }),
]);

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
