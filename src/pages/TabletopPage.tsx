import { ChevronRight, Layers3 } from "lucide-react";
import { TabletopProvider, useTabletop } from "../contexts/TabletopContext";
import { MapCanvas } from "../features/map/MapCanvas";
import { CreatureInspector } from "../features/tabletop/CreatureInspector";
import { DMToolbar } from "../features/tabletop/DMToolbar";
import { EncounterPanel } from "../features/tabletop/EncounterPanel";
import { InitiativeBar } from "../features/tabletop/InitiativeBar";
import { DiceRoller } from "../features/tabletop/DiceRoller";

export function TabletopPage({playerView=false}:{playerView?:boolean}){return <TabletopProvider playerView={playerView}><TabletopSurface playerView={playerView}/></TabletopProvider>}
function TabletopSurface({playerView}:{playerView:boolean}){const {state,loading,error}=useTabletop();if(loading)return <div className="table-loading"><span>W</span><p>Opening the table…</p></div>;if(error||!state)return <div className="table-loading error"><span>!</span><p>{error??"No active scene"}</p></div>;return <main className={`tabletop-shell ${playerView?"player-shell":""}`}><InitiativeBar/>{!playerView&&<EncounterPanel/>}<section className="map-stage"><MapCanvas/><div className="scene-chip"><Layers3/><span><small>ACTIVE IMAGE SCENE</small>{state.scene.name}</span><ChevronRight/></div><div className="map-hint">Space + drag to pan <span>•</span> Scroll to zoom {playerView?"":"• Shift for creature intel"}</div></section>{!playerView&&<CreatureInspector/>}{!playerView&&<DMToolbar/>}<DiceRoller/>{playerView&&<div className="player-legend"><span><i className="online"/>Connected</span><span>Drag your token to move</span></div>}</main>}
