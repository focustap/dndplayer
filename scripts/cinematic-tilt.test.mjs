import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { Container } from 'pixi.js';
const source=readFileSync(new URL('../src/domain/cinematicTilt.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {resolveTurnDirection,mapTiltFrame,cinematicElapsed,cinematicAppliesToScene,tiltOnly}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const step={at:0,duration:8000,type:'MAP_TILT',sceneId:'basement',degrees:16,directionX:1,directionY:0};
const event={id:'turn',campaignId:'campaign',name:'Turn',createdAt:'2026-10-15T02:00:00Z',duration:8000,steps:[step]};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('toward and away resolve the chosen token position, and explicit compass directions do not need a token',()=>{
  assert.deepEqual(resolveTurnDirection('TOWARD',{x:50,y:50},{x:90,y:50}),{x:1,y:0});
  assert.deepEqual(resolveTurnDirection('AWAY',{x:50,y:50},{x:90,y:50}),{x:-1,y:-0});
  assert.deepEqual(resolveTurnDirection('N',{x:50,y:50}),{x:0,y:-1});
  assert.equal(resolveTurnDirection('TOWARD',{x:50,y:50},{x:50,y:50}),null);
  assert.equal(resolveTurnDirection('TOWARD',{x:0,y:0}),null);
});
test('late clients use the shared event clock and expire without replaying',()=>{
  const wall=Date.parse(event.createdAt)+2400;
  const a=cinematicElapsed(event,20,wall),b=cinematicElapsed(event,1900,wall);assert.equal(a,b);
  assert.deepEqual(mapTiltFrame(step,a,1200,800),mapTiltFrame(step,b,1200,800));
  assert.equal(mapTiltFrame(step,cinematicElapsed(event,0,wall+10000),1200,800).rotation,0);
});
test('tilt eases in, holds a modest angle, and returns exactly to identity',()=>{
  assert.equal(mapTiltFrame(step,0,1200,800).rotation,0);
  assert.ok(mapTiltFrame(step,350,1200,800).rotation<mapTiltFrame(step,1000,1200,800).rotation);
  near(mapTiltFrame(step,1200,1200,800).rotation,16*Math.PI/180);
  const end=mapTiltFrame(step,8000,1200,800);assert.equal(end.rotation,0);assert.equal(end.scale,1);
  assert.ok(mapTiltFrame({...step,degrees:900},1200,1200,800).rotation<=20*Math.PI/180);
});
test('reduced motion uses a static direction cue and no camera rotation or scaling',()=>{
  const f=mapTiltFrame(step,2400,1200,800,true);assert.equal(f.rotation,0);assert.equal(f.scale,1);assert.ok(Number.isFinite(f.arrowRotation));
});
test('rotated viewport fits at landscape and portrait edges',()=>{
  for(const [w,h]of [[1200,800],[500,900],[2000,500]]){const {rotation:r,scale:s}=mapTiltFrame(step,2400,w,h);assert.ok((w*Math.abs(Math.cos(r))+h*Math.abs(Math.sin(r)))*s<=w+.001);assert.ok((w*Math.abs(Math.sin(r))+h*Math.abs(Math.cos(r)))*s<=h+.001);}
});
test('Pixi transforms the whole board around view center and inverts hit coordinates at any pan/zoom',()=>{
  const wrapper=new Container(),root=new Container(),map=new Container(),token=new Container(),grid=new Container();wrapper.addChild(root);root.addChild(map,token,grid);root.position.set(83,-20);root.scale.set(.72);
  const f=mapTiltFrame(step,2400,1200,800);wrapper.pivot.set(600,400);wrapper.position.set(600,400);wrapper.rotation=f.rotation;wrapper.scale.set(f.scale);
  const center=wrapper.toGlobal({x:600,y:400});near(center.x,600);near(center.y,400);
  const p={x:350,y:275},global=root.toGlobal(p),back=root.toLocal(global);near(back.x,p.x);near(back.y,p.y);
  token.position.set(p.x,p.y);const tp=token.toGlobal({x:0,y:0});near(tp.x,global.x);near(tp.y,global.y);
  // Cancel/restore changes only the presentation parent, keeping DM pan and tokens.
  wrapper.rotation=0;wrapper.scale.set(1);wrapper.pivot.set(0,0);wrapper.position.set(0,0);
  assert.equal(token.x,p.x);assert.equal(root.x,83);near(root.scale.x,.72);
  wrapper.destroy({children:true});
});
test('Turn is scene-scoped; Restore has no effect steps and cannot replay a tilt',()=>{
  assert.equal(cinematicAppliesToScene(event,'basement'),true);assert.equal(cinematicAppliesToScene(event,'inn'),false);assert.equal(tiltOnly(event),true);
  const restore={...event,name:'Restore view',steps:[]};assert.equal(cinematicAppliesToScene(restore,'inn'),true);assert.equal(tiltOnly(restore),false);
});
