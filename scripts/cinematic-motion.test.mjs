import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/domain/cinematicMotion.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { shouldReduceCinematicMotion, getCinematicMotionPreference, setCinematicMotionPreference, subscribeCinematicMotion, prefersReducedCinematicMotion } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('default follows browser preference; full rotation requires explicit opt-in', () => {
  assert.equal(shouldReduceCinematicMotion('SYSTEM', true), true);
  assert.equal(shouldReduceCinematicMotion('SYSTEM', false), false);
  assert.equal(shouldReduceCinematicMotion('FULL', true), false);
  assert.equal(shouldReduceCinematicMotion('FULL', false), false);
  assert.equal(shouldReduceCinematicMotion('REDUCED', false), true);
  assert.equal(shouldReduceCinematicMotion('REDUCED', true), true);
});

test('local motion preference persists, notifies subscribers, and works without storage', () => {
  const original = globalThis.window;
  const events = new EventTarget();
  const storage = new Map();
  globalThis.window = Object.assign(events, {
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    matchMedia: () => ({ matches: true }),
  });
  try {
    assert.equal(getCinematicMotionPreference(), 'SYSTEM');
    assert.equal(prefersReducedCinematicMotion(), true);
    let changes = 0;
    const cleanup = subscribeCinematicMotion(() => changes++);
    setCinematicMotionPreference('FULL');
    assert.equal(changes, 1);
    assert.equal(storage.get('wayfinder:cinematic-motion:v1'), 'FULL');
    assert.equal(prefersReducedCinematicMotion(), false);
    storage.set('wayfinder:cinematic-motion:v1', 'REDUCED');
    window.dispatchEvent(new Event('storage'));
    assert.equal(changes, 2);
    assert.equal(prefersReducedCinematicMotion(), true);
    storage.clear();
    assert.equal(getCinematicMotionPreference(), 'SYSTEM');
    assert.equal(prefersReducedCinematicMotion(), true);
    storage.set('wayfinder:cinematic-motion:v1', 'invalid');
    assert.equal(getCinematicMotionPreference(), 'SYSTEM');
    cleanup();
    window.localStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    setCinematicMotionPreference('FULL');
    assert.equal(getCinematicMotionPreference(), 'FULL');
    assert.equal(prefersReducedCinematicMotion(), false);
    assert.equal(changes, 2);
    setCinematicMotionPreference('SYSTEM');
    assert.equal(prefersReducedCinematicMotion(), true);
  } finally {
    if (original === undefined) delete globalThis.window;
    else globalThis.window = original;
  }
});
