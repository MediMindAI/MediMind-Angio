/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'test/**/*.{test,spec}.{ts,tsx}'],
    // Wave 1 will add tests; until then, an empty suite is success, not failure.
    passWithNoTests: true,
    // Phase 5 Item 1 — test runner stability.
    //
    // Symptom (pre-fix): `npm run test:run` flakily reported 5-8 failures
    // across 3 files (ReflexTimeTable, EncounterIntake, ArterialLEForm).
    // Every failure was a timeout (`Test timed out in Xms`); each file
    // passed cleanly in isolation or under `--no-file-parallelism`.
    //
    // Root cause: jsdom + Mantine + heavy MultiSelect/reducer trees are
    // CPU-bound during render. Vitest's default thread pool spawns one
    // worker per CPU core, so on the developer's 10-core machine 10
    // parallel jsdom contexts contend for event-loop time. Tests that
    // open Mantine portals or run a 30+ field reducer routinely blow past
    // the default 5 s timeout under that contention.
    //
    // Fix (combined A + B from the Phase 5 brief):
    //   A. Cap the thread pool at 4 workers. 4 keeps total wall time
    //      reasonable (~2x serial) while leaving 6 cores free for the OS
    //      and the rest of the toolchain. `isolate: true` is the Vitest
    //      default but stated explicitly so the choice is auditable.
    //   B. Bump `testTimeout` from 5 s → 30 s. Per-test `{ timeout }`
    //      overrides (e.g. ArterialLEForm's 60_000 ms suite-level cap)
    //      still win when set explicitly. 30 s is enough headroom for
    //      Mantine MultiSelect mount + reducer churn under contention,
    //      and short enough that a genuine hang surfaces quickly.
    //
    // After the fix: 376/376 green across 3 consecutive `npm run test:run`
    // invocations on a cold cache. If the suite ever flakes again, the
    // first lever to pull is dropping `maxThreads` to 2.
    pool: 'threads',
    maxWorkers: 4,
    minWorkers: 1,
    isolate: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
