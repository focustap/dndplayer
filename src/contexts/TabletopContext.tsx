import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import type { FogRegion, FogTool, GridType, Placement, SceneOverlay, TabletopState, Token } from "../domain/types";
import { isDmRole } from "../domain/types";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { tabletopService } from "../services/tabletopService";

interface TabletopActions {
  selectToken(id: string | null): void;
  setShiftIntel(value: boolean): void;
  setFogTool(value: FogTool | null): void;
  togglePlayerPreview(): void;
  startPlacement(placement: Placement): void;
  cancelPlacement(): void;
  placeToken(x: number, y: number): Promise<void>;
  updateSceneGrid(gridType: GridType, gridSize?: number): Promise<void>;
  commitTokenMove(id: string, x: number, y: number): Promise<void>;
  deleteToken(id: string): Promise<void>;
  patchToken(id: string, patch: Partial<Token>): Promise<void>;
  adjustHp(instanceId: string, amount: number, mode: "DAMAGE"|"HEAL"): Promise<void>;
  setHp(instanceId: string, currentHp: number, maxHp: number): Promise<void>;
  toggleCondition(instanceId: string, condition: string): Promise<void>;
  nextTurn(delta: 1|-1): Promise<void>;
  startCombat(): Promise<void>;
  endCombat(): Promise<void>;
  addToInitiative(tokenId: string, initiative?: number): Promise<void>;
  removeInitiative(entryId: string): Promise<void>;
  reorderInitiative(sourceId: string, targetId: string): Promise<void>;
  duplicateToken(tokenId: string): Promise<void>;
  addOverlay(file: File): Promise<void>;
  patchOverlay(id: string, patch: Partial<SceneOverlay>): Promise<void>;
  addFog(tool: FogTool, points: number[]): Promise<void>;
  resetFog(covered: boolean): Promise<void>;
  reload(): Promise<void>;
}
interface TabletopValue { state: TabletopState | null; loading: boolean; error: string | null; playerView: boolean; actions: TabletopActions; }
const TabletopContext = createContext<TabletopValue | null>(null);

export function TabletopProvider({ children, playerView }: { children: ReactNode; playerView: boolean }) {
  const { campaignId = "demo" } = useParams();
  const [state, setState] = useState<TabletopState | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state); useEffect(() => { stateRef.current = state; }, [state]);
  const reload = useCallback(async () => { try { const next = await tabletopService.load(campaignId, playerView); setState((current) => current ? { ...next, selectedTokenId: current.selectedTokenId, activeFogTool: current.activeFogTool, previewPlayerView: current.previewPlayerView, shiftIntel: current.shiftIntel } : next); setError(null); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load the tabletop"); } finally { setLoading(false); } }, [campaignId, playerView]);
  useEffect(() => { let cancelled=false; void tabletopService.load(campaignId,playerView).then((next)=>{if(!cancelled){setState(next);setError(null);}}).catch((e:unknown)=>{if(!cancelled)setError(e instanceof Error?e.message:"Unable to load the tabletop");}).finally(()=>{if(!cancelled)setLoading(false);}); return()=>{cancelled=true;}; }, [campaignId,playerView]);
  useEffect(() => {
    if (!isSupabaseConfigured || campaignId === "demo") return;
    const channel = supabase.channel(`campaign-sync:${campaignId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "sync_events", filter: `campaign_id=eq.${campaignId}` }, () => void reload()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [campaignId, reload]);

  const actions = useMemo<TabletopActions>(() => ({
    selectToken(id) { setState((s) => s ? { ...s, selectedTokenId: id } : s); },
    setShiftIntel(value) { setState((s) => s ? { ...s, shiftIntel: value } : s); },
    setFogTool(value) { setState((s) => s ? { ...s, activeFogTool: value } : s); },
    togglePlayerPreview() { setState((s) => s ? { ...s, previewPlayerView: !s.previewPlayerView } : s); },
    startPlacement(placement) { const s=stateRef.current;if(!s||!isDmRole(s.role))return;setState(current=>current?{...current,placement,activeFogTool:null}:current); },
    cancelPlacement() { setState(current=>current?{...current,placement:null}:current); },
    async placeToken(x,y) { const s=stateRef.current;const placement=s?.placement;if(!s||!placement||!isDmRole(s.role))return;const token=placement.kind==="CHARACTER"?await tabletopService.placeCharacterToken(s.scene.id,placement.referenceId,x,y):await tabletopService.placeMonsterToken(s.scene.id,placement.referenceId,x,y);setState(current=>current?{...current,tokens:[...current.tokens,token],placement:null}:current); },
    async updateSceneGrid(gridType, gridSize) { const s=stateRef.current;if(!s||!isDmRole(s.role))return;const size=Math.max(20,Math.min(240,Math.round(gridSize??s.scene.gridSize)));await tabletopService.updateSceneGrid(s.scene.id,gridType,size);setState(current=>current?{...current,scene:{...current.scene,gridType,gridSize:size}}:current); },
    async commitTokenMove(id, x, y) { await tabletopService.moveToken(id, x, y); setState((current) => current ? { ...current, tokens: current.tokens.map((token) => token.id === id ? { ...token, x, y } : token) } : current); },
    async deleteToken(id) { const s = stateRef.current; if (!s || !isDmRole(s.role)) return; if (isSupabaseConfigured && campaignId !== "demo") { const { error } = await supabase.from("tokens").delete().eq("id", id); if (error) throw error; } setState((current) => current ? { ...current, selectedTokenId: current.selectedTokenId === id ? null : current.selectedTokenId, tokens: current.tokens.filter((t) => t.id !== id) } : current); },
    async patchToken(id, patch) { const s=stateRef.current;const referenceId=s?.tokens.find(t=>t.id===id)?.referenceId;await tabletopService.updateToken(id, patch);if(patch.visible!==undefined&&referenceId&&s?.monsterInstances.some(m=>m.id===referenceId)&&isSupabaseConfigured&&campaignId!=="demo"){const {error}=await supabase.from("monster_instances").update({visible:patch.visible}).eq("id",referenceId);if(error)throw error;} setState((current) => current ? { ...current, tokens: current.tokens.map((t) => t.id === id ? { ...t, ...patch } : t), monsterInstances: patch.visible === undefined ? current.monsterInstances : current.monsterInstances.map((m) => referenceId === m.id ? { ...m, visible: patch.visible! } : m) } : current); },
    async adjustHp(instanceId, amount, mode) { const safe = Math.max(0, Math.floor(amount)); if (!safe) return; await tabletopService.adjustMonsterHp(instanceId, safe, mode); setState((s) => s ? { ...s, monsterInstances: s.monsterInstances.map((m) => m.id === instanceId ? { ...m, currentHp: mode === "DAMAGE" ? Math.max(0, m.currentHp - safe) : Math.min(m.maxHp, m.currentHp + safe), dead: mode === "DAMAGE" ? m.currentHp - safe <= 0 : false } : m) } : s); },
    async setHp(instanceId, currentHp, maxHp) { const max = Math.max(1, maxHp); const current = Math.max(0, Math.min(max, currentHp)); await tabletopService.setMonsterHp(instanceId, current, max); setState((s) => s ? { ...s, monsterInstances: s.monsterInstances.map((m) => m.id === instanceId ? { ...m, currentHp: current, maxHp: max, dead: current === 0 } : m) } : s); },
    async toggleCondition(instanceId, condition) { const s = stateRef.current; const instance = s?.monsterInstances.find((m) => m.id === instanceId); const token = s?.tokens.find((t) => t.referenceId === instanceId); if (!instance || !token) return; const conditions = instance.conditions.includes(condition) ? instance.conditions.filter((c) => c !== condition) : [...instance.conditions, condition]; if (isSupabaseConfigured && campaignId !== "demo") { await Promise.all([supabase.from("monster_instances").update({ conditions }).eq("id", instanceId), tabletopService.updateToken(token.id, { conditions })]); } setState((current) => current ? { ...current, monsterInstances: current.monsterInstances.map((m) => m.id === instanceId ? { ...m, conditions } : m), tokens: current.tokens.map((t) => t.id === token.id ? { ...t, conditions } : t) } : current); },
    async nextTurn(delta) { const s = stateRef.current; if (!s || !s.combat.entries.length) return; await tabletopService.advanceTurn(s.combat, delta); setState((current) => { if (!current) return current; let index = current.combat.currentIndex + delta; let round = current.combat.round; if (index >= current.combat.entries.length) { index = 0; round += 1; } if (index < 0) { index = current.combat.entries.length - 1; round = Math.max(1, round - 1); } return { ...current, combat: { ...current.combat, currentIndex: index, round } }; }); },
    async startCombat() { const s=stateRef.current;if(!s||s.combat.active)return;let id=crypto.randomUUID();if(isSupabaseConfigured&&campaignId!=="demo"){const {data,error}=await supabase.from("combat_sessions").insert({campaign_id:s.campaign.id,scene_id:s.scene.id,active:true}).select("id").single();if(error)throw error;id=data.id;}setState(current=>current?{...current,combat:{id,campaignId:current.campaign.id,sceneId:current.scene.id,active:true,round:1,currentIndex:0,entries:[]}}:current);},
    async endCombat() { const s=stateRef.current;if(!s||!s.combat.active)return;if(isSupabaseConfigured&&campaignId!=="demo"){const {error}=await supabase.from("combat_sessions").update({active:false,ended_at:new Date().toISOString()}).eq("id",s.combat.id);if(error)throw error;}setState(current=>current?{...current,combat:{...current.combat,active:false,round:1,currentIndex:0,entries:[]}}:current);},
    async addToInitiative(tokenId, initiative) { const s=stateRef.current;if(!s)return;const token=s.tokens.find(t=>t.id===tokenId);if(!token)return;let combat=s.combat;if(!combat.active){let id=crypto.randomUUID();if(isSupabaseConfigured&&campaignId!=="demo"){const {data,error}=await supabase.from("combat_sessions").insert({campaign_id:s.campaign.id,scene_id:s.scene.id,active:true}).select("id").single();if(error)throw error;id=data.id;}combat={id,campaignId:s.campaign.id,sceneId:s.scene.id,active:true,round:1,currentIndex:0,entries:[]};}const score=initiative??Math.floor(Math.random()*20)+1;const entry={id:crypto.randomUUID(),combatSessionId:combat.id,tokenId:token.id,monsterInstanceId:token.type==="MONSTER"?token.referenceId:null,characterId:token.type==="PLAYER"?token.referenceId:null,name:token.displayName,imageUrl:token.imageUrl,initiative:score,sortOrder:combat.entries.length,groupKey:null,groupCount:1};if(isSupabaseConfigured&&campaignId!=="demo"){const {error}=await supabase.from("initiative_entries").insert({id:entry.id,combat_session_id:combat.id,token_id:entry.tokenId,monster_instance_id:entry.monsterInstanceId,character_id:entry.characterId,name:entry.name,image_url:entry.imageUrl,initiative:score,sort_order:entry.sortOrder});if(error)throw error;}setState(current=>current?{...current,combat:{...combat,entries:[...combat.entries,entry].sort((a,b)=>b.initiative-a.initiative).map((e,i)=>({...e,sortOrder:i}))}}:current);},
    async removeInitiative(entryId) { if(isSupabaseConfigured&&campaignId!=="demo"){const {error}=await supabase.from("initiative_entries").delete().eq("id",entryId);if(error)throw error;}setState(current=>current?{...current,combat:{...current.combat,currentIndex:Math.min(current.combat.currentIndex,Math.max(0,current.combat.entries.length-2)),entries:current.combat.entries.filter(e=>e.id!==entryId).map((e,i)=>({...e,sortOrder:i}))}}:current);},
    async reorderInitiative(sourceId,targetId) { const s=stateRef.current;if(!s)return;const entries=[...s.combat.entries];const from=entries.findIndex(e=>e.id===sourceId),to=entries.findIndex(e=>e.id===targetId);if(from<0||to<0||from===to)return;const [moved]=entries.splice(from,1);entries.splice(to,0,moved);const ordered=entries.map((e,i)=>({...e,sortOrder:i}));if(isSupabaseConfigured&&campaignId!=="demo")await Promise.all(ordered.map(e=>supabase.from("initiative_entries").update({sort_order:e.sortOrder}).eq("id",e.id).then(({error})=>{if(error)throw error;})));setState(current=>current?{...current,combat:{...current.combat,entries:ordered}}:current);},
    async duplicateToken(tokenId) { const s=stateRef.current;if(!s||!isDmRole(s.role))return;const token=s.tokens.find(t=>t.id===tokenId);if(!token)return;let referenceId=token.referenceId;let copiedMonster=null;const monster=s.monsterInstances.find(m=>m.id===token.referenceId);if(monster){referenceId=crypto.randomUUID();copiedMonster={...monster,id:referenceId,customName:`${monster.customName} copy`};if(isSupabaseConfigured&&campaignId!=="demo"){const {error}=await supabase.from("monster_instances").insert({id:referenceId,campaign_id:monster.campaignId,template_id:monster.templateId,custom_name:copiedMonster.customName,current_hp:monster.currentHp,max_hp:monster.maxHp,ac:monster.ac,conditions:monster.conditions,visible:monster.visible,notes:monster.notes,dead:monster.dead});if(error)throw error;}}const duplicate={...token,id:crypto.randomUUID(),referenceId,displayName:monster?copiedMonster!.customName:`${token.displayName} copy`,x:token.x+s.scene.gridSize,y:token.y+s.scene.gridSize};if(isSupabaseConfigured&&campaignId!=="demo"){const {error}=await supabase.from("tokens").insert({id:duplicate.id,scene_id:duplicate.sceneId,reference_id:duplicate.referenceId,owner_user_id:duplicate.ownerUserId,type:duplicate.type,display_name:duplicate.displayName,image_url:duplicate.imageUrl,x:duplicate.x,y:duplicate.y,size:duplicate.size,rotation:duplicate.rotation,visible:duplicate.visible,locked:duplicate.locked,conditions:duplicate.conditions});if(error)throw error;}setState(current=>current?{...current,tokens:[...current.tokens,duplicate],monsterInstances:copiedMonster?[...current.monsterInstances,copiedMonster]:current.monsterInstances}:current);},
    async addOverlay(file) { const s = stateRef.current; if (!s) return; const overlay = await tabletopService.addOverlay(s.scene.id, s.campaign.id, file); setState((current) => current ? { ...current, overlays: [...current.overlays, overlay] } : current); },
    async patchOverlay(id, patch) { await tabletopService.updateOverlay(id, patch); setState((s) => s ? { ...s, overlays: s.overlays.map((o) => o.id === id ? { ...o, ...patch } : o) } : s); },
    async addFog(tool, points) { const s = stateRef.current; if (!s) return; const region: FogRegion = { id: crypto.randomUUID(), sceneId: s.scene.id, mode: tool.startsWith("REVEAL") ? "REVEAL" : "HIDE", shape: tool.endsWith("RECT") ? "RECT" : "BRUSH", points }; await tabletopService.addFogRegion(region); setState((current) => current ? { ...current, fogRegions: [...current.fogRegions, region] } : current); },
    async resetFog(covered) { const s = stateRef.current; if (!s) return; await tabletopService.resetFog(s.scene.id, covered); setState((current) => current ? { ...current, scene: { ...current.scene, fogCovered: covered }, fogRegions: [] } : current); },
    reload,
  }), [campaignId, reload]);
  return <TabletopContext.Provider value={{ state, loading, error, playerView, actions }}>{children}</TabletopContext.Provider>;
}
export function useTabletop() { const value = useContext(TabletopContext); if (!value) throw new Error("useTabletop must be inside TabletopProvider"); return value; }
