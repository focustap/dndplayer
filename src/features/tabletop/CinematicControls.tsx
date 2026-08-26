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
  const selectedStep = (type: "CAMERA_FOCUS_TOKEN" | "IMPACT", duration: number) => selected ? [{ at: 0, duration, type, tokenId: selected.id, zoom: 1.38 }] as CinematicEvent["steps"] : [];
  const bossSteps: CinematicEvent["steps"] = selected ? [
    { at: 0, duration: 6050, type: "LOCK_INTERACTION" },
    { at: 0, duration: 650, type: "UI_FADE_OUT" },
    { at: 120, duration: 5200, type: "DARKEN", intensity: .64 },
    { at: 180, duration: 5200, type: "VIGNETTE", intensity: .92 },
    { at: 430, duration: 1800, type: "CAMERA_FOCUS_TOKEN", tokenId: selected.id, zoom: 1.45 },
    { at: 1180, duration: 240, type: "TOKEN_FADE", tokenId: selected.id },
    { at: 1430, duration: 1350, type: "TOKEN_RISE", tokenId: selected.id },
    { at: 2750, duration: 560, type: "MAP_SHAKE", intensity: 1 },
    { at: 2830, duration: 420, type: "IMPACT", tokenId: selected.id },
    { at: 3300, duration: 1800, type: "TITLE", text: "A THREAT EMERGES" },
    { at: 5400, duration: 650, type: "UI_FADE_IN" },
  ] : [];
  return <div className="cinematic-controls">
    <button className={open ? "active" : ""} onClick={() => setOpen((value) => !value)} title="Cinematic effects"><Clapperboard /><span>Cinematics</span></button>
    {open && <div className="cinematic-controls-menu">
      <div className="popover-title"><span><Clapperboard />Cinematic effects</span><button onClick={() => setOpen(false)}>×</button></div>
      <p>Visual effects sync to everyone viewing this campaign.</p>
      <div className="cinematic-action-grid">
        <button onClick={() => play("Light shake", 750, [{ at: 0, duration: 680, type: "SCREEN_SHAKE", intensity: .28 }])}><Gauge />Light shake</button>
        <button onClick={() => play("Heavy shake", 900, [{ at: 0, duration: 820, type: "SCREEN_SHAKE", intensity: .9 }, { at: 0, duration: 820, type: "MAP_SHAKE", intensity: .85 }])}><ShieldAlert />Heavy shake</button>
        <button onClick={() => play("Flash", 420, [{ at: 0, duration: 360, type: "FLASH", color: "#fff3c5" }])}><Flashlight />Flash</button>
        <button disabled={!selected} onClick={() => selected && play("Focus selected token", 1000, selectedStep("CAMERA_FOCUS_TOKEN", 900))}><Crosshair />Focus selected</button>
        <button disabled={!selected} onClick={() => selected && play("Token impact", 560, selectedStep("IMPACT", 420))}><Crosshair />Token impact</button>
        <button disabled={!selected} className="boss-entrance" onClick={() => selected && play("Boss entrance", 6200, bossSteps)}><Clapperboard />Boss entrance demo</button>
      </div>
      <button className="cinematic-restore" onClick={() => play("Restore", 100, [])}><Undo2 />Cancel / restore</button>
    </div>}
  </div>;
}
