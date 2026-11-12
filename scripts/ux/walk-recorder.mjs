#!/usr/bin/env node
/**
 * walk-recorder — records a /level-up ux-lens walk in the walker's raw step-log format
 * (.claude/skills/level-up/references/ux-contracts.md §2, §3.3, §3.4) through a running
 * Playwright harness (scripts/playwright/server.ts). The scorer (scripts/ux/score-walks.ts)
 * reads what this writes; `protocolViolations` must stay 0.
 *
 * Why it exists: the M1/M5 walk helpers of the warehouse level-up lived in scratchpads and were
 * lost, so Prove could not replay "the same recorder". This one is committed.
 *
 * One task at a time per context (--context or WALK_CONTEXT); the in-flight task lives in
 * <run-dir>/.recorder-state-<context>.json, so each step
 * is one shell call and a crash loses at most the task in flight.
 *
 *   node scripts/ux/walk-recorder.mjs start --run-dir qa-reports/ux/runs/<runId> \
 *     --persona vascular-sonographer --task <taskId> --goal "<goal as in the task model>" \
 *     --context ux-walk [--app http://localhost:3001] [--entry /]
 *   (angio port: harness on PLAYWRIGHT_PORT, default 2400; bearer token only if the server wrote one; no seats/login)
 *   node scripts/ux/walk-recorder.mjs click "<selector>" --do "open Stock" [--label "<text>"] [--confidence unique|name-anchored|positional] [--would]
 *   node scripts/ux/walk-recorder.mjs fill "<selector>" "<value>" --do "type the item name"
 *   node scripts/ux/walk-recorder.mjs press "<key>" [--selector "<sel>"] --do "pick the first option"
 *   node scripts/ux/walk-recorder.mjs scroll <dy> --do "scroll to the table"
 *   node scripts/ux/walk-recorder.mjs arrived            (marks the current step as arrivedAtStep)
 *   node scripts/ux/walk-recorder.mjs observe <jargon|confusion|duplicate-path|dead-end|slow> "<note>"
 *   node scripts/ux/walk-recorder.mjs finish --outcome COMPLETED --note "..." [--persistence true|false|not-applicable]
 *     [--degraded "<what had to be resorted to>"]
 *   node scripts/ux/walk-recorder.mjs skip --persona P --task ID --goal G --run-dir D --note "precondition ..."
 *
 * `--would` records a WOULD-click at an irreversible step without pressing it (REACHED_THRESHOLD);
 * the scorer counts it as one dead click by contract, exactly as in M1.
 *
 * Limits: screens rows always record `scrollBlocked: false` (no stuck-scroll probe), so the scorer's
 * `unscrollable-overflow` never fires from these logs; and screens-1.json is not locked, so give each
 * persona folder to one walker at a time.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

export const VIEWPORT = { w: 1280, h: 720 };
const FOLD_UNIT = 900; // contracts §3.4 frozen unit

export function sha1Hex(text, length) {
  return createHash('sha1').update(text).digest('hex').slice(0, length);
}

/** §2 screen fingerprint: url | sorted digit-stripped visible h1-h3 | RAW modal shell count. */
export function computeFp({ u, h, m }) {
  return sha1Hex(`${u}|${h}|${m}`, 16);
}

/** §2 pane key: sorted visible data-testid values joined by '|'. */
export function computePaneKey(testids) {
  return sha1Hex([...testids].sort().join('|'), 12);
}

/** §3.3 transition precedence: pathname → open-dialog count → nothing. */
export function classifyTransition(before, after) {
  if (before.u !== after.u) return 'route-change';
  if (after.open > before.open) return 'modal-open';
  if (after.open < before.open) return 'modal-close';
  return 'no-visible-change';
}

export function buildTaskFile(state, endedAt) {
  return {
    schemaVersion: 1,
    runId: state.runId,
    persona: state.persona,
    taskId: state.taskId,
    goal: state.goal,
    startedAt: state.startedAt,
    endedAt,
    viewport: VIEWPORT,
    outcome: state.outcome,
    outcomeNote: state.outcomeNote ?? null,
    attempts: 1,
    arrivedAtStep: state.arrivedAtStep ?? null,
    persistenceVerified: state.persistenceVerified ?? 'not-applicable',
    routeQuality: state.routeQualityNote ? 'degraded' : 'normal',
    routeQualityNote: state.routeQualityNote ?? null,
    steps: state.steps,
    observations: state.observations,
    timeToUsableSec: state.timeToUsableSec ?? null,
  };
}

// Runs in the page. Returns the §2 inputs + §3.4 metrics in one round trip.
const PROBE = `(() => {
  const vis = (e) => e.offsetParent !== null || (e.getBoundingClientRect().width > 0 && getComputedStyle(e).position === 'fixed');
  const h = [...document.querySelectorAll('h1,h2,h3')].filter((e) => e.offsetParent !== null)
    .map((e) => e.textContent.trim().replace(/[0-9]/g, '')).sort().join('|');
  const shells = [...document.querySelectorAll('[role=dialog],.mantine-Modal-root')];
  const open = shells.filter((e) => e.offsetParent !== null && e.innerText.trim().length > 0).length;
  const testids = [...document.querySelectorAll('[data-testid]')].filter((e) => e.offsetParent !== null).map((e) => e.getAttribute('data-testid'));
  const ctl = [...document.querySelectorAll('button, a, input, select, textarea, [role="button"], [tabindex], [contenteditable="true"]')].filter(vis);
  const vw = innerWidth, vh = innerHeight;
  let small = 0, above = 0, off = 0, hclip = 0, noName = 0;
  for (const e of ctl) {
    const r = e.getBoundingClientRect();
    if (Math.min(r.width, r.height) < 44) small++;
    if (r.y + window.scrollY + r.height <= ${FOLD_UNIT}) above++;
    if (r.left < 0 || r.top < 0 || r.right > vw || r.bottom > vh) off++;
    if (r.left >= vw || r.right <= 0) hclip++;
    const name = (e.getAttribute('aria-label') || e.getAttribute('title') || e.innerText || e.value || e.getAttribute('placeholder') || '').trim();
    if (!name && !(e.labels && e.labels.length)) noName++;
  }
  const busy = [...document.querySelectorAll('.mantine-Loader-root,[aria-busy="true"],.mantine-Skeleton-root')].some(vis);
  const lm = document.querySelectorAll('header,nav,main,aside,footer,[role=banner],[role=navigation],[role=main],[role=complementary],[role=contentinfo]').length;
  return { u: location.pathname, h, m: shells.length, open, testids, scrollY: Math.round(window.scrollY),
    metrics: { visibleControls: ctl.length, smallTargets: small, aboveFoldControls: above, offViewportControls: off,
      horizontallyClippedControls: hclip, contentHeightPx: document.documentElement.scrollHeight, scrollBlocked: false,
      headingCount: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter((e) => e.offsetParent !== null).length,
      landmarkCount: lm, controlsWithoutAccessibleName: noName, modalDepth: shells.length, openDialogs: open,
      enumerateTruncated: ctl.length > 2000, title: (document.querySelector('h1')?.textContent || '').trim() },
    busy, ready: document.readyState === 'complete' };
})()`;

function harness(action, args, context) {
  const port = Number(process.env.PLAYWRIGHT_PORT || 2400);
  const tokenFile = path.join(os.tmpdir(), `playwright-server-${port}.token`);
  const token = fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, 'utf8').trim() : '';
  const body = JSON.stringify({ action, args, context });
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method: 'POST', timeout: 60_000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...(token ? { Authorization: `Bearer ${token}` } : {}) } },
    (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.success === false) reject(new Error(`${action} failed: ${parsed.error}`));
          else resolve(parsed.data ?? parsed);
        } catch { reject(new Error(`bad harness answer: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`${action} timed out`)); });
    req.write(body);
    req.end();
  });
}

async function probe(context) {
  const out = await harness('evaluate', [PROBE], context);
  return out.result;
}

/** Wait until no loader/skeleton is visible (max `ms`); returns seconds waited. */
async function settle(context, ms = 8000, minMs = 500) {
  const t0 = Date.now();
  await new Promise((r) => setTimeout(r, minMs));
  for (;;) {
    const p = await probe(context);
    if (p.ready && !p.busy) return { p, waited: (Date.now() - t0) / 1000 };
    if (Date.now() - t0 > ms) return { p, waited: (Date.now() - t0) / 1000 };
    await new Promise((r) => setTimeout(r, 250));
  }
}

function parseFlags(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[a.slice(2)] = true;
      else { flags[a.slice(2)] = next; i++; }
    } else pos.push(a);
  }
  return { pos, flags };
}

// One in-flight task per browser context, so parallel walkers in one run dir never collide.
const walkContext = (flags = {}) => flags.context || process.env.WALK_CONTEXT || 'wh-prove';
const statePath = (runDir, context = walkContext()) => path.join(runDir, `.recorder-state-${context}.json`);
const saveState = (s) => fs.writeFileSync(statePath(s.runDir, s.context), JSON.stringify(s, null, 1));

function currentRunDir(flags) {
  const runDir = flags['run-dir'] || process.env.WALK_RUN_DIR;
  if (!runDir) throw new Error('--run-dir or WALK_RUN_DIR required');
  return runDir;
}

async function recordScreenIfNew(state, p) {
  const fp = computeFp(p);
  if (state.seenFps.includes(fp)) return;
  state.seenFps.push(fp);
  const screensFile = path.join(state.runDir, 'walks', state.persona, 'screens-1.json');
  const doc = fs.existsSync(screensFile) ? JSON.parse(fs.readFileSync(screensFile, 'utf8')) : { schemaVersion: 1, screens: [] };
  if (doc.screens.some((s) => s.fp === fp)) return;
  const shot = await captureShot(state, `screen-${fp}`);
  const { title, ...metrics } = p.metrics;
  doc.screens.push({ fp, url: p.u, title, viewport: VIEWPORT, ...metrics, screenshot: shot });
  fs.writeFileSync(screensFile, JSON.stringify(doc, null, 1));
}

async function captureShot(state, name) {
  const res = await harness('screenshot', [`walk-${state.taskId}-${name}`], state.context);
  const dir = path.join(state.runDir, 'walks', state.persona, 'shots');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `${name}.png`);
  if (res.path && fs.existsSync(res.path)) fs.renameSync(res.path, target);
  return `shots/${name}.png`;
}

async function doStep(state, kind, action, args, flags) {
  const before = await probe(state.context);
  const n = state.steps.length + 1;
  const ts = new Date().toISOString();
  if (!flags.would && action) await harness(action, args, state.context);
  const after = flags.would ? before : (await settle(state.context)).p;
  const transition = classifyTransition(before, after);
  const step = {
    n, ts,
    do: flags.do || `${kind} ${args[0] ?? ''}`.trim(),
    playwright: flags.would ? `WOULD click ${JSON.stringify(args[0])} (irreversible, not pressed)` : `npx tsx scripts/playwright/cmd.ts ${JSON.stringify(action)} ${args.map((a) => JSON.stringify(a)).join(' ')}`,
    kind,
    selector: args[0] ?? null,
    labelText: flags.label ?? null,
    selectorConfidence: flags.confidence || 'name-anchored',
    fpBefore: computeFp(before), fpAfter: computeFp(after),
    paneKeyBefore: computePaneKey(before.testids), paneKeyAfter: computePaneKey(after.testids),
    transition,
    scrollDeltaY: after.scrollY - before.scrollY,
    screenshot: transition === 'no-visible-change' ? null : await captureShot(state, `${state.taskId}-s${String(n).padStart(2, '0')}`),
  };
  state.steps.push(step);
  await recordScreenIfNew(state, after);
  saveState(state);
  console.log(JSON.stringify({ n, transition, u: after.u, open: after.open, fp: step.fpAfter, pane: step.paneKeyAfter }));
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, flags } = parseFlags(rest);
  if (cmd === 'start') {
    const runDir = currentRunDir(flags);
    const app = flags.app || 'http://localhost:3001';
    const context = walkContext(flags);
    const state = { runDir, runId: path.basename(runDir), persona: flags.persona, taskId: flags.task, goal: flags.goal,
      context, startedAt: new Date().toISOString(), steps: [], observations: [], seenFps: [] };
    if (!state.persona || !state.taskId || !state.goal) throw new Error('--persona, --task and --goal are required');
    fs.mkdirSync(path.join(runDir, 'walks', state.persona, 'tasks'), { recursive: true });
    await harness('viewport', [String(VIEWPORT.w), String(VIEWPORT.h)], context);
    const entry = `${app}${flags.entry || '/'}`;
    const before = await probe(context).catch(() => ({ u: '-', h: '', m: 0, open: 0, testids: [], scrollY: 0 }));
    const t0 = Date.now();
    await harness('navigate', [entry], context);
    const { p } = await settle(context, 60_000, 300);
    state.timeToUsableSec = Math.round((Date.now() - t0) / 100) / 10;
    state.steps.push({ n: 1, ts: new Date(t0).toISOString(), do: `open ${flags.entry || '/'}`, playwright: `navigate ${JSON.stringify(entry)}`,
      kind: 'navigate-entry', selector: null, labelText: null, selectorConfidence: 'unique',
      fpBefore: before.u === '-' ? '-' : computeFp(before), fpAfter: computeFp(p),
      paneKeyBefore: computePaneKey(before.testids), paneKeyAfter: computePaneKey(p.testids),
      transition: 'route-change', scrollDeltaY: 0, screenshot: null });
    state.steps[0].screenshot = await captureShot(state, `${state.taskId}-s01`);
    await recordScreenIfNew(state, p);
    saveState(state);
    console.log(JSON.stringify({ started: state.taskId, timeToUsableSec: state.timeToUsableSec, u: p.u }));
    return;
  }
  if (cmd === 'skip') {
    const runDir = currentRunDir(flags);
    const state = { runDir, runId: path.basename(runDir), persona: flags.persona, taskId: flags.task, goal: flags.goal,
      startedAt: new Date().toISOString(), steps: [], observations: [], outcome: 'SKIPPED_PRECONDITION', outcomeNote: flags.note };
    const dir = path.join(runDir, 'walks', state.persona, 'tasks');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${state.taskId}.json`), JSON.stringify(buildTaskFile(state, state.startedAt), null, 1));
    console.log(JSON.stringify({ skipped: state.taskId }));
    return;
  }
  if (cmd === 'look') {
    // Read-only: list visible controls (testid / aria-label / text) so the walker picks like a person would.
    const filter = JSON.stringify(pos[0] || '');
    const out = await harness('evaluate', [`(() => { const f=${filter}.toLowerCase(); const root=[...document.querySelectorAll('[role=dialog]')].filter(e=>e.offsetParent!==null&&e.innerText.trim()).pop()||document;
      const portal=root===document?[]:[...document.querySelectorAll('[role="option"], [role="menuitem"]')];
      return [...root.querySelectorAll('button, a, input, select, textarea, [role="button"], [role="tab"], [role="option"], [role="menuitem"], [role="checkbox"]'), ...portal]
      .filter(e=>e.offsetParent!==null).map(e=>{const r=e.getBoundingClientRect(); return [e.tagName.toLowerCase(), e.getAttribute('data-testid')||'', e.getAttribute('aria-label')||e.getAttribute('placeholder')||'', (e.innerText||e.value||'').trim().replace(/\\s+/g,' ').slice(0,60), Math.round(r.x)+','+Math.round(r.y), e.disabled?'disabled':''].join(' | ')})
      .filter(s=>!f||s.toLowerCase().includes(f)).slice(0,${Number(flags.max || 80)}); })()`], walkContext(flags));
    console.log(out.result.join('\n'));
    return;
  }
  const state = JSON.parse(fs.readFileSync(statePath(currentRunDir(flags), walkContext(flags)), 'utf8'));
  if (cmd === 'click') return doStep(state, 'activation', 'click', [pos[0]], flags);
  if (cmd === 'fill') return doStep(state, 'fill', 'fill', [pos[0], pos[1]], flags);
  if (cmd === 'press') return doStep(state, pos[0] === 'Escape' ? 'escape' : 'keypress', 'press', flags.selector ? [flags.selector, pos[0]] : [pos[0]], { ...flags, do: flags.do || `press ${pos[0]}` });
  if (cmd === 'scroll') return doStep(state, 'scroll', 'wheel', ['640', '400', String(pos[0] || 600)], flags);
  if (cmd === 'arrived') { state.arrivedAtStep = state.steps.length; saveState(state); console.log(JSON.stringify({ arrivedAtStep: state.arrivedAtStep })); return; }
  if (cmd === 'observe') {
    state.observations.push({ atStep: state.steps.length, type: pos[0], note: pos[1] });
    saveState(state);
    return;
  }
  if (cmd === 'finish') {
    state.outcome = flags.outcome;
    state.outcomeNote = flags.note ?? null;
    if (flags.persistence !== undefined) state.persistenceVerified = flags.persistence === 'true' ? true : flags.persistence === 'false' ? false : 'not-applicable';
    if (typeof flags.degraded === 'string') state.routeQualityNote = flags.degraded;
    if (flags['time-to-usable']) state.timeToUsableSec = Number(flags['time-to-usable']);
    const file = path.join(state.runDir, 'walks', state.persona, 'tasks', `${state.taskId}.json`);
    fs.writeFileSync(file, JSON.stringify(buildTaskFile(state, new Date().toISOString()), null, 1));
    fs.rmSync(statePath(state.runDir, state.context));
    console.log(JSON.stringify({ wrote: file, steps: state.steps.length, outcome: state.outcome }));
    return;
  }
  throw new Error(`unknown command ${cmd}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(JSON.stringify({ error: e.message })); process.exit(1); });
}
