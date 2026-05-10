#!/usr/bin/env npx tsx
/**
 * Idempotent Playwright server starter.
 *
 * Safe for multiple agents to call simultaneously — uses port check
 * (not PID file) as the source of truth, so there's no race condition.
 *
 * Usage:
 *   npx tsx scripts/playwright/ensure-server.ts
 *
 * Exit codes:
 *   0 — server is running and ready
 *   1 — failed to start server within timeout
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

const PORT = 2400;
const PID_FILE = path.join(os.tmpdir(), 'playwright-server.pid');
const POLL_INTERVAL_MS = 500;
const MAX_POLLS = 20; // 10 seconds total

function checkPort(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: '127.0.0.1', port: PORT, method: 'GET', timeout: 2000 },
      () => resolve(true) // Any response (even 405) means server is alive
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function waitForServer(): Promise<boolean> {
  for (let i = 0; i < MAX_POLLS; i++) {
    if (await checkPort()) return true;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
}

async function main(): Promise<void> {
  // 1. Check if server is already running
  if (await checkPort()) {
    console.log('ready');
    process.exit(0);
  }

  // 2. Clean up stale PID file
  if (fs.existsSync(PID_FILE)) {
    const pid = fs.readFileSync(PID_FILE, 'utf-8').trim();
    try {
      process.kill(parseInt(pid), 0);
      // Process exists but port isn't responding — give it a moment
    } catch {
      fs.unlinkSync(PID_FILE);
    }
  }

  // 3. Spawn server.ts as detached background process
  const serverScript = path.join(__dirname, 'server.ts');
  const child = spawn('npx', ['tsx', serverScript], {
    detached: true,
    stdio: 'ignore',
    cwd: path.resolve(__dirname, '../..'),
  });
  child.unref();

  // 4. Poll until server is ready
  if (await waitForServer()) {
    console.log('ready');
    process.exit(0);
  } else {
    console.error('Failed to start Playwright server within 10 seconds');
    process.exit(1);
  }
}

main();
