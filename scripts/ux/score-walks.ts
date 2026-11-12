/**
 * score-walks.ts — /level-up ux lens scorer (ported from MediMind /ux-simplify Phase 5)
 *
 * Derives ALL friction metrics from raw walk logs with the frozen rules in
 * .claude/skills/level-up/references/ux-contracts.md §3.5. Walkers record facts;
 * this script computes numbers — same log in, same numbers out, forever. No agent
 * ever self-reports a click count.
 *
 * Outputs runs/<runId>/scoreboard.json and appends the run into the durable
 * qa-reports/ux/friction-ledger.json (idempotent per runId).
 *
 * Usage:
 *   npx tsx scripts/ux/score-walks.ts --run-dir qa-reports/ux/runs/<runId> \
 *       [--task-models qa-reports/ux/task-models] [--ledger qa-reports/ux/friction-ledger.json]
 *   npx tsx scripts/ux/score-walks.ts --selftest
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

type StepKind = 'activation' | 'fill' | 'scroll' | 'keypress' | 'navigate-entry' | 'escape';
type Transition = 'route-change' | 'modal-open' | 'modal-close' | 'no-visible-change';

interface WalkStep {
  n: number;
  do?: string;
  kind: StepKind;
  selector?: string;
  labelText?: string;
  fpBefore?: string;
  fpAfter?: string;
  /** contracts §2 paneKey — pane-level identity, absent on runs recorded before 2026-07-30. */
  paneKeyBefore?: string;
  paneKeyAfter?: string;
  transition?: Transition;
  scrollDeltaY?: number;
  screenshot?: string;
}

interface WalkObservation {
  atStep: number;
  type: 'jargon' | 'confusion' | 'duplicate-path' | 'dead-end' | 'slow';
  note: string;
}

type SafetyClass = 'emergency' | 'high-alert' | 'routine';
type Viewport = { w: number; h: number };

interface WalkFile {
  schemaVersion: number;
  runId: string;
  persona: string;
  taskId: string;
  goal: string;
  startedAt?: string;
  endedAt?: string;
  outcome: 'COMPLETED' | 'REACHED_THRESHOLD' | 'FAILED_DISCOVERABILITY' | 'FAILED_BLOCKED' | 'SKIPPED_PRECONDITION';
  outcomeNote?: string;
  steps: WalkStep[];
  observations?: WalkObservation[];
  /** contracts §3.3 — all five added by the 2026-07-30 hardening; absent on older runs. */
  viewport?: Viewport;
  arrivedAtStep?: number | null;
  persistenceVerified?: boolean | 'not-applicable' | null;
  routeQuality?: 'normal' | 'degraded';
  routeQualityNote?: string | null;
}

interface TaskModelTask {
  taskId: string;
  goal: string;
  frequencyPerShift: number;
  clickBudget: number;
  budgetSource: string;
  status: string;
  /** contracts §3.2 — absent is READ AS 'routine', so legacy models score unchanged. */
  safetyClass?: SafetyClass;
}

interface FrictionEvent {
  eventId: string;
  type: string;
  atStep: number;
  fp: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  /** true when the §3.5 severity floor raised this event to CRITICAL. */
  floorApplied: boolean;
  evidence: string;
  screenshot: string | null;
}

interface ScreenRow {
  fp: string;
  url: string;
  title: string;
  visibleControls: number;
  smallTargets: number;
  aboveFoldControls: number;
  modalDepth: number;
  enumerateTruncated: boolean;
  screenshot?: string;
  /** contracts §3.4 — added by the 2026-07-30 hardening (P2 + P6); absent on older runs. */
  viewport?: Viewport;
  offViewportControls?: number;
  horizontallyClippedControls?: number;
  contentHeightPx?: number;
  scrollBlocked?: boolean;
  headingCount?: number;
  landmarkCount?: number;
  controlsWithoutAccessibleName?: number;
}

const SEV = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
type Severity = (typeof SEV)[number];

/**
 * contracts §3.5 — events subject to the severity floor. Deliberately EXCLUDES dead-click,
 * jargon, wrong-turn, overload and friends: promoting 19 dead clicks to CRITICAL would
 * relocate the noise instead of removing it.
 */
const PRIMARY_EVENT_TYPES = new Set([
  'blocked',
  'discoverability',
  'over-budget',
  'off-viewport-control',
  'silent-no-op-save',
  'unscrollable-overflow',
]);


function sha12(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 12);
}

function fail(msg: string): never {
  console.error(`score-walks: ${msg}`);
  process.exit(1);
}

function validateWalk(file: string, w: WalkFile): void {
  const req: Array<keyof WalkFile> = ['schemaVersion', 'runId', 'persona', 'taskId', 'goal', 'outcome', 'steps'];
  for (const k of req) {
    if (w[k] === undefined || w[k] === null) fail(`${file}: missing required field "${String(k)}"`);
  }
  w.steps.forEach((s, i) => {
    if (typeof s.n !== 'number' || !s.kind) fail(`${file}: steps[${i}] missing n/kind`);
  });
}

/**
 * contracts §2 — the WITHIN-TASK revisit key: `fp + '#' + paneKey`.
 * `fp` alone collides across in-page pane switchers (one route, one heading, ten panes), which
 * made backtracks inside the nursing cockpit unmeasurable and laundered 21 pane switches into
 * dead clicks. When paneKey is absent (every run before 2026-07-30) the suffix is empty and
 * the key degrades to exactly `fp`, so older runs score byte-identically.
 */
function revisitKey(fp: string | undefined, paneKey: string | undefined): string | undefined {
  if (!fp) return undefined;
  return `${fp}#${paneKey ?? ''}`;
}

/** A step where the pane changed under a stable fp — a real visible change, not a dead click. */
function isPaneChange(s: WalkStep): boolean {
  return Boolean(s.paneKeyBefore && s.paneKeyAfter && s.paneKeyBefore !== s.paneKeyAfter);
}

/** Contracts §3.5 — the frozen metric derivation. */
export function deriveMetrics(
  walk: WalkFile,
  model: TaskModelTask | undefined,
  screensByFp?: Map<string, ScreenRow>
): {
  clicks: number;
  fieldsFilled: number;
  routeChanges: number;
  modalsOpened: number;
  backtracks: number;
  wrongTurns: number;
  deadClicks: number;
  paneChanges: number;
  scrollScreens: number;
  navigationClicks: number | null;
  taskClicks: number | null;
  protocolViolation: boolean;
  budgetDelta: number | null;
  safetyClass: SafetyClass;
  safetyFloorApplied: boolean;
  taskSeverity: Severity | null;
  frictionEvents: FrictionEvent[];
  visitedFps: string[];
} {
  const steps = walk.steps;
  // Reclassification: activation on S immediately followed by fill on same S = form work.
  const reclassified = new Set<number>();
  for (let i = 0; i < steps.length - 1; i++) {
    if (
      steps[i]!.kind === 'activation' &&
      steps[i + 1]!.kind === 'fill' &&
      steps[i]!.selector &&
      steps[i]!.selector === steps[i + 1]!.selector
    ) {
      reclassified.add(i);
    }
  }

  let clicks = 0;
  let fieldsFilled = 0;
  let routeChanges = 0;
  let modalsOpened = 0;
  let backtracks = 0;
  let deadClicks = 0;
  let paneChanges = 0;
  let scrollAbs = 0;
  let protocolViolation = false;
  // P3 — navigation cost vs task cost. Null-safe: no arrivedAtStep ⇒ no split at all.
  const arrivedAtStep = typeof walk.arrivedAtStep === 'number' ? walk.arrivedAtStep : null;
  let navigationClicks = 0;

  const visited = new Set<string>();
  const visitedFps = new Set<string>();
  const backtrackIndices: number[] = [];
  if (steps.length > 0 && steps[0]!.fpBefore && steps[0]!.fpBefore !== '-') {
    visited.add(revisitKey(steps[0]!.fpBefore, steps[0]!.paneKeyBefore) as string);
    visitedFps.add(steps[0]!.fpBefore);
  }

  steps.forEach((s, i) => {
    const isEnterSpace =
      s.kind === 'keypress' && /(^|\b)(enter|space)(\b|$)/i.test(`${s.do ?? ''} ${s.labelText ?? ''}`);
    const paneChanged = isPaneChange(s);
    if (paneChanged) paneChanges += 1;

    if (s.kind === 'navigate-entry' && i > 0) protocolViolation = true;

    if (s.kind === 'activation' && reclassified.has(i)) {
      fieldsFilled += 1; // form work, not a click; cannot be a dead click
    } else if (s.kind === 'activation' || s.kind === 'escape' || isEnterSpace) {
      clicks += 1;
      if (arrivedAtStep !== null && s.n < arrivedAtStep) navigationClicks += 1;
      // A pane switch under a stable fp DID change the screen — never a dead click.
      if (s.kind === 'activation' && s.transition === 'no-visible-change' && !paneChanged) {
        deadClicks += 1;
      }
    } else if (s.kind === 'fill') {
      // A fill without a preceding same-selector activation still filled one field.
      if (!(i > 0 && reclassified.has(i - 1))) fieldsFilled += 1;
    } else if (s.kind === 'scroll') {
      scrollAbs += Math.abs(s.scrollDeltaY ?? 0);
    }

    if (s.transition === 'route-change') routeChanges += 1;
    if (s.transition === 'modal-open') modalsOpened += 1;

    const beforeKey = revisitKey(s.fpBefore, s.paneKeyBefore);
    const afterKey = revisitKey(s.fpAfter, s.paneKeyAfter);
    if (afterKey && afterKey !== beforeKey && visited.has(afterKey)) {
      backtracks += 1;
      backtrackIndices.push(i);
    }
    if (afterKey) visited.add(afterKey);
    if (s.fpAfter) visitedFps.add(s.fpAfter);
  });

  // Wrong turns: backtrack at j to target T; nearest prior step i whose beforeKey == T;
  // wrong turn iff j-i ≤ 4 and no fill (or reclassified-to-fill) strictly between.
  const wrongTurnOrigins: number[] = [];
  for (const j of backtrackIndices) {
    const target = revisitKey(steps[j]!.fpAfter, steps[j]!.paneKeyAfter);
    for (let i = j - 1; i >= 0; i--) {
      if (revisitKey(steps[i]!.fpBefore, steps[i]!.paneKeyBefore) === target) {
        const interior = steps.slice(i + 1, j);
        const hasFill = interior.some((s, k) => s.kind === 'fill' || reclassified.has(i + 1 + k));
        if (j - i <= 4 && !hasFill) wrongTurnOrigins.push(i);
        break;
      }
    }
  }
  const wrongTurns = wrongTurnOrigins.length;

  const scrollScreens = Math.round((scrollAbs / 900) * 10) / 10;
  const measured = walk.outcome === 'COMPLETED' || walk.outcome === 'REACHED_THRESHOLD';
  const budgetDelta = model && measured ? clicks - model.clickBudget : null;
  const taskClicks = arrivedAtStep !== null ? clicks - navigationClicks : null;

  // ---- friction events (contracts §3.5 catalog) ----
  const events: FrictionEvent[] = [];
  const lastStep = steps[steps.length - 1];
  const push = (type: string, atStep: number, sevIdx: number, evidence: string, fp?: string | null, shot?: string | null): void => {
    events.push({
      eventId: sha12(`${walk.taskId}|${atStep}|${type}`),
      type,
      atStep,
      fp: fp ?? null,
      severity: SEV[Math.min(3, Math.max(0, sevIdx))]!,
      floorApplied: false,
      evidence,
      screenshot: shot ?? null,
    });
  };

  const freq = model?.frequencyPerShift ?? 1;
  if (budgetDelta !== null && budgetDelta > 0) {
    const sevIdx = Math.min(4, Math.ceil((budgetDelta * freq) / 25)) - 1;
    push('over-budget', lastStep?.n ?? 0, sevIdx, `clicks ${clicks} vs budget ${model?.clickBudget} (${model?.budgetSource}); ×${freq}/shift`, lastStep?.fpAfter);
  }
  if (walk.outcome === 'FAILED_DISCOVERABILITY') {
    push('discoverability', lastStep?.n ?? 0, freq >= 5 ? 3 : 2, `could not find the pathway: ${walk.outcomeNote ?? 'no note'}`, lastStep?.fpAfter);
  }
  // P1 — before this existed, FAILED_BLOCKED emitted NOTHING, so a pathway that dead-ends
  // carried no severity signal at all and ranked below every slow-but-working form.
  if (walk.outcome === 'FAILED_BLOCKED') {
    push('blocked', lastStep?.n ?? 0, 2, `pathway dead-ends before the goal: ${walk.outcomeNote ?? 'no note'}`, lastStep?.fpAfter, lastStep?.screenshot);
  }
  // P5 — a save that fails while LOOKING like success is worse than one that errors.
  if (walk.persistenceVerified === false) {
    push('silent-no-op-save', lastStep?.n ?? 0, 2, `submitted, but re-reading the surface shows the record was never written`, lastStep?.fpAfter, lastStep?.screenshot);
  }
  backtrackIndices.forEach((j, idx) => {
    if (idx === 0 && backtrackIndices.length >= 2) {
      push('backtrack-cluster', steps[j]!.n, 1, `${backtrackIndices.length} backtracks in one task`, steps[j]!.fpAfter);
    }
  });
  for (const i of wrongTurnOrigins) {
    push('wrong-turn', steps[i]!.n, 1, `entered "${steps[i]!.labelText ?? steps[i]!.selector ?? '?'}" then backed out with nothing filled`, steps[i]!.fpAfter, steps[i]!.screenshot);
  }
  steps.forEach((s, i) => {
    if (s.kind === 'activation' && !reclassified.has(i) && s.transition === 'no-visible-change' && !isPaneChange(s)) {
      push('dead-click', s.n, 0, `click on "${s.labelText ?? s.selector ?? '?'}" changed nothing visible`, s.fpAfter, s.screenshot);
    }
  });
  if (fieldsFilled >= 12) {
    push('form-burden', lastStep?.n ?? 0, 2, `${fieldsFilled} fields filled in one task`, lastStep?.fpAfter);
  }
  for (const o of walk.observations ?? []) {
    if (o.type === 'jargon' || o.type === 'duplicate-path') {
      push(o.type, o.atStep, 1, o.note);
    }
  }

  // ---- screen-derived events (one per VISITED fingerprint, deduped by fp per task) ----
  // The scorer owns every threshold; the walker only records the raw probe numbers.
  const pushScreen = (type: string, sevIdx: number, sc: ScreenRow, evidence: string): void => {
    events.push({
      eventId: sha12(`${walk.taskId}|0|${type}|${sc.fp}`),
      type,
      atStep: 0,
      fp: sc.fp,
      severity: SEV[Math.min(3, Math.max(0, sevIdx))]!,
      floorApplied: false,
      evidence,
      screenshot: sc.screenshot ?? null,
    });
  };
  for (const fp of visitedFps) {
    const sc = screensByFp?.get(fp);
    if (!sc) continue;
    if (sc.visibleControls > 60) {
      pushScreen('overload', 1, sc, `screen "${sc.title}" shows ${sc.visibleControls} interactive controls (${sc.url})`);
    }
    // P2 — HORIZONTAL clipping only. Vertical off-viewport is normal on any scrolling page;
    // firing on it would drown the real finding (an emergency control 309px past the edge).
    if ((sc.horizontallyClippedControls ?? 0) > 0) {
      pushScreen('off-viewport-control', 2, sc,
        `${sc.horizontallyClippedControls} control(s) render entirely outside the ${sc.viewport?.w ?? '?'}px-wide viewport on "${sc.title}" — unreachable by mouse (${sc.url})`);
    }
    // P6 — content exists below the fold and cannot be scrolled to.
    if (sc.scrollBlocked === true) {
      pushScreen('unscrollable-overflow', 2, sc,
        `"${sc.title}" stacks content to ${sc.contentHeightPx ?? '?'}px but does not scroll (${sc.url})`);
    }
    // P6 — one heading for a control-dense surface: assistive tech cannot announce it, and it
    // is the same root cause that makes the §2 fingerprint go blind across panes.
    if (((sc.headingCount ?? 99) <= 1 && sc.visibleControls >= 20) || sc.landmarkCount === 0) {
      pushScreen('no-document-structure', 1, sc,
        `"${sc.title}" exposes ${sc.headingCount ?? '?'} heading(s) and ${sc.landmarkCount ?? '?'} landmark(s) across ${sc.visibleControls} controls (${sc.url})`);
    }
  }

  // ---- severity floor (contracts §3.5) — danger is not a frequency question ----
  const safetyClass: SafetyClass = model?.safetyClass ?? 'routine';
  const floorTriggered =
    safetyClass !== 'routine' &&
    (walk.outcome.startsWith('FAILED_') || walk.routeQuality === 'degraded');
  if (floorTriggered) {
    for (const e of events) {
      if (PRIMARY_EVENT_TYPES.has(e.type)) {
        e.severity = 'CRITICAL';
        e.floorApplied = true;
      }
    }
  }
  const taskSeverity =
    events.length === 0
      ? null
      : SEV[Math.max(...events.map((e) => SEV.indexOf(e.severity)))]!;

  return {
    clicks, fieldsFilled, routeChanges, modalsOpened, backtracks, wrongTurns, deadClicks,
    paneChanges, scrollScreens, navigationClicks: arrivedAtStep !== null ? navigationClicks : null,
    taskClicks, protocolViolation, budgetDelta,
    safetyClass, safetyFloorApplied: floorTriggered, taskSeverity,
    frictionEvents: events,
    visitedFps: [...visitedFps],
  };
}

// ------------------------------------------------------------------ selftest
/** Compares a derived result against expectations; returns the failure lines. */
function checkFixture(
  name: string,
  got: Record<string, unknown>,
  expect: Array<[string, unknown]>
): string[] {
  return expect
    .filter(([k, v]) => got[k] !== v)
    .map(([k, v]) => `selftest FAILED [${name}]: ${k} expected ${String(v)}, got ${String(got[k])}`);
}

/**
 * Fixture 1 (contracts §5) is FROZEN: it is the regression contract for every metric that
 * existed before the 2026-07-30 hardening. Its expected numbers may never be edited to
 * accommodate a change — if a change moves them, the change is wrong.
 */
function selftestLegacy(): string[] {
  const fixture: WalkFile = {
    schemaVersion: 1, runId: 'selftest', persona: 'physician', taskId: 'fixture00tsk',
    goal: 'fixture', outcome: 'COMPLETED',
    steps: [
      { n: 1, kind: 'navigate-entry', fpBefore: '-', fpAfter: 'A', transition: 'route-change' },
      { n: 2, kind: 'activation', selector: '#nav-x', fpBefore: 'A', fpAfter: 'B', transition: 'route-change' },
      { n: 3, kind: 'activation', selector: '#back', fpBefore: 'B', fpAfter: 'A', transition: 'route-change' },
      { n: 4, kind: 'activation', selector: '#field1', fpBefore: 'A', fpAfter: 'A', transition: 'no-visible-change' },
      { n: 5, kind: 'fill', selector: '#field1', fpBefore: 'A', fpAfter: 'A' },
      { n: 6, kind: 'scroll', fpBefore: 'A', fpAfter: 'A', scrollDeltaY: 450 },
      { n: 7, kind: 'keypress', do: 'press Tab', fpBefore: 'A', fpAfter: 'A' },
      { n: 8, kind: 'scroll', fpBefore: 'A', fpAfter: 'A', scrollDeltaY: 900 },
    ],
  };
  const model: TaskModelTask = {
    taskId: 'fixture00tsk', goal: 'fixture', frequencyPerShift: 10, clickBudget: 2,
    budgetSource: 'class-default', status: 'active',
  };
  const m = deriveMetrics(fixture, model);
  const failures = checkFixture('legacy', {
    clicks: m.clicks, backtracks: m.backtracks, wrongTurns: m.wrongTurns,
    fieldsFilled: m.fieldsFilled, deadClicks: m.deadClicks, paneChanges: m.paneChanges,
    scrollScreens: m.scrollScreens, protocolViolation: m.protocolViolation,
    budgetDelta: m.budgetDelta, navigationClicks: m.navigationClicks, taskClicks: m.taskClicks,
    safetyClass: m.safetyClass, safetyFloorApplied: m.safetyFloorApplied,
    overBudgetEvents: m.frictionEvents.filter((e) => e.type === 'over-budget').length,
  }, [
    ['clicks', 2], ['backtracks', 1], ['wrongTurns', 1], ['fieldsFilled', 1],
    ['deadClicks', 0], ['paneChanges', 0], ['scrollScreens', 1.5], ['protocolViolation', false],
    ['budgetDelta', 0], ['navigationClicks', null], ['taskClicks', null],
    ['safetyClass', 'routine'], ['safetyFloorApplied', false], ['overBudgetEvents', 0],
  ]);
  if (failures.length === 0) {
    console.log('selftest[1/2] legacy PASSED: 2 clicks / 1 backtrack / 1 wrong turn / 1 fieldFilled / 0 dead / 1.5 scrollScreens / budgetDelta 0 / no new-field leakage');
  }
  return failures;
}

/**
 * Fixture 2 (contracts §5) — every metric added by the 2026-07-30 hardening (P1-P6).
 * A high-alert task that dead-ends inside a pane switcher on a clipped, unscrollable,
 * structureless screen: the exact shape the nursing run could not score.
 */
function selftestHardened(): string[] {
  const fixture: WalkFile = {
    schemaVersion: 1, runId: 'selftest', persona: 'rn', taskId: 'fixture01hard',
    goal: 'fixture-hardened', outcome: 'FAILED_BLOCKED',
    outcomeNote: 'sign did nothing and removed the field that enables it',
    viewport: { w: 1280, h: 720 },
    arrivedAtStep: 3,
    persistenceVerified: false,
    routeQuality: 'degraded',
    routeQualityNote: 'reached the control only after 11 Tab presses; wheel and drag moved the strip 0px',
    steps: [
      { n: 1, kind: 'navigate-entry', fpBefore: '-', fpAfter: 'A', paneKeyAfter: 'p1', transition: 'route-change' },
      { n: 2, kind: 'activation', selector: '#nav', fpBefore: 'A', fpAfter: 'A', paneKeyBefore: 'p1', paneKeyAfter: 'p2', transition: 'no-visible-change' },
      { n: 3, kind: 'activation', selector: '#tab', fpBefore: 'A', fpAfter: 'A', paneKeyBefore: 'p2', paneKeyAfter: 'p3', transition: 'no-visible-change' },
      { n: 4, kind: 'activation', selector: '#back', fpBefore: 'A', fpAfter: 'A', paneKeyBefore: 'p3', paneKeyAfter: 'p2', transition: 'no-visible-change' },
      { n: 5, kind: 'activation', selector: '#dead', fpBefore: 'A', fpAfter: 'A', paneKeyBefore: 'p2', paneKeyAfter: 'p2', transition: 'no-visible-change' },
    ],
  };
  const model: TaskModelTask = {
    taskId: 'fixture01hard', goal: 'fixture-hardened', frequencyPerShift: 1, clickBudget: 4,
    budgetSource: 'class-default', status: 'active', safetyClass: 'high-alert',
  };
  const screens = new Map<string, ScreenRow>([['A', {
    fp: 'A', url: '/emr/x', title: 'Cockpit', visibleControls: 40, smallTargets: 0,
    aboveFoldControls: 20, modalDepth: 4, enumerateTruncated: false,
    viewport: { w: 1280, h: 720 },
    offViewportControls: 4, horizontallyClippedControls: 1,
    contentHeightPx: 16575, scrollBlocked: true, headingCount: 1, landmarkCount: 0,
    controlsWithoutAccessibleName: 12,
  }]]);

  const m = deriveMetrics(fixture, model, screens);
  const sevOf = (type: string): string =>
    m.frictionEvents.filter((e) => e.type === type).map((e) => `${e.severity}${e.floorApplied ? '+floor' : ''}`).join(',') || 'none';
  const failures = checkFixture('hardened', {
    clicks: m.clicks, paneChanges: m.paneChanges, deadClicks: m.deadClicks,
    backtracks: m.backtracks, wrongTurns: m.wrongTurns,
    navigationClicks: m.navigationClicks, taskClicks: m.taskClicks,
    budgetDelta: m.budgetDelta, safetyClass: m.safetyClass,
    safetyFloorApplied: m.safetyFloorApplied, taskSeverity: m.taskSeverity,
    blocked: sevOf('blocked'),
    silentSave: sevOf('silent-no-op-save'),
    offViewport: sevOf('off-viewport-control'),
    unscrollable: sevOf('unscrollable-overflow'),
    noStructure: sevOf('no-document-structure'),
    deadClickSev: sevOf('dead-click'),
    overload: sevOf('overload'),
  }, [
    ['clicks', 4], ['paneChanges', 3], ['deadClicks', 1],
    ['backtracks', 1], ['wrongTurns', 1],
    ['navigationClicks', 1], ['taskClicks', 3],
    ['budgetDelta', null], ['safetyClass', 'high-alert'],
    ['safetyFloorApplied', true], ['taskSeverity', 'CRITICAL'],
    // primary events floored to CRITICAL …
    ['blocked', 'CRITICAL+floor'], ['silentSave', 'CRITICAL+floor'],
    ['offViewport', 'CRITICAL+floor'], ['unscrollable', 'CRITICAL+floor'],
    // … incidental ones deliberately NOT promoted
    ['noStructure', 'MEDIUM'], ['deadClickSev', 'LOW'],
    // 40 controls is under the overload threshold — must stay silent
    ['overload', 'none'],
  ]);
  if (failures.length === 0) {
    console.log('selftest[2/2] hardened PASSED: 4 clicks (1 nav / 3 task) / 3 paneChanges / 1 dead / 1 backtrack across panes / floor → 4 CRITICAL primaries, incidentals untouched');
  }
  return failures;
}

function selftest(): void {
  const failures = [...selftestLegacy(), ...selftestHardened()];
  if (failures.length > 0) {
    for (const f of failures) console.error(f);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------- main
function main(): void {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) {
    selftest();
    return;
  }
  const argOf = (flag: string, dflt: string): string => {
    const i = args.indexOf(flag);
    return i >= 0 ? resolve(REPO_ROOT, args[i + 1]!) : resolve(REPO_ROOT, dflt);
  };
  const runDir = argOf('--run-dir', '');
  if (!runDir || !existsSync(runDir)) fail(`--run-dir missing or not found: ${runDir}`);
  const modelsDir = argOf('--task-models', 'qa-reports/ux/task-models');
  const ledgerPath = argOf('--ledger', 'qa-reports/ux/friction-ledger.json');
  const runId = basename(runDir);
  const scope = runId.split('-').slice(3).join('-') || runId;

  // Task models: taskId → model
  const models = new Map<string, TaskModelTask & { persona: string }>();
  if (existsSync(modelsDir)) {
    for (const f of readdirSync(modelsDir).filter((f) => f.endsWith('.task-model.json'))) {
      const doc = JSON.parse(readFileSync(join(modelsDir, f), 'utf8')) as {
        persona: string; tasks: TaskModelTask[];
      };
      for (const t of doc.tasks) models.set(t.taskId, { ...t, persona: doc.persona });
    }
  }

  // Walk files + screens
  const walksRoot = join(runDir, 'walks');
  if (!existsSync(walksRoot)) fail(`no walks/ dir under ${runDir}`);
  const personas = readdirSync(walksRoot).filter((p) => statSync(join(walksRoot, p)).isDirectory());
  const tasks: Array<Record<string, unknown>> = [];
  const screensByFp = new Map<string, ScreenRow>();

  for (const persona of personas) {
    const pdir = join(walksRoot, persona);
    for (const f of readdirSync(pdir).filter((f) => f.startsWith('screens-') && f.endsWith('.json'))) {
      const doc = JSON.parse(readFileSync(join(pdir, f), 'utf8')) as { screens: ScreenRow[] };
      for (const s of doc.screens ?? []) {
        const prev = screensByFp.get(s.fp);
        if (!prev || s.visibleControls > prev.visibleControls) screensByFp.set(s.fp, s);
      }
    }
    const tdir = join(pdir, 'tasks');
    if (!existsSync(tdir)) continue;
    for (const f of readdirSync(tdir).filter((f) => f.endsWith('.json'))) {
      const walk = JSON.parse(readFileSync(join(tdir, f), 'utf8')) as WalkFile;
      validateWalk(join('walks', persona, 'tasks', f), walk);
      const model = models.get(walk.taskId);
      if (!model) console.warn(`warn: ${walk.taskId} not in any task model — budget metrics null`);
      // screensByFp is passed by reference: the scorer resolves every screen-derived event
      // (overload + the P2/P6 probes) inside deriveMetrics so one function owns all thresholds.
      const m = deriveMetrics(walk, model, screensByFp);

      const durationMs =
        walk.startedAt && walk.endedAt ? Date.parse(walk.endedAt) - Date.parse(walk.startedAt) : null;
      tasks.push({
        taskId: walk.taskId, persona: walk.persona, goal: walk.goal, outcome: walk.outcome,
        protocolViolation: m.protocolViolation,
        clicks: m.clicks, fieldsFilled: m.fieldsFilled, routeChanges: m.routeChanges,
        modalsOpened: m.modalsOpened, backtracks: m.backtracks, wrongTurns: m.wrongTurns,
        deadClicks: m.deadClicks, paneChanges: m.paneChanges, scrollScreens: m.scrollScreens,
        durationMs,
        arrivedAtStep: walk.arrivedAtStep ?? null,
        navigationClicks: m.navigationClicks, taskClicks: m.taskClicks,
        budget: model?.clickBudget ?? null, budgetSource: model?.budgetSource ?? null,
        budgetDelta: m.budgetDelta, frequencyPerShift: model?.frequencyPerShift ?? null,
        perShiftClickCost: model ? m.clicks * model.frequencyPerShift : null,
        safetyClass: m.safetyClass, taskSeverity: m.taskSeverity,
        safetyFloorApplied: m.safetyFloorApplied,
        persistenceVerified: walk.persistenceVerified ?? null,
        routeQuality: walk.routeQuality ?? null,
        viewport: walk.viewport ?? null,
        frictionEvents: m.frictionEvents,
      });
    }
  }
  if (tasks.length === 0) fail('no walk task files found — nothing to score');

  const measured = tasks.filter((t) => t.outcome === 'COMPLETED' || t.outcome === 'REACHED_THRESHOLD');
  const scoreboard = {
    schemaVersion: 1, runId, scope, personas,
    tasks,
    totals: {
      measuredClicksPerShift: measured.reduce((a, t) => a + ((t.perShiftClickCost as number) ?? 0), 0),
      budgetedClicksPerShift: measured.reduce(
        (a, t) => a + (((t.budget as number) ?? 0) * ((t.frequencyPerShift as number) ?? 0)), 0),
      tasksOverBudget: tasks.filter((t) => ((t.budgetDelta as number) ?? 0) > 0).length,
      failedDiscoverability: tasks.filter((t) => t.outcome === 'FAILED_DISCOVERABILITY').length,
      failedBlocked: tasks.filter((t) => t.outcome === 'FAILED_BLOCKED').length,
      tasksWalked: tasks.length,
      protocolViolations: tasks.filter((t) => t.protocolViolation === true).length,
      criticalTasks: tasks.filter((t) => t.taskSeverity === 'CRITICAL').length,
      safetyFloorApplied: tasks.filter((t) => t.safetyFloorApplied === true).length,
      silentNoOpSaves: tasks.filter((t) => t.persistenceVerified === false).length,
      // A walker that skipped the P5 persistence probe must be VISIBLE, not silent.
      persistenceNotRecorded: tasks.filter((t) => t.persistenceVerified === null).length,
    },
    worstScreens: [...screensByFp.values()]
      .sort((a, b) => b.visibleControls - a.visibleControls)
      .slice(0, 10),
  };
  writeFileSync(join(runDir, 'scoreboard.json'), JSON.stringify(scoreboard, null, 2));

  // ---- ledger append (idempotent per runId; protocol violations excluded) ----
  interface LedgerHistoryRow { runId: string; date: string; clicks: number; outcome: string; backtracks: number }
  interface LedgerEntry { taskId: string; persona: string; goal: string; budget: number | null; history: LedgerHistoryRow[]; trend: string }
  interface Ledger { schemaVersion: number; entries: LedgerEntry[]; planItems: unknown[] }
  const ledger: Ledger = existsSync(ledgerPath)
    ? (JSON.parse(readFileSync(ledgerPath, 'utf8')) as Ledger)
    : { schemaVersion: 1, entries: [], planItems: [] };
  const today = new Date().toISOString().slice(0, 10);
  for (const t of tasks) {
    if (t.protocolViolation === true) continue; // cheated walks never enter trending
    let entry = ledger.entries.find((e) => e.taskId === t.taskId);
    if (!entry) {
      entry = { taskId: t.taskId as string, persona: t.persona as string, goal: t.goal as string, budget: t.budget as number | null, history: [], trend: 'flat' };
      ledger.entries.push(entry);
    }
    entry.history = entry.history.filter((h) => h.runId !== runId);
    entry.history.push({ runId, date: today, clicks: t.clicks as number, outcome: t.outcome as string, backtracks: t.backtracks as number });
    const done = entry.history.filter((h) => h.outcome === 'COMPLETED' || h.outcome === 'REACHED_THRESHOLD');
    entry.trend =
      done.length < 2 ? 'flat'
      : done[done.length - 1]!.clicks < done[done.length - 2]!.clicks ? 'improving'
      : done[done.length - 1]!.clicks > done[done.length - 2]!.clicks ? 'regressed'
      : 'flat';
  }
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));

  console.log(
    `scoreboard: ${tasks.length} tasks (${scoreboard.totals.tasksOverBudget} over budget, ` +
    `${scoreboard.totals.failedDiscoverability} discoverability failures, ` +
    `${scoreboard.totals.failedBlocked} blocked, ` +
    `${scoreboard.totals.protocolViolations} protocol violations) — ` +
    `measured ${scoreboard.totals.measuredClicksPerShift} vs budgeted ${scoreboard.totals.budgetedClicksPerShift} clicks/shift. ` +
    `Safety: ${scoreboard.totals.criticalTasks} CRITICAL tasks, ` +
    `${scoreboard.totals.safetyFloorApplied} severity-floored, ` +
    `${scoreboard.totals.silentNoOpSaves} silent no-op saves ` +
    `(${scoreboard.totals.persistenceNotRecorded} walks did not record persistence). ` +
    `Ledger: ${ledger.entries.length} tracked tasks.`
  );
}

main();
