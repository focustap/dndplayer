import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const source = readFileSync(new URL('../src/domain/dealerCards.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { DEALER_CARDS, newDealerDeck, reduceDealerDeck: change, assertDealerDeck } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const holders = n => Array.from({length:n},(_,i)=>({id:`holder-${i}`,name:i?'Hero '+i:'The Dealer',ownerId:i?'player-'+i:null,tokenId:null}));
const research = d => change(d,{type:'charges',charges:{read:2,objection:2,burn:1,cut:1}});
const finishPairs = d => { while(d.stage==='dealing') d=change(d,d.pending?{type:'choose',index:0}:{type:'next-pair'}); return d; };

test('all 12 exact canonical effects match the chapter; no invented rules',()=>{
 const chapter=readFileSync(new URL('../docs/campaign/chapters/VEYRHOLT.md',import.meta.url),'utf8');
 for(const card of DEALER_CARDS) assert.ok(chapter.includes(`| ${card.name} | ${card.rule} |`),card.name);
 assert.equal(DEALER_CARDS.length,12);
});
test('random phase one draws without replacement, includes Dealer, and never mutates inputs',()=>{
 const permutations=new Set();
 for(let i=0;i<40;i++){
  const before=newDealerDeck(),copy=structuredClone(before),d=change(before,{type:'deal',holders:holders(12)});
  assert.deepEqual(before,copy);assert.equal(new Set(Object.values(d.active).map(a=>a.card)).size,12);
  assert.equal(d.draw.length,0);assert.equal(d.discard.length,0);assert.ok(d.active['holder-0']);
  permutations.add(Object.values(d.active).map(a=>a.card).join(','));
 }
 assert.ok(permutations.size>1);
});
test('expiration returns cards, clears active state, and only exhaustion reshuffles discard',()=>{
 let d=change(newDealerDeck(),{type:'deal',holders:holders(5)});const next=d.draw.slice(0,5);
 d=change(d,{type:'expire'});assert.equal(d.round,2);assert.equal(Object.keys(d.active).length,0);assert.equal(d.discard.length,5);
 d=change(d,{type:'deal',holders:holders(5)});assert.deepEqual(Object.values(d.active).map(a=>a.card),next);
 d=change(d,{type:'expire'});d=change(d,{type:'deal',holders:holders(5)});assertDealerDeck(d);
 assert.equal(d.discard.length,0);assert.equal(d.draw.length,7);
});
test('13 holders get one neutral blank and held cards never refill the draw pile',()=>{
 let d=change(research(newDealerDeck()),{type:'deal',holders:holders(13)});
 assert.equal(Object.values(d.active).filter(a=>a.card==='blank').length,1);
 const rejected=d.active['holder-0'].card;
 d=change(d,{type:'objection',holderId:'holder-0'});
 assert.equal(d.active['holder-0'].card,'blank');assert.deepEqual(d.discard,[rejected]);
 assertDealerDeck(d);
});
test('Read the Back reserves the exact next two even across exhaustion, with persistence',()=>{
 let d=research(newDealerDeck());d.discard=d.draw.splice(1);
 const first=d.draw[0];d=change(d,{type:'read'});assert.equal(d.preview[0],first);assert.equal(d.preview.length,2);
 d=change(d,{type:'reverse'});const expected=[...d.preview];
 d=JSON.parse(JSON.stringify(d));d=change(d,{type:'finish-read'});d=change(d,{type:'deal',holders:holders(2)});
 assert.deepEqual(Object.values(d.active).map(a=>a.card),expected);assert.equal(d.charges.read,1);assertDealerDeck(d);
});
test('Burn removes a named available card permanently, including across multiple reshuffles',()=>{
 let d=research(newDealerDeck());d=change(d,{type:'burn',card:'saint'});
 for(let i=0;i<15;i++){d=change(d,{type:'deal',holders:holders(5)});assert.ok(Object.values(d.active).every(a=>a.card!=='saint'));d=change(d,{type:'expire'});assertDealerDeck(d);}
 assert.deepEqual(d.burned,['saint']);
});
test('Phase Two waits until next round; pairs reserve cards and Cut allows holder selection',()=>{
 let d=research(change(newDealerDeck(),{type:'deal',holders:holders(5)}));const old=structuredClone(d.active);
 d=change(d,{type:'phase-two'});assert.equal(d.phase,1);assert.deepEqual(d.active,old);
 d=change(d,{type:'expire'});d=change(d,{type:'deal',holders:holders(5)});assert.equal(d.phase,2);assert.equal(d.pending.holder.name,'The Dealer');
 const pair=[...d.pending.cards];d=change(d,{type:'cut'});assert.equal(d.pending.cut,true);
 d=change(d,{type:'choose',index:1});assert.equal(d.active['holder-0'].card,pair[1]);assert.ok(d.discard.includes(pair[0]));
 assert.throws(()=>change(d,{type:'objection',holderId:'holder-0'}),/one intervention/);
 d=finishPairs(d);assert.equal(Object.keys(d.active).length,5);assertDealerDeck(d);
});
test('Objection discards the old card and replacement must be kept; two-per-round cap',()=>{
 let d=change(research(newDealerDeck()),{type:'deal',holders:holders(5)});const next=d.draw[0],old=d.active['holder-1'].card;
 d=change(d,{type:'objection',holderId:'holder-1'});assert.equal(d.active['holder-1'].card,next);assert.ok(d.discard.includes(old));
 assert.throws(()=>change(d,{type:'objection',holderId:'holder-1'}),/one intervention/);
 d=change(d,{type:'objection',holderId:'holder-2'});assert.equal(d.interventions,2);
 d=research(d);assert.throws(()=>change(d,{type:'objection',holderId:'holder-3'}),/two interventions/);
});
test('phase two handles 20 holders, blank pairs and repeated rounds without duplicates',()=>{
 let d=change(newDealerDeck(),{type:'phase-two'});
 for(let i=0;i<8;i++){d=finishPairs(change(d,{type:'deal',holders:holders(20)}));assertDealerDeck(d);assert.equal(Object.keys(d.active).length,20);d=change(d,{type:'expire'});}
});
test('clear/replay/new entrant and reset touch card state only',()=>{
 let d=change(newDealerDeck(),{type:'deal',holders:holders(2)});const order=[...d.draw];
 d=change(d,{type:'replay',holderId:'holder-0'});assert.deepEqual(d.draw,order);
 d=change(d,{type:'clear',holderId:'holder-1'});assert.ok(!d.active['holder-1']);
 d=change(d,{type:'entrant',holder:holders(3)[2]});assert.ok(d.active['holder-2']);
 d=change(d,{type:'reset',round:4});assert.equal(d.round,4);assert.equal(d.draw.length,12);assert.equal(d.phase,1);assert.equal(Object.keys(d.active).length,0);
 assert.doesNotMatch(source,/currentHp|maxHp|tempHp|conditions:|set_character|monster_instances|advance_turn/);
});
