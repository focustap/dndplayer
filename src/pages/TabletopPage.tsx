import { ChevronRight, Layers3 } from "lucide-react";
import { isDmRole } from "../domain/types";
import { TabletopProvider, useTabletop } from "../contexts/TabletopContext";
import { MapCanvas } from "../features/map/MapCanvas";
import { CreatureInspector } from "../features/tabletop/CreatureInspector";
import { DMToolbar } from "../features/tabletop/DMToolbar";
import { EncounterPanel } from "../features/tabletop/EncounterPanel";
import { InitiativeBar } from "../features/tabletop/InitiativeBar";
import { DiceRoller } from "../features/tabletop/DiceRoller";
import { PlayerCreatureCard } from "../features/tabletop/PlayerCreatureCard";
import { CinematicControls } from "../features/tabletop/CinematicControls";
import { CinematicLayer } from "../features/tabletop/CinematicLayer";

export function TabletopPage({playerView=false}:{playerView?:boolean}){return <TabletopProvider playerView={playerView}><TabletopSurface playerView={playerView}/></TabletopProvider>}
function TabletopSurface({playerView}:{playerView:boolean}){const {state,loading,error,actions}=useTabletop();if(loading)return <div className="table-loading"><span>W</span><p>Opening the table…</p></div>;if(error||!state)return <div className="table-loading error"><span>!</span><p>{error??"No active scene"}</p></div>;const canDm=isDmRole(state.role)&&!playerView;return <main className={`tabletop-shell ${playerView?"player-shell":""}`}><InitiativeBar/>{!playerView&&<EncounterPanel/>}<section className="map-stage"><MapCanvas/>{canDm&&<label className="dm-scene-picker"><span>DM SCENE</span><select value={state.scene.id} onChange={event=>void actions.activateScene(event.target.value)}>{state.scenes.map(scene=><option key={scene.id} value={scene.id}>{scene.name}{scene.active?" · Live":""}{scene.revealed?"":" · Hidden"}</option>)}</select></label>}<div className="scene-chip"><Layers3/><span><small>ACTIVE IMAGE SCENE</small>{state.scene.name}</span><ChevronRight/></div><div className="map-hint">Space + drag to pan <span>•</span> Scroll to zoom {playerView?"":"• Shift for creature intel"}</div></section><CreatureInspector/>{!playerView&&<DMToolbar/>}{canDm&&<CinematicControls/>}<DiceRoller/>{playerView&&<><PlayerCreatureCard/><div className="player-legend"><span><i className="online"/>Connected</span><span>Drag your token to move</span></div></>}<CinematicLayer event={state.cinematicEvent} onFinished={actions.finishCinematic}/></main>}
