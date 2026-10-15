import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { Container } from 'pixi.js';
import { buildPlan } from './lornwatch/plan.mjs';
import { previewCampaignId, emptySnapshot } from './lornwatch/preview.mjs';

const source = readFileSync(new URL('../src/domain/tokenSerialization.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { asToken } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const legacy = { id: 'npc', scene_id: 'square', type: 'NPC', display_name: 'Jory Reed', x: 120, y: 200, size: 1 };

test('legacy tokens without database defaults deserialize to finite render transforms', () => {
  const token = asToken(legacy);
  assert.equal(token.rotation, 0);
  assert.equal(token.visible, true);
  assert.equal(token.locked, false);
  assert.deepEqual(token.conditions, []);
  assert.equal(token.ownerUserId, null);
  assert.equal(token.imageUrl, null);
  assert.equal(token.imagePath, null);
});

test('malformed transforms cannot make a Pixi token disappear; authored values survive', () => {
  for (const bad of [undefined, null, '', 'broken', NaN, Infinity, -Infinity]) {
    const token = asToken({ ...legacy, rotation: bad, x: bad, y: bad });
    assert.deepEqual([token.rotation, token.x, token.y], [0, 0, 0]);
  }
  for (const bad of [undefined, null, '', 'broken', NaN, Infinity, 0, -2]) assert.equal(asToken({ ...legacy, size: bad }).size, 1);
  const authored = asToken({ ...legacy, x: '12.5', y: -44, size: 2, rotation: '1.25', visible: false, locked: true, conditions: ['Prone', null, 3] });
  assert.deepEqual([authored.x, authored.y, authored.size, authored.rotation], [12.5, -44, 2, 1.25]);
  assert.equal(authored.visible, false);
  assert.equal(authored.locked, true);
  assert.deepEqual(authored.conditions, ['Prone']);
});

test('every Lornwatch scene has NPC/monster tokens with explicit defaults and invertible Pixi transforms', () => {
  const chapter = readFileSync(new URL('../docs/campaign/chapters/LORNWATCH.md', import.meta.url), 'utf8');
  const sheet = readFileSync(new URL('../docs/campaign/chapters/LORNWATCH_RUN_SHEET.md', import.meta.url), 'utf8');
  const db = buildPlan(emptySnapshot(), previewCampaignId, {}, chapter, sheet).after;
  assert.equal(db.scenes.length, 10);
  assert.equal(db.tokens.length, 56);
  for (const scene of db.scenes) {
    const rows = db.tokens.filter(row => row.scene_id === scene.id);
    assert.ok(rows.length, scene.name);
    for (const row of rows) {
      assert.equal(row.rotation, 0, row.display_name);
      assert.deepEqual(row.conditions, []);
      assert.equal(row.owner_user_id, null);
      const token = asToken(row);
      const container = new Container();
      container.position.set(token.x, token.y);
      container.scale.set(token.size);
      container.rotation = token.rotation;
      const point = container.toGlobal({ x: 10, y: 20 });
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), `${scene.name}: ${token.displayName}`);
      const back = container.toLocal(point);
      assert.ok(Math.abs(back.x - 10) < 1e-6 && Math.abs(back.y - 20) < 1e-6);
      assert.equal(token.visible, row.visible); // Hidden encounter actors stay hidden.
      container.destroy();
    }
  }
  assert.ok(db.tokens.some(token => token.type === 'NPC'));
  assert.ok(db.tokens.some(token => token.type === 'MONSTER'));
});
