import { Application, Assets, Container, FederatedPointerEvent, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";
import type { AttackAnimationEvent, AttackSelection, CinematicEvent, Placement, Scene, SceneDiscoverable, SceneLink, SceneOverlay, Token, TokenMotionSegment, TokenPatrol } from "../../domain/types";
import { createSceneStructureKey, stableAssetIdentity, type SceneStructureSnapshot } from "./sceneStructureKey";
import { PATROL_PRESENTATION_DELAY_MS, serverNowMs } from "../../services/tabletopService";

export interface EngineSnapshot extends SceneStructureSnapshot { builder: boolean; shiftIntel: boolean; placement: Placement | null; patrolEdit: TokenPatrol | null; motionSegments: TokenMotionSegment[]; attackSelection: AttackSelection | null; attackEvent: AttackAnimationEvent | null; cinematicEvent: CinematicEvent | null; selectedTokenId: string | null; transientTokenIds: string[]; monsterIntel: Record<string, { hp: number; maxHp: number; ac: number }>; canMove(token: Token): boolean; canInteract(token:Token):boolean; }
interface EngineCallbacks { onSelect(id: string | null): void; onMoveCommit(id: string, x: number, y: number): void; onTokenMove(id:string,x:number,y:number,final:boolean):void; onInteract(id:string):void; onOverlayCommit(id: string, x: number, y: number): void; onSceneLinkCommit(id: string, x: number, y: number): void; onDiscoverableCommit(id:string,x:number,y:number):void; onPatrolWaypointAdd(x:number,y:number):void; onPatrolWaypointMove(id:string,x:number,y:number):void; onPatrolWaypointDelete(id:string):void; onSceneLinkActivate(id: string): void; onDiscover(id:string):void; onPlace(x: number, y: number): void; onAttackTarget(id: string | null): void; onContext(id: string, x: number, y: number): void; }
interface TokenMovementAnimation { display: Container; startX: number; startY: number; targetX: number; targetY: number; startedAt: number; }
interface PatrolVisualCatchup { revision:number; offsetX:number; offsetY:number; startedAt:number; durationMs:number; }
interface AttackEffect { id: string; preset: AttackAnimationEvent["preset"]; attacker: Container; target: Container; attackerX: number; attackerY: number; targetX: number; targetY: number; projectile: Graphics | null; burst: Graphics | null; startedAt: number; }
interface CinematicImpact { ring: Graphics; animate: () => void; }
interface CinematicTokenGlow { tokenId: string; graphic: Graphics; }
interface CinematicState { event: CinematicEvent; startedAt: number; rootX: number; rootY: number; scale: number; tokenBases: Map<string, { x: number; y: number; alpha: number; scale: number }>; impacts: Set<number>; effects: Set<CinematicImpact>; glows: Map<string, CinematicTokenGlow>; }

export class SceneEngine {
  private app = new Application(); private root = new Container(); private patrolLayer:Container|null=null; private snapshot: EngineSnapshot | null = null; private initialized = false; private destroyed = false; private renderVersion = 0; private structureKey: string | null = null; private tokenTextures = new Map<string, Promise<Texture | null>>(); private tokenDisplays = new Map<string, Container>(); private tokenStructureKeys = new Map<string,string>(); private tokenHiddenLabels = new Map<string,Text>(); private lightingLayer:Graphics|null=null; private lightingKey:string|null=null; private overlayDisplays = new Map<string, Container>(); private sceneLinkDisplays = new Map<string, Container>(); private discoverableDisplays = new Map<string,Container>(); private tokenPositionTargets = new Map<string, { x: number; y: number }>(); private tokenMovementAnimations = new Map<string, TokenMovementAnimation>(); private patrolVisualCatchups = new Map<string, PatrolVisualCatchup>(); private attackEffects = new Map<string, AttackEffect>(); private lastAttackEventId: string | null = null; private cinematic: CinematicState | null = null; private finishedCinematicIds = new Set<string>(); private selectedRings = new Map<string, Graphics>(); private intelDisplays = new Map<string, Container>(); private intelKey: string | null = null; private selectedTokenId: string | null = null; private placementGhost: Container | null = null; private placementKey: string | null = null; private pointerCandidate: { kind: "TOKEN"|"OVERLAY"|"SCENE_LINK"|"DISCOVERABLE"|"PATROL_WAYPOINT"; id: string; startX: number; startY: number; originX: number; originY: number; dx: number; dy: number; display: Container } | null = null; private dragging: { kind: "TOKEN"|"OVERLAY"|"SCENE_LINK"|"DISCOVERABLE"|"PATROL_WAYPOINT"; id: string; dx: number; dy: number; x: number; y: number; originX: number; originY: number; display: Container } | null = null; private lastMoveBroadcast=0; private instrumentation = { structuralRebuilds: 0, moveCommits: 0, overlayCommits: 0, sceneLinkCommits: 0 }; private panning = false; private panStart = { x: 0, y: 0, rootX: 0, rootY: 0 }; private spaceDown = false;
  constructor(private host: HTMLElement, private callbacks: EngineCallbacks) {}
  async init() {
    await this.app.init({ resizeTo: this.host, antialias: true, backgroundColor: 0x151816, resolution: Math.min(window.devicePixelRatio, 2), autoDensity: true }); this.initialized=true;
    if (this.destroyed) { this.app.destroy(true,{children:true,texture:false}); return; } this.app.canvas.className = "pixi-canvas"; this.host.appendChild(this.app.canvas); this.root.sortableChildren = true; this.app.stage.addChild(this.root); this.app.stage.eventMode = "static"; this.app.stage.hitArea = this.app.screen;
    this.app.stage.on("pointerdown", (e) => this.handleStageDown(e)); this.app.stage.on("pointermove", (e) => this.handleMove(e)); this.app.stage.on("pointerup", () => this.handleUp()); this.app.stage.on("pointerupoutside", () => this.handleUp());
    this.app.canvas.addEventListener("wheel", this.handleWheel, { passive: false }); this.app.ticker.add(this.updateTokenAnimations); this.center(); if (this.snapshot) void this.render(this.snapshot);
  }
  setSpaceDown(value: boolean) { this.spaceDown = value; }
  center() { if (!this.snapshot || !this.app.renderer) return; const s = this.snapshot.scene; const baseScale = Math.min(this.host.clientWidth / s.width, this.host.clientHeight / s.height) * .96; const cameraReady=this.snapshot.playerView&&s.playerCameraX!==null&&s.playerCameraY!==null; const scale=baseScale*(cameraReady?s.playerCameraZoom:1); this.root.scale.set(scale); this.root.position.set(cameraReady?this.host.clientWidth/2-s.playerCameraX!*scale:(this.host.clientWidth-s.width*scale)/2,cameraReady?this.host.clientHeight/2-s.playerCameraY!*scale:(this.host.clientHeight-s.height*scale)/2); }
  async render(snapshot: EngineSnapshot) {
    this.snapshot = snapshot;
    if (!this.app.renderer) return;
    const structureKey=createSceneStructureKey(snapshot);
    if (structureKey===this.structureKey) {
      await this.syncTokens(snapshot);
      if (this.destroyed) return;
      this.applyLighting(snapshot.scene);
      this.applyPositions(snapshot);
      this.applyDiscoverablePositions(snapshot);
      this.renderPatrolPath(snapshot);
      this.applyIntel(snapshot);
      this.applySelection(snapshot);
      this.applyPlacement(snapshot);
      this.applyAttackEvent(snapshot);
      return;
    }
    this.structureKey=structureKey;
    const version = ++this.renderVersion;
    this.instrumentation.structuralRebuilds++;
    this.debug("structural rebuild");
    this.clearCinematic();
    this.clearAttackEffects();
    this.root.removeChildren();
    this.patrolLayer=null;
    this.tokenDisplays.clear();
    this.tokenStructureKeys.clear();
    this.tokenHiddenLabels.clear();
    this.lightingLayer=null;
    this.lightingKey=null;
    this.overlayDisplays.clear();
    this.sceneLinkDisplays.clear();
    this.discoverableDisplays.clear();
    this.tokenPositionTargets.clear();
    this.tokenMovementAnimations.clear();
    this.patrolVisualCatchups.clear();
    this.selectedRings.clear();
    this.intelDisplays.clear();
    this.intelKey=null;
    this.selectedTokenId=null;
    this.placementGhost=null;
    this.placementKey=null;
    this.center();
    await this.renderBackground(snapshot.scene);
    if (version !== this.renderVersion || this.destroyed) return;
    if (snapshot.scene.gridType === "SQUARE") this.renderGrid(snapshot.scene);
    for (const overlay of snapshot.overlays.filter((o) => o.visible || snapshot.canDm)) await this.renderOverlay(overlay, snapshot.canDm);
    if (snapshot.canDm) for (const link of snapshot.sceneLinks) this.renderSceneLink(link);
    for(const item of snapshot.discoverables.filter(item=>snapshot.canDm||(!item.hidden&&!item.discoveredAt)))this.renderDiscoverable(item,snapshot.canDm);
    await this.syncTokens(snapshot);
    if (version !== this.renderVersion || this.destroyed) return;
    this.applyLighting(snapshot.scene);
    this.renderPatrolPath(snapshot);
    this.applyPositions(this.snapshot);
    this.applyDiscoverablePositions(this.snapshot);
    this.applyIntel(this.snapshot);
    this.applySelection(this.snapshot);
    this.applyPlacement(this.snapshot);
    this.applyAttackEvent(this.snapshot);
  }
  private applyPositions(snapshot: EngineSnapshot | null) {
    if (!snapshot) return;
    const tokenIds = new Set(snapshot.tokens.map((token) => token.id));
    for (const id of this.tokenPositionTargets.keys()) if (!tokenIds.has(id)) { this.tokenPositionTargets.delete(id); this.tokenMovementAnimations.delete(id); this.patrolVisualCatchups.delete(id); }
    for (const token of snapshot.tokens) {
      const display = this.tokenDisplays.get(token.id); if (!display) continue;
      const previousTarget = this.tokenPositionTargets.get(token.id);
      if (!previousTarget) { display.position.set(token.x, token.y); this.tokenPositionTargets.set(token.id, { x: token.x, y: token.y }); continue; }
      if (previousTarget.x === token.x && previousTarget.y === token.y) continue;
      this.tokenPositionTargets.set(token.id, { x: token.x, y: token.y });
      if (this.dragging?.kind === "TOKEN" && this.dragging.id === token.id) continue;
      if (snapshot.motionSegments.some(segment=>segment.tokenId===token.id&&segment.active)) { this.tokenMovementAnimations.delete(token.id); continue; }
      if (snapshot.transientTokenIds.includes(token.id)) { display.position.set(token.x, token.y); this.tokenMovementAnimations.delete(token.id); continue; }
      if (Math.hypot(display.position.x - token.x, display.position.y - token.y) < .01) { display.position.set(token.x, token.y); this.tokenMovementAnimations.delete(token.id); continue; }
      this.tokenMovementAnimations.set(token.id, { display, startX: display.position.x, startY: display.position.y, targetX: token.x, targetY: token.y, startedAt: performance.now() });
    }
    for (const overlay of snapshot.overlays) this.overlayDisplays.get(overlay.id)?.position.set(overlay.x,overlay.y);
    for (const link of snapshot.sceneLinks) this.sceneLinkDisplays.get(link.id)?.position.set(link.x,link.y);
  }
  private applyDiscoverablePositions(snapshot:EngineSnapshot|null){if(!snapshot)return;for(const item of snapshot.discoverables){const display=this.discoverableDisplays.get(item.id);if(display&&!(this.dragging?.kind==="DISCOVERABLE"&&this.dragging.id===item.id))display.position.set(item.x,item.y);}}
  private updateTokenAnimations = () => {
    const now = performance.now();
    for(const segment of this.snapshot?.motionSegments??[]){
      if(!segment.active||this.dragging?.id===segment.tokenId)continue;
      const display=this.tokenDisplays.get(segment.tokenId);
      if(!display)continue;
      const t=Math.max(0,Math.min(1,(serverNowMs()-PATROL_PRESENTATION_DELAY_MS-Date.parse(segment.startedAt))/segment.durationMs));
      const expectedX=segment.fromX+(segment.toX-segment.fromX)*t;
      const expectedY=segment.fromY+(segment.toY-segment.fromY)*t;
      let catchup=this.patrolVisualCatchups.get(segment.tokenId);
      if(!catchup||catchup.revision!==segment.revision){
        const offsetX=display.position.x-expectedX;
        const offsetY=display.position.y-expectedY;
        const distance=Math.hypot(offsetX,offsetY);
        catchup={
          revision:segment.revision,
          offsetX,
          offsetY,
          startedAt:now,
          durationMs:distance<1?0:Math.min(450,Math.max(140,distance*3)),
        };
        this.patrolVisualCatchups.set(segment.tokenId,catchup);
      }
      if(catchup.durationMs<=0){
        display.position.set(expectedX,expectedY);
        continue;
      }
      const catchupProgress=Math.min(1,(now-catchup.startedAt)/catchup.durationMs);
      const remaining=Math.pow(1-catchupProgress,3);
      display.position.set(expectedX+catchup.offsetX*remaining,expectedY+catchup.offsetY*remaining);
      if(catchupProgress>=1)this.patrolVisualCatchups.delete(segment.tokenId);
    }
    for (const [id, animation] of this.tokenMovementAnimations) {
      if (this.dragging?.kind === "TOKEN" && this.dragging.id === id) { this.tokenMovementAnimations.delete(id); continue; }
      const progress = Math.min(1, (now - animation.startedAt) / 225); const eased = 1 - Math.pow(1 - progress, 3);
      animation.display.position.set(animation.startX + (animation.targetX - animation.startX) * eased, animation.startY + (animation.targetY - animation.startY) * eased);
      if (progress === 1) this.tokenMovementAnimations.delete(id);
    }
    this.updateCinematic(now); this.updateAttackEffects(now);
  };
  private updateCinematic(now: number) {
    const event = this.snapshot?.cinematicEvent;
    if (!event) { if (this.cinematic) this.clearCinematic(); return; }
    if (event.completed || this.finishedCinematicIds.has(event.id)) {
      if (this.cinematic?.event.id === event.id) this.clearCinematic(false);
      return;
    }
    if (!this.cinematic || this.cinematic.event.id !== event.id) {
      this.clearCinematic();
      const tokenBases = new Map<string, { x: number; y: number; alpha: number; scale: number }>();
      for (const [id, display] of this.tokenDisplays) tokenBases.set(id, { x: display.x, y: display.y, alpha: display.alpha, scale: display.scale.x });
      this.cinematic = { event, startedAt: now, rootX: this.root.x, rootY: this.root.y, scale: this.root.scale.x, tokenBases, impacts: new Set(), effects: new Set(), glows: new Map() };
    }
    const cinematic = this.cinematic;
    const elapsed = now - cinematic.startedAt;
    if (elapsed >= event.duration) {
      this.finishedCinematicIds.add(event.id);
      if (this.finishedCinematicIds.size > 24) this.finishedCinematicIds.delete(this.finishedCinematicIds.values().next().value!);
      this.clearCinematic(false);
      return;
    }

    for (const [id, base] of cinematic.tokenBases) {
      const display = this.tokenDisplays.get(id);
      if (display) { display.position.set(base.x, base.y); display.alpha = base.alpha; display.scale.set(base.scale); }
    }

    let cameraX = cinematic.rootX;
    let cameraY = cinematic.rootY;
    let cameraScale = cinematic.scale;
    for (const step of event.steps) {
      if ((step.type !== "CAMERA_FOCUS_TOKEN" && step.type !== "CAMERA_FOCUS_POINT") || elapsed < step.at) continue;
      const duration = step.duration ?? 600;
      const progress = Math.min(1, (elapsed - step.at) / duration);
      if (progress >= 1 && !step.persistCamera) continue;
      const point = step.type === "CAMERA_FOCUS_TOKEN"
        ? this.tokenDisplays.get(step.tokenId)?.position
        : { x: step.x ?? 0, y: step.y ?? 0 };
      if (!point) continue;
      const ease = 1 - Math.pow(1 - progress, 3);
      const targetScale = cinematic.scale * (step.zoom ?? 1.35);
      const targetX = this.host.clientWidth / 2 - point.x * targetScale;
      const targetY = this.host.clientHeight / 2 - point.y * targetScale;
      cameraScale = cinematic.scale + (targetScale - cinematic.scale) * ease;
      cameraX = cinematic.rootX + (targetX - cinematic.rootX) * ease;
      cameraY = cinematic.rootY + (targetY - cinematic.rootY) * ease;
    }

    for (const step of event.steps) {
      const duration = step.duration ?? 600;
      if (elapsed < step.at || elapsed > step.at + duration) continue;
      const progress = Math.min(1, (elapsed - step.at) / duration);
      if (step.type === "MAP_SHAKE") {
        const n = (step.intensity ?? .25) * 28 * (1 - progress);
        cameraX += Math.sin(elapsed * .09) * n;
        cameraY += Math.cos(elapsed * .13) * n;
      }
      if (!("tokenId" in step)) continue;
      const display = this.tokenDisplays.get(step.tokenId);
      const base = cinematic.tokenBases.get(step.tokenId);
      if (!display || !base) continue;
      if (step.type === "TOKEN_SHAKE") display.position.set(base.x + Math.sin(elapsed * .14) * (step.intensity ?? 1) * 12 * (1 - progress), base.y + Math.cos(elapsed * .11) * (step.intensity ?? 1) * 8 * (1 - progress));
      if (step.type === "TOKEN_PULSE") display.scale.set(base.scale * (1 + .28 * Math.sin(progress * Math.PI)));
      if (step.type === "TOKEN_FADE") display.alpha = base.alpha * (1 - progress);
      if (step.type === "TOKEN_FADE_IN") display.alpha = base.alpha * (1 - Math.pow(1 - progress, 3));
      if (step.type === "TOKEN_RISE") { display.alpha = base.alpha * Math.min(1, progress * 2); display.position.set(base.x, base.y + (1 - progress) * 55); }
      if (step.type === "TOKEN_GLOW") this.updateTokenGlow(cinematic, step.tokenId, step.color, step.intensity, elapsed, progress);
      if (step.type === "IMPACT" && !cinematic.impacts.has(step.at)) this.createCinematicImpact(cinematic, display, step.at);
    }
    this.root.scale.set(cameraScale);
    this.root.position.set(cameraX, cameraY);
  }
  private updateTokenGlow(cinematic: CinematicState, tokenId: string, color: string | undefined, intensity: number | undefined, elapsed: number, progress: number) {
    const display = this.tokenDisplays.get(tokenId);
    const token = this.snapshot?.tokens.find((candidate) => candidate.id === tokenId);
    if (!display || !token || !this.snapshot) return;
    let glow = cinematic.glows.get(tokenId);
    if (!glow) {
      const radius = this.snapshot.scene.gridSize * .32 * token.size + 15;
      const graphic = new Graphics().circle(0, 0, radius).fill({ color: this.cinematicColor(color, 0xb699ff), alpha: .15 }).stroke({ color: this.cinematicColor(color, 0xb699ff), width: 4, alpha: .85 });
      graphic.eventMode = "none";
      display.addChildAt(graphic, 0);
      glow = { tokenId, graphic };
      cinematic.glows.set(tokenId, glow);
    }
    const envelope = Math.sin(progress * Math.PI);
    const strength = intensity ?? .7;
    glow.graphic.alpha = Math.max(.12, envelope * strength);
    glow.graphic.scale.set(1 + Math.sin(elapsed * .014) * .08 + envelope * .12);
  }
  private cinematicColor(value: string | undefined, fallback: number) {
    if (!value) return fallback;
    const parsed = Number.parseInt(value.replace("#", ""), 16);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  private createCinematicImpact(cinematic: CinematicState, display: Container, at: number) {
    cinematic.impacts.add(at);
    const ring = new Graphics().circle(0, 0, 14).stroke({ color: 0xf0c378, width: 4, alpha: .9 });
    ring.position.copyFrom(display.position); ring.zIndex = 720; this.root.addChild(ring);
    let age = 0;
    const effect: CinematicImpact = { ring, animate: () => {
      age += this.app.ticker.deltaMS; ring.scale.set(1 + age / 110); ring.alpha = Math.max(0, 1 - age / 400);
      if (age >= 400) { this.app.ticker.remove(effect.animate); ring.destroy(); cinematic.effects.delete(effect); }
    }};
    cinematic.effects.add(effect); this.app.ticker.add(effect.animate);
  }
  private clearCinematic(restoreCamera = true) {
    const cinematic = this.cinematic;
    if (!cinematic) return;
    for (const effect of cinematic.effects) { this.app.ticker.remove(effect.animate); effect.ring.destroy(); }
    for (const glow of cinematic.glows.values()) { glow.graphic.removeFromParent(); glow.graphic.destroy(); }
    cinematic.effects.clear(); cinematic.glows.clear();
    const persistCamera = cinematic.event.steps.some((step) => (step.type === "CAMERA_FOCUS_TOKEN" || step.type === "CAMERA_FOCUS_POINT") && step.persistCamera);
    if (restoreCamera || !persistCamera) { this.root.position.set(cinematic.rootX, cinematic.rootY); this.root.scale.set(cinematic.scale); }
    for (const [id, base] of cinematic.tokenBases) {
      const display = this.tokenDisplays.get(id);
      if (display) { display.position.set(base.x, base.y); display.alpha = base.alpha; display.scale.set(base.scale); }
    }
    this.cinematic = null;
  }
  private applyAttackEvent(snapshot: EngineSnapshot) {
    const event = snapshot.attackEvent;
    if (!event || event.id === this.lastAttackEventId) return;
    this.lastAttackEventId = event.id;
    this.playAttack(event);
  }
  private playAttack(event: AttackAnimationEvent) {
    const attacker = this.tokenDisplays.get(event.attackerTokenId); const target = this.tokenDisplays.get(event.targetTokenId);
    if (!attacker || !target || attacker === target) return;
    const projectile = event.preset === "MELEE" ? null : new Graphics().circle(0, 0, event.preset === "SPELL" ? 11 : 5).fill(event.preset === "SPELL" ? 0x9c7cff : 0xe8d5a8);
    if (projectile) { projectile.zIndex = 700; projectile.eventMode = "none"; projectile.position.copyFrom(attacker.position); this.root.addChild(projectile); }
    this.attackEffects.set(event.id, { id: event.id, preset: event.preset, attacker, target, attackerX: attacker.position.x, attackerY: attacker.position.y, targetX: target.position.x, targetY: target.position.y, projectile, burst: null, startedAt: performance.now() });
  }
  private updateAttackEffects(now: number) {
    for (const [id, effect] of this.attackEffects) {
      const duration = effect.preset === "MELEE" ? 420 : 360;
      const progress = Math.min(1, (now - effect.startedAt) / duration);
      if (effect.preset === "MELEE") {
        const lunge = progress < .35 ? progress / .35 : progress < .55 ? 1 : Math.max(0, (1 - progress) / .45);
        effect.attacker.position.set(effect.attackerX + (effect.targetX - effect.attackerX) * .24 * lunge, effect.attackerY + (effect.targetY - effect.attackerY) * .24 * lunge);
        if (progress > .32 && progress < .72) effect.target.position.set(effect.targetX + Math.sin(progress * 90) * 7, effect.targetY + Math.cos(progress * 72) * 4);
      } else if (effect.projectile) {
        const eased = 1 - Math.pow(1 - progress, 2);
        effect.projectile.position.set(effect.attackerX + (effect.targetX - effect.attackerX) * eased, effect.attackerY + (effect.targetY - effect.attackerY) * eased);
        effect.projectile.alpha = progress < .88 ? 1 : (1 - progress) / .12;
      }
      if (progress > .74 && !effect.burst) {
        const color = effect.preset === "SPELL" ? 0xb699ff : effect.preset === "RANGED" ? 0xf0dfb0 : 0xf1b071;
        effect.burst = new Graphics().circle(0, 0, 16).stroke({ color, width: 4, alpha: .9 }); effect.burst.zIndex = 701; effect.burst.eventMode = "none"; effect.burst.position.set(effect.targetX, effect.targetY); this.root.addChild(effect.burst);
      }
      if (effect.burst) { const burstProgress = Math.min(1, (progress - .74) / .26); effect.burst.scale.set(1 + burstProgress * 2.2); effect.burst.alpha = 1 - burstProgress; }
      if (progress < 1) continue;
      effect.attacker.position.set(effect.attackerX, effect.attackerY); effect.target.position.set(effect.targetX, effect.targetY);
      effect.projectile?.destroy(); effect.burst?.destroy(); this.attackEffects.delete(id);
    }
  }
  private clearAttackEffects() {
    for (const effect of this.attackEffects.values()) { effect.projectile?.destroy(); effect.burst?.destroy(); }
    this.attackEffects.clear();
  }
  private applyIntel(snapshot: EngineSnapshot | null) {
    if (!snapshot) return;
    const key = JSON.stringify({
      canDm: snapshot.canDm, shiftIntel: snapshot.shiftIntel, gridSize: snapshot.scene.gridSize,
      tokens: [...snapshot.tokens].sort((a, b) => a.id.localeCompare(b.id)).map((token) => ({ id: token.id, referenceId: token.referenceId, name: token.displayName, size: token.size })),
      monsterIntel: Object.entries(snapshot.monsterIntel).sort(([a], [b]) => a.localeCompare(b)),
    });
    if (key === this.intelKey) return;
    for (const display of this.intelDisplays.values()) { display.removeFromParent(); display.destroy({ children: true }); }
    this.intelDisplays.clear(); this.intelKey = key;
    if (!snapshot.canDm || !snapshot.shiftIntel) return;
    for (const token of snapshot.tokens) {
      const intel = snapshot.monsterIntel[token.referenceId ?? ""];
      const parent = this.tokenDisplays.get(token.id);
      if (!intel || !parent) continue;
      const radius = snapshot.scene.gridSize * .36 * token.size;
      const container = new Container(); container.eventMode = "none";
      const panel = new Graphics().roundRect(-70, -radius - 72, 140, 54, 7).fill({ color: 0x0d1110, alpha: .94 }).stroke({ color: 0x94754f, width: 1 });
      const info = new Text({ text: `${token.displayName}\n${intel.hp} / ${intel.maxHp} HP   ·   AC ${intel.ac}`, style: { fill: 0xe9e5dc, fontSize: 12, fontFamily: "Arial", align: "center", lineHeight: 19 } });
      info.anchor.set(.5); info.position.set(0, -radius - 45); container.addChild(panel, info); parent.addChild(container); this.intelDisplays.set(token.id, container);
    }
  }
  private debug(event: string) { if (import.meta.env.DEV) console.debug("[Wayfinder SceneEngine]", event, { ...this.instrumentation }); }
  private applySelection(snapshot: EngineSnapshot | null) { if (!snapshot || this.selectedTokenId===snapshot.selectedTokenId) return; for (const ring of this.selectedRings.values()) ring.destroy(); this.selectedRings.clear(); this.selectedTokenId=snapshot.selectedTokenId; if (!snapshot.selectedTokenId) return; const token=snapshot.tokens.find(candidate=>candidate.id===snapshot.selectedTokenId); const display=this.tokenDisplays.get(snapshot.selectedTokenId); if (!token || !display) return; const radius=snapshot.scene.gridSize*.32*token.size; const ring=new Graphics().circle(0,0,radius+11).stroke({color:0xe3b978,width:4}); ring.eventMode="none"; display.addChild(ring); this.selectedRings.set(token.id,ring); }
  private applyPlacement(snapshot: EngineSnapshot | null) { if (!snapshot) return; const identity=!snapshot.placement?null:"referenceId" in snapshot.placement?snapshot.placement.referenceId:"destinationSceneId" in snapshot.placement?snapshot.placement.destinationSceneId:snapshot.placement.referenceIds.join(",");const key=snapshot.placement?`${snapshot.placement.kind}:${identity}:${snapshot.placement.name}:${snapshot.scene.gridSize}`:null; if (key===this.placementKey) return; this.placementGhost?.destroy({children:true}); this.placementGhost=null; this.placementKey=key; if (snapshot.placement) this.renderPlacementGhost(snapshot.placement,snapshot.scene.gridSize); }
  private async renderBackground(scene: Scene) {
    if (scene.mapUrl) { try { const texture = await Assets.load<Texture>(scene.mapUrl); const sprite = new Sprite(texture); const scale=Math.min(scene.width/texture.width,scene.height/texture.height)*scene.mapScale; sprite.width=texture.width*scale; sprite.height=texture.height*scale; sprite.position.set((scene.width-sprite.width)/2+scene.mapX,(scene.height-sprite.height)/2+scene.mapY); sprite.zIndex = 0; this.root.addChild(sprite); return; } catch { /* fall through to a recognizable offline demo scene */ } }
    const floor = new Graphics().rect(0,0,scene.width,scene.height).fill(0x3d382f); floor.zIndex = 0; this.root.addChild(floor);
    const room = (x:number,y:number,w:number,h:number,color:number) => { const g = new Graphics().rect(x,y,w,h).fill(color).stroke({ color: 0x1b201d, width: 18 }); g.zIndex = 1; this.root.addChild(g); };
    room(90,90,620,330,0x5c5040); room(870,510,620,390,0x55493a); room(460,470,520,220,0x4c4438);
    const stacks = new Graphics(); for (let x=160;x<650;x+=120) stacks.rect(x,145,74,210).fill(0x2a2923); for (let x=980;x<1420;x+=130) stacks.rect(x,590,80,230).fill(0x2a2923); stacks.zIndex=2; this.root.addChild(stacks);
    const message = new Text({ text: "DEMO SCENE  ·  UPLOAD A MAP IMAGE FROM CAMPAIGN SETUP", style: new TextStyle({ fill: 0xb7a98f, fontFamily: "Arial", fontSize: 15, letterSpacing: 3 }) }); message.anchor.set(.5); message.position.set(scene.width/2,40); message.zIndex=2; this.root.addChild(message);
  }
  private renderGrid(scene: Scene) { const g = new Graphics(); const color = Number.parseInt(scene.gridColor.replace("#",""),16); const startX=((scene.gridOffsetX%scene.gridSize)+scene.gridSize)%scene.gridSize; const startY=((scene.gridOffsetY%scene.gridSize)+scene.gridSize)%scene.gridSize; for(let x=startX;x<=scene.width;x+=scene.gridSize) g.moveTo(x,0).lineTo(x,scene.height); for(let y=startY;y<=scene.height;y+=scene.gridSize) g.moveTo(0,y).lineTo(scene.width,y); g.stroke({ color, width: scene.gridLineWidth, alpha: scene.gridOpacity }); g.zIndex=10; g.eventMode="none"; this.root.addChild(g); }
  private applyLighting(scene: Scene) {
    const key=`${scene.id}:${scene.width}:${scene.height}:${scene.lighting}`;
    if(key===this.lightingKey)return;
    this.lightingKey=key;
    if(this.lightingLayer){
      this.lightingLayer.removeFromParent();
      this.lightingLayer.destroy();
      this.lightingLayer=null;
    }
    if(scene.lighting==="DAY")return;
    const color=scene.lighting==="MIDDAY"?0xd6a15f:0x071019;
    const alpha=scene.lighting==="MIDDAY"?.10:.50;
    const shade=new Graphics().rect(0,0,scene.width,scene.height).fill({color,alpha});
    shade.zIndex=490;
    shade.eventMode="none";
    this.lightingLayer=shade;
    this.root.addChild(shade);
  }
  private async renderOverlay(overlay: SceneOverlay, canDm: boolean) {
    let display: Sprite|Container;
    if (overlay.imageUrl) { try { const texture = await Assets.load<Texture>(overlay.imageUrl); const sprite = new Sprite(texture); sprite.anchor.set(.5); sprite.width=overlay.width; sprite.height=overlay.height; display=sprite; } catch { display=this.fallbackEffect(overlay); } } else display=this.fallbackEffect(overlay);
    display.position.set(overlay.x,overlay.y); display.rotation=overlay.rotation; display.alpha=overlay.visible?overlay.opacity:(canDm?.3:0); display.zIndex=100+overlay.zIndex; display.eventMode=canDm&&!overlay.locked?"static":"none"; display.cursor="move"; display.on("pointerdown",(e: FederatedPointerEvent)=>{ if(e.button!==0)return; e.stopPropagation(); const p=this.root.toLocal(e.global); const currentX=display.position.x,currentY=display.position.y; this.pointerCandidate={kind:"OVERLAY",id:overlay.id,startX:e.global.x,startY:e.global.y,originX:currentX,originY:currentY,dx:p.x-currentX,dy:p.y-currentY,display}; }); this.overlayDisplays.set(overlay.id,display); this.root.addChild(display);
    if (canDm && overlay.locked) { const lock = new Text({ text:"◆", style:{ fill:0xd3ad76,fontSize:16 } }); lock.anchor.set(.5); lock.position.set(overlay.x,overlay.y-overlay.height/2-14); lock.zIndex=250; this.root.addChild(lock); }
  }
  private fallbackEffect(overlay: SceneOverlay) { const c=new Container(); const glow=new Graphics().ellipse(0,0,overlay.width,overlay.height).fill({color:0xc44721,alpha:.2}); c.addChild(glow); for(let i=0;i<12;i++){const flame=new Graphics().circle((i%4-1.5)*42,(Math.floor(i/4)-1)*38,16+(i%3)*5).fill({color:i%2?0xf0782d:0xc43d1e,alpha:.55}); c.addChild(flame);} return c; }
  private renderSceneLink(link: SceneLink) {
    const c=new Container(); c.position.set(link.x,link.y); c.zIndex=275; c.eventMode="static"; c.cursor=this.snapshot?.builder?"move":"pointer";
    const marker=new Graphics().roundRect(-19,-19,38,38,8).fill({color:0x17251f,alpha:.94}).stroke({color:0xe3b978,width:2});
    const arrow=new Text({text:"↗",style:{fill:0xf4ead9,fontSize:25,fontWeight:"700",fontFamily:"Arial"}}); arrow.anchor.set(.5); arrow.position.set(0,-1);
    const label=new Text({text:link.label||"Scene link",style:{fill:0xf4ead9,fontSize:12,fontWeight:"700",fontFamily:"Arial",stroke:{color:0x0a0f0d,width:4}}}); label.anchor.set(.5,0); label.position.set(0,27); c.addChild(marker,arrow,label);
    c.on("pointerdown",(e:FederatedPointerEvent)=>{if(e.button!==0)return;e.stopPropagation();if(!this.snapshot?.builder){this.callbacks.onSceneLinkActivate(link.id);return;}const p=this.root.toLocal(e.global);const currentX=c.position.x,currentY=c.position.y;this.pointerCandidate={kind:"SCENE_LINK",id:link.id,startX:e.global.x,startY:e.global.y,originX:currentX,originY:currentY,dx:p.x-currentX,dy:p.y-currentY,display:c};});
    this.sceneLinkDisplays.set(link.id,c); this.root.addChild(c);
  }
  private renderDiscoverable(item:SceneDiscoverable,canDm:boolean){const c=new Container();c.position.set(item.x,item.y);c.zIndex=270;c.eventMode="static";c.cursor=canDm?"grab":"pointer";const marker=new Graphics().circle(0,0,15).fill({color:item.hidden?0x65513c:0x3c5b55,alpha:item.hidden?.46:.96}).stroke({color:item.hidden?0xe3b978:0xf0d48c,width:2});const icon=new Text({text:"✦",style:{fill:0xfff0bd,fontSize:20,fontWeight:"700"}});icon.anchor.set(.5);c.addChild(marker,icon);if(canDm){const label=new Text({text:`${item.hidden?"HIDDEN · ":""}${item.name}`,style:{fill:0xf4ead9,fontSize:11,fontWeight:"700",stroke:{color:0x0a0f0d,width:4}}});label.anchor.set(.5,0);label.position.set(0,20);c.addChild(label);}c.on("pointerdown",(e:FederatedPointerEvent)=>{if(e.button!==0)return;e.stopPropagation();if(!canDm){if(!item.discoveredAt)this.callbacks.onDiscover(item.id);return;}const p=this.root.toLocal(e.global);this.pointerCandidate={kind:"DISCOVERABLE",id:item.id,startX:e.global.x,startY:e.global.y,originX:c.x,originY:c.y,dx:p.x-c.x,dy:p.y-c.y,display:c};});this.discoverableDisplays.set(item.id,c);this.root.addChild(c);}
  private renderPatrolPath(snapshot:EngineSnapshot){this.patrolLayer?.destroy({children:true});this.patrolLayer=null;const patrol=snapshot.builder&&snapshot.canDm?snapshot.patrolEdit:null;if(!patrol)return;const layer=new Container();layer.zIndex=600;layer.sortableChildren=true;layer.eventMode="none";const line=new Graphics();if(patrol.waypoints.length>1){line.moveTo(patrol.waypoints[0].x,patrol.waypoints[0].y);for(const point of patrol.waypoints.slice(1))line.lineTo(point.x,point.y);line.stroke({color:0x74b6a2,width:3,alpha:.75});}layer.addChild(line);for(const [index,point] of patrol.waypoints.entries()){const marker=new Container();marker.position.set(point.x,point.y);marker.eventMode="static";marker.cursor="grab";const circle=new Graphics().circle(0,0,14).fill({color:0x183f39,alpha:.95}).stroke({color:0xe4c77f,width:2});const label=new Text({text:String(index+1),style:{fill:0xfff3ce,fontSize:13,fontWeight:"700"}});label.anchor.set(.5);marker.addChild(circle,label);marker.on("pointerdown",(e:FederatedPointerEvent)=>{if(e.button!==0)return;e.stopPropagation();const p=this.root.toLocal(e.global);this.pointerCandidate={kind:"PATROL_WAYPOINT",id:point.id,startX:e.global.x,startY:e.global.y,originX:marker.x,originY:marker.y,dx:p.x-marker.x,dy:p.y-marker.y,display:marker};});marker.on("rightclick",(e:FederatedPointerEvent)=>{e.stopPropagation();this.callbacks.onPatrolWaypointDelete(point.id);});layer.addChild(marker);}this.patrolLayer=layer;this.root.addChild(layer);}
  private async loadTokenTexture(url: string) {
    let pending = this.tokenTextures.get(url);
    if (!pending) { pending = Assets.load<Texture>(url).catch(() => null); this.tokenTextures.set(url, pending); }
    return pending;
  }
  private tokenRenderKey(token:Token,snapshot:EngineSnapshot){
    return JSON.stringify({
      id:token.id,
      sceneId:token.sceneId,
      referenceId:token.referenceId,
      ownerUserId:token.ownerUserId,
      type:token.type,
      displayName:token.displayName,
      image:stableAssetIdentity(token.imagePath,token.imageUrl),
      size:token.size,
      rotation:token.rotation,
      locked:token.locked,
      conditions:[...token.conditions].sort(),
      canDm:snapshot.canDm,
    });
  }
  private removeTokenDisplay(id:string){
    const display=this.tokenDisplays.get(id);
    if(display){
      display.removeFromParent();
      display.destroy({children:true});
    }
    this.tokenDisplays.delete(id);
    this.tokenStructureKeys.delete(id);
    this.tokenHiddenLabels.delete(id);
    this.tokenPositionTargets.delete(id);
    this.tokenMovementAnimations.delete(id);
    this.patrolVisualCatchups.delete(id);
  }
  private applyTokenVisibility(token:Token,snapshot:EngineSnapshot){
    const display=this.tokenDisplays.get(token.id);
    if(!display)return;
    display.visible=snapshot.canDm||token.visible;
    display.alpha=snapshot.canDm&&!token.visible?.42:1;
    const hidden=this.tokenHiddenLabels.get(token.id);
    if(hidden)hidden.visible=snapshot.canDm&&!token.visible;
  }
  private async syncTokens(snapshot:EngineSnapshot){
    const ids=new Set(snapshot.tokens.map(token=>token.id));
    for(const id of [...this.tokenDisplays.keys()]){
      if(!ids.has(id))this.removeTokenDisplay(id);
    }
    for(const token of snapshot.tokens){
      const key=this.tokenRenderKey(token,snapshot);
      let display=this.tokenDisplays.get(token.id);
      if(display&&this.tokenStructureKeys.get(token.id)!==key){
        this.removeTokenDisplay(token.id);
        display=undefined;
      }
      if(!display&&(snapshot.canDm||token.visible)){
        await this.renderToken(token,snapshot);
        if(this.destroyed)return;
        this.tokenStructureKeys.set(token.id,key);
      }else if(display){
        this.tokenStructureKeys.set(token.id,key);
      }
      this.applyTokenVisibility(token,snapshot);
    }
  }
  private async renderToken(token: Token, snapshot: EngineSnapshot) {
    const cell=snapshot.scene.gridSize; const radius=cell*.32*token.size; const c=new Container(); c.position.set(token.x,token.y); c.rotation=token.rotation; c.zIndex=300; c.eventMode="static"; c.cursor=snapshot.canMove(token)?"grab":"pointer";
    const ringColor=token.type==="MONSTER"?0x718460:token.type==="NPC"?0x9b794e:0x9a86b1;
    const ring=new Graphics().circle(0,0,radius+5).fill(ringColor); c.addChild(ring);
    const texture=token.imageUrl?await this.loadTokenTexture(token.imageUrl):null;
    if(texture){
      const portrait=new Sprite(texture); portrait.anchor.set(.5); const diameter=radius*2; const scale=Math.max(diameter/texture.width,diameter/texture.height); portrait.scale.set(scale);
      const circleMask=new Graphics().circle(0,0,radius).fill(0xffffff); portrait.mask=circleMask; c.addChild(portrait,circleMask);
    }else{
      const face=new Graphics().circle(0,0,radius).fill(token.type==="MONSTER"?0x394a34:token.type==="NPC"?0x6e5335:0x544965); c.addChild(face); const label=new Text({text:token.displayName.slice(0,1).toUpperCase(),style:{fill:0xf4ead9,fontSize:radius*.8,fontWeight:"700",fontFamily:"Georgia"}}); label.anchor.set(.5); c.addChild(label);
    }
    if(token.conditions.length){const badge=new Graphics().circle(radius*.8,radius*.8,12).fill(0x8b5039); const bt=new Text({text:String(token.conditions.length),style:{fill:0xffffff,fontSize:12,fontWeight:"700"}}); bt.anchor.set(.5); bt.position.set(radius*.8,radius*.8); c.addChild(badge,bt);}
    if(snapshot.canDm){const hidden=new Text({text:"HIDDEN",style:{fill:0xe5b978,fontSize:11,fontWeight:"700",letterSpacing:1}});hidden.anchor.set(.5);hidden.position.set(0,-radius-17);hidden.visible=!token.visible;c.addChild(hidden);this.tokenHiddenLabels.set(token.id,hidden);}
    c.on("rightclick",(e: FederatedPointerEvent)=>{e.stopPropagation();this.callbacks.onContext(token.id,e.clientX,e.clientY);}); c.on("pointerdown",(e: FederatedPointerEvent)=>{if(e.button!==0)return;if(this.snapshot?.attackSelection){e.stopPropagation();this.callbacks.onAttackTarget(token.id);return;}if(this.snapshot?.canInteract(token)){e.stopPropagation();this.callbacks.onInteract(token.id);return;}if(!this.snapshot?.canMove(token)){e.stopPropagation();this.callbacks.onSelect(token.id);return;}e.stopPropagation();const p=this.root.toLocal(e.global);const currentX=c.position.x,currentY=c.position.y;this.pointerCandidate={kind:"TOKEN",id:token.id,startX:e.global.x,startY:e.global.y,originX:currentX,originY:currentY,dx:p.x-currentX,dy:p.y-currentY,display:c};}); this.tokenDisplays.set(token.id,c); this.root.addChild(c); this.applyTokenVisibility(token,snapshot);
  }
  private renderPlacementGhost(placement: Placement, cell: number) { const ghost=new Container();const radius=placement.kind==="SCENE_LINK"?cell*.22:cell*.32;const color=placement.kind==="MONSTER"?0x718460:placement.kind==="SCENE_LINK"?0xe3b978:0x9a86b1;const circle=new Graphics().circle(0,0,radius).fill({color,alpha:.45}).stroke({color:0xe3b978,width:2});const label=new Text({text:placement.kind==="SCENE_LINK"?"↗":placement.name.slice(0,1).toUpperCase(),style:{fill:0xf4ead9,fontSize:radius*.8,fontWeight:"700",fontFamily:"Georgia"}});label.anchor.set(.5);ghost.addChild(circle,label);ghost.zIndex=310;ghost.eventMode="none";ghost.visible=false;this.placementGhost=ghost;this.root.addChild(ghost); }
  private handleStageDown(e:FederatedPointerEvent){if(this.spaceDown||e.button===1){this.panning=true;this.panStart={x:e.global.x,y:e.global.y,rootX:this.root.x,rootY:this.root.y};return;}if(this.snapshot?.attackSelection){this.callbacks.onAttackTarget(null);return;}if(this.snapshot?.patrolEdit&&this.snapshot.builder&&this.snapshot.canDm){const p=this.root.toLocal(e.global);this.callbacks.onPatrolWaypointAdd(p.x,p.y);return;}if(this.snapshot?.placement&&this.snapshot.canDm){const p=this.root.toLocal(e.global);this.callbacks.onPlace(p.x,p.y);return;}this.callbacks.onSelect(null);}
  private handleMove(e:FederatedPointerEvent){if(this.panning){this.root.position.set(this.panStart.rootX+e.global.x-this.panStart.x,this.panStart.rootY+e.global.y-this.panStart.y);return;}if(this.snapshot?.placement&&this.placementGhost){const p=this.root.toLocal(e.global);this.placementGhost.position.set(p.x,p.y);this.placementGhost.visible=true;return;}if(!this.dragging&&this.pointerCandidate){const candidate=this.pointerCandidate;if(Math.hypot(e.global.x-candidate.startX,e.global.y-candidate.startY)<5)return;this.dragging={kind:candidate.kind,id:candidate.id,dx:candidate.dx,dy:candidate.dy,x:candidate.originX,y:candidate.originY,originX:candidate.originX,originY:candidate.originY,display:candidate.display};if(candidate.kind==="TOKEN"){this.tokenMovementAnimations.delete(candidate.id);this.patrolVisualCatchups.delete(candidate.id);}this.pointerCandidate=null;}if(!this.dragging)return;const p=this.root.toLocal(e.global);const x=p.x-this.dragging.dx,y=p.y-this.dragging.dy;this.dragging.x=x;this.dragging.y=y;this.dragging.display.position.set(x,y);if(this.dragging.kind==="TOKEN"&&performance.now()-this.lastMoveBroadcast>=40){this.lastMoveBroadcast=performance.now();this.callbacks.onTokenMove(this.dragging.id,x,y,false);}}
  private handleUp(){const candidate=this.pointerCandidate;this.pointerCandidate=null;if(candidate){if(candidate.kind==="TOKEN")this.callbacks.onSelect(candidate.id);this.panning=false;return;}if(!this.dragging){this.panning=false;return;}const drag=this.dragging;const changed=Math.hypot(drag.x-drag.originX,drag.y-drag.originY)>.01;if(drag.kind==="TOKEN"){if(changed){this.instrumentation.moveCommits++;this.debug("token move commit");this.callbacks.onMoveCommit(drag.id,drag.x,drag.y);}else this.callbacks.onSelect(drag.id);}else if(drag.kind==="OVERLAY"&&changed){this.instrumentation.overlayCommits++;this.debug("overlay move commit");this.callbacks.onOverlayCommit(drag.id,drag.x,drag.y);}else if(drag.kind==="SCENE_LINK"&&changed){this.instrumentation.sceneLinkCommits++;this.debug("scene link move commit");this.callbacks.onSceneLinkCommit(drag.id,drag.x,drag.y);}else if(drag.kind==="DISCOVERABLE"&&changed){this.callbacks.onDiscoverableCommit(drag.id,drag.x,drag.y);}else if(drag.kind==="PATROL_WAYPOINT"&&changed){this.callbacks.onPatrolWaypointMove(drag.id,drag.x,drag.y);}this.dragging=null;this.panning=false;}
  private handleWheel=(e:WheelEvent)=>{e.preventDefault();const old=this.root.scale.x;const next=Math.max(.25,Math.min(3,old*(e.deltaY<0?1.1:.9)));const rect=this.app.canvas.getBoundingClientRect();const px=e.clientX-rect.left,py=e.clientY-rect.top;const wx=(px-this.root.x)/old,wy=(py-this.root.y)/old;this.root.scale.set(next);this.root.position.set(px-wx*next,py-wy*next);};
  destroy(){this.clearCinematic();this.destroyed=true;this.clearAttackEffects();this.tokenTextures.clear();this.tokenDisplays.clear();this.tokenStructureKeys.clear();this.tokenHiddenLabels.clear();this.lightingLayer=null;this.lightingKey=null;this.overlayDisplays.clear();this.sceneLinkDisplays.clear();this.discoverableDisplays.clear();this.patrolLayer?.destroy({children:true});this.patrolLayer=null;this.tokenPositionTargets.clear();this.tokenMovementAnimations.clear();this.patrolVisualCatchups.clear();this.selectedRings.clear();this.intelDisplays.clear();if(!this.initialized)return;this.app.canvas.removeEventListener("wheel",this.handleWheel);this.app.ticker.remove(this.updateTokenAnimations);this.app.destroy(true,{children:true,texture:false});}
}
