import { useEffect, useMemo, useRef, useState } from "react";
import { SceneEngine } from "./SceneEngine";
import { useTabletop } from "../../contexts/TabletopContext";
import { isDmRole } from "../../domain/types";
import { TokenContextMenu } from "../tabletop/TokenContextMenu";

export function MapCanvas() {
  const hostRef=useRef<HTMLDivElement>(null); const engineRef=useRef<SceneEngine|null>(null); const {state,playerView,actions}=useTabletop(); const [menu,setMenu]=useState<{id:string;x:number;y:number}|null>(null);
  useEffect(()=>{if(!hostRef.current)return;const engine=new SceneEngine(hostRef.current,{onSelect:actions.selectToken,onMoveLocal:actions.moveTokenLocal,onMoveCommit:(id,x,y)=>void actions.commitTokenMove(id,x,y),onOverlayCommit:(id,x,y)=>void actions.patchOverlay(id,{x,y}),onFogCommit:(tool,points)=>void actions.addFog(tool,points),onContext:(id,x,y)=>setMenu({id,x,y})});engineRef.current=engine;void engine.init();return()=>engine.destroy();},[actions]);
  const snapshot=useMemo(()=>{if(!state)return null;const canDm=isDmRole(state.role);return{scene:state.scene,overlays:state.overlays,tokens:state.tokens,fogRegions:state.fogRegions,canDm,playerView:playerView||state.previewPlayerView,shiftIntel:state.shiftIntel,activeFogTool:state.activeFogTool,selectedTokenId:state.selectedTokenId,monsterIntel:Object.fromEntries(state.monsterInstances.map(m=>[m.id,{hp:m.currentHp,maxHp:m.maxHp,ac:m.ac}])),canMove:(token:typeof state.tokens[number])=>!state.activeFogTool&&!token.locked&&(canDm||(token.type==="PLAYER"&&token.ownerUserId==="demo-user"))};},[state,playerView]);
  useEffect(()=>{if(snapshot)void engineRef.current?.render(snapshot);},[snapshot]);
  useEffect(()=>{const down=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.matches("input,textarea,select,[contenteditable=true]"))return;if(e.code==="Space"){e.preventDefault();engineRef.current?.setSpaceDown(true);}if(e.key==="Shift")actions.setShiftIntel(true);if(e.key==="Escape")actions.selectToken(null);if(e.key==="Delete"&&state?.selectedTokenId&&isDmRole(state.role))void actions.deleteToken(state.selectedTokenId);};const up=(e:KeyboardEvent)=>{if(e.code==="Space")engineRef.current?.setSpaceDown(false);if(e.key==="Shift")actions.setShiftIntel(false);};window.addEventListener("keydown",down);window.addEventListener("keyup",up);return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);};},[actions,state]);
  return <div className="map-canvas" ref={hostRef} onContextMenu={(e)=>e.preventDefault()}>{menu&&state&&<TokenContextMenu tokenId={menu.id} x={menu.x} y={menu.y} onClose={()=>setMenu(null)}/>}</div>;
}
