import { Clapperboard, Crosshair, Flashlight, Gauge, ShieldAlert, Undo2 } from "lucide-react";
import { useState } from "react";
import { useTabletop } from "../../contexts/TabletopContext";
import type { CinematicEvent } from "../../domain/types";

export function CinematicControls() {
  const { state, actions } = useTabletop();
  const [open, setOpen] = useState(false);
  if (!state) return null;
  const selected = state.selectedTokenId ? state.tokens.find((token) => token.id === state.selectedTokenId) : null;
  const play = (name: string, duration: number, steps: CinematicEvent["steps"]) => void actions.triggerCinematic(name, duration, steps);
  const focusSelected = selected ? [{ at: 0, duration: 900, type: "CAMERA_FOCUS_TOKEN" as const, tokenId: selected.id, zoom: 1.38, persistCamera: true }] : [];
  const impactSelected = selected ? [{ at: 0, duration: 420, type: "IMPACT" as const, tokenId: selected.id }] : [];
  const bossSteps = (revealToken: boolean): CinematicEvent["steps"] => selected ? [
    { at: 0, duration: 6500, type: "LOCK_INTERACTION" },
    { at: 0, duration: 650, type: "UI_FADE_OUT" },
    { at: 100, duration: 5600, type: "DARKEN", intensity: .58 },
    { at: 180, duration: 5400, type: "VIGNETTE", intensity: .82 },
    { at: 280, duration: 1200, type: "LETTERBOX", intensity: .72 },
    { at: 430, duration: 1700, type: "CAMERA_FOCUS_TOKEN", tokenId: selected.id, zoom: 1.45, persistCamera: true },
    ...(revealToken ? [{ at: 100, duration: 1320, type: "TOKEN_FADE_IN" as const, tokenId: selected.id }] : []),
    { at: 2640, duration: 620, type: "MAP_SHAKE", intensity: .82 },
    { at: 2760, duration: 460, type: "IMPACT", tokenId: selected.id },
    { at: 3160, duration: 1900, type: "TITLE", text: "A THREAT EMERGES" },
    { at: 5200, duration: 1000, type: "DARKEN", intensity: .18 },
    { at: 5350, duration: 900, type: "VIGNETTE", intensity: .25 },
    { at: 5650, duration: 650, type: "UI_FADE_IN" },
  ] : [];
  const powerSurge: CinematicEvent["steps"] = selected ? [
    { at: 0, duration: 1100, type: "LETTERBOX", intensity: .52 },
    { at: 0, duration: 1100, type: "TOKEN_GLOW", tokenId: selected.id, color: "#b699ff", intensity: .9 },
    { at: 80, duration: 720, type: "TOKEN_PULSE", tokenId: selected.id },
    { at: 480, duration: 360, type: "FLASH", color: "#d9ccff" },
    { at: 510, duration: 460, type: "IMPACT", tokenId: selected.id },
  ] : [];

  const playBossEntrance = async () => {
    if (!selected) return;
    const revealToken = !selected.visible;
    if (revealToken) await actions.patchToken(selected.id, { visible: true });
    await actions.triggerCinematic("Boss entrance", 6600, bossSteps(revealToken));
  };

  return <div className="cinematic-controls">
    <button className={open ? "active" : ""} onClick={() => setOpen((value) => !value)} title="Cinematic effects"><Clapperboard /><span>Cinematics</span></button>
    {open && <div className="cinematic-controls-menu">
      <div className="popover-title"><span><Clapperboard />Cinematic effects</span><button onClick={() => setOpen(false)}>×</button></div>
      <p>Visual effects sync to everyone viewing this campaign.</p>
      <div className="cinematic-action-grid">
        <button onClick={() => play("Light shake", 750, [{ at: 0, duration: 680, type: "SCREEN_SHAKE", intensity: .28 }])}><Gauge />Light shake</button>
        <button onClick={() => play("Heavy shake", 900, [{ at: 0, duration: 820, type: "SCREEN_SHAKE", intensity: .9 }, { at: 0, duration: 820, type: "MAP_SHAKE", intensity: .85 }])}><ShieldAlert />Heavy shake</button>
        <button onClick={() => play("Flash", 420, [{ at: 0, duration: 360, type: "FLASH", color: "#fff3c5" }])}><Flashlight />Flash</button>
        <button disabled={!selected} onClick={() => selected && play("Focus selected token", 1000, focusSelected)}><Crosshair />Focus selected</button>
        <button disabled={!selected} onClick={() => selected && play("Token impact", 560, impactSelected)}><Crosshair />Token impact</button>
        <button className="cinematic-dread" onClick={() => play("Dread", 1800, [{ at: 0, duration: 1600, type: "LETTERBOX", intensity: .78 }, { at: 0, duration: 1600, type: "DARKEN", intensity: .48 }, { at: 80, duration: 1520, type: "VIGNETTE", intensity: .82 }, { at: 260, duration: 920, type: "SCREEN_SHAKE", intensity: .17 }])}><ShieldAlert />Dread</button>
        <button className="cinematic-blood" onClick={() => play("Blood pulse", 1100, [{ at: 0, duration: 1020, type: "LETTERBOX", intensity: .55 }, { at: 0, duration: 1020, type: "COLOR_WASH", color: "#a61522", intensity: .62 }, { at: 80, duration: 780, type: "SCREEN_SHAKE", intensity: .32 }, { at: 180, duration: 280, type: "FLASH", color: "#e25555" }])}><Flashlight />Blood pulse</button>
        <button disabled={!selected} className="cinematic-power" onClick={() => selected && play("Power surge", 1200, powerSurge)}><Crosshair />Power surge</button>
        <button disabled={!selected} className="boss-entrance" onClick={() => void playBossEntrance()}><Clapperboard />Boss entrance demo</button>
      </div>
      <button className="cinematic-restore" onClick={actions.cancelCinematic}><Undo2 />Cancel / restore</button>
    </div>}
  </div>;
}
