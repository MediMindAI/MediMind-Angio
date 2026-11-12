import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { buildTaskFile, classifyTransition, computeFp, computePaneKey } from './walk-recorder.mjs';

const sha1 = (s) => createHash('sha1').update(s).digest('hex');

test('fp follows contracts §2: url | headings | raw shell count, 16 hex', () => {
  assert.equal(computeFp({ u: '/emr/home', h: 'a|b', m: 4 }), sha1('/emr/home|a|b|4').slice(0, 16));
});

test('paneKey sorts testids and hashes the empty set too', () => {
  assert.equal(computePaneKey(['b', 'a']), sha1('a|b').slice(0, 12));
  assert.equal(computePaneKey([]), sha1('').slice(0, 12));
});

test('transition precedence: route, then open dialogs, else nothing', () => {
  assert.equal(classifyTransition({ u: '/a', open: 0 }, { u: '/b', open: 1 }), 'route-change');
  assert.equal(classifyTransition({ u: '/a', open: 0 }, { u: '/a', open: 1 }), 'modal-open');
  assert.equal(classifyTransition({ u: '/a', open: 1 }, { u: '/a', open: 0 }), 'modal-close');
  assert.equal(classifyTransition({ u: '/a', open: 0 }, { u: '/a', open: 0 }), 'no-visible-change');
});

test('task file carries every §3.3 field and marks a degraded route', () => {
  const f = buildTaskFile({ runId: 'r', persona: 'p', taskId: 't', goal: 'g', startedAt: 's', outcome: 'COMPLETED',
    steps: [], observations: [], routeQualityNote: 'keyboard only' }, 'e');
  for (const k of ['schemaVersion', 'viewport', 'arrivedAtStep', 'persistenceVerified', 'routeQuality', 'steps', 'observations', 'timeToUsableSec']) {
    assert.ok(k in f, k);
  }
  assert.equal(f.routeQuality, 'degraded');
  assert.equal(f.persistenceVerified, 'not-applicable');
});
