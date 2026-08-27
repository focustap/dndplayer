import { Eye, EyeOff, Grid3X3, ImagePlus, Layers3, Lock, MousePointer2, Trash2, Unlock, X } from "lucide-react";
import { useRef, useState } from "react";
import { useTabletop } from "../../contexts/TabletopContext";

export function DMToolbar() {
  const { state, actions, builder } = useTabletop();
  const [panel, setPanel] = useState<"grid" | "layers" | null>(null);
  const [gridSize, setGridSize] = useState(80);
  const input = useRef<HTMLInputElement>(null);
  if (!state) return null;

  const commitGrid = (size = gridSize) => void actions.updateSceneGrid("SQUARE", size);

  return <>
    <nav className="dm-toolbar" aria-label="DM tools">
      {builder&&<><button className="active" title="Select" onClick={() => setPanel(null)}><MousePointer2 /></button>
      <button className={panel === "grid" ? "active" : ""} title="Grid settings" onClick={() => { if (panel !== "grid") setGridSize(state.scene.gridSize); setPanel(panel === "grid" ? null : "grid"); }}><Grid3X3 /></button>
      <button className={panel === "layers" ? "active" : ""} title="Scene layers" onClick={() => setPanel(panel === "layers" ? null : "layers")}><Layers3 /></button>
      <span /></>}
      <button className={state.previewPlayerView ? "active" : ""} title="Preview player view" onClick={actions.togglePlayerPreview}><Eye /></button>
    </nav>
    {state.previewPlayerView && <div className="player-preview-badge"><Eye />PREVIEWING PLAYER VIEW<button onClick={actions.togglePlayerPreview}><X /></button></div>}
    {builder&&panel === "grid" && <div className="tool-popover grid-popover">
      <div className="popover-title"><span><Grid3X3 />Grid settings</span><button onClick={() => setPanel(null)}><X /></button></div>
      <label className="grid-toggle"><input type="checkbox" checked={state.scene.gridType === "SQUARE"} onChange={event => void actions.updateSceneGrid(event.target.checked ? "SQUARE" : "GRIDLESS", gridSize)} />Show square grid</label>
      {state.scene.gridType === "SQUARE" && <label className="grid-size"><span>Cell size <b>{gridSize}px</b></span><input type="range" min="20" max="240" step="4" value={gridSize} onChange={event => setGridSize(Number(event.target.value))} onPointerUp={event => commitGrid(Number(event.currentTarget.value))} onKeyUp={event => { if (event.key.startsWith("Arrow")) commitGrid(Number(event.currentTarget.value)); }} /></label>}
      <p>Grid settings are saved to this scene for everyone at the table.</p>
    </div>}
    {builder&&panel === "layers" && <div className="tool-popover layers-popover">
      <div className="popover-title"><span><Layers3 />Scene layers</span><button onClick={() => setPanel(null)}><X /></button></div>
      <button className="upload-overlay" onClick={() => input.current?.click()}><ImagePlus /><span><b>Add image overlay</b><small>PNG, JPEG, or WebP</small></span></button>
      <input ref={input} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) void actions.addOverlay(file); event.target.value = ""; }} />
      {state.overlays.map(overlay => <div className="overlay-row" key={overlay.id}>
        <span className={overlay.kind.toLowerCase()}>{overlay.kind[0]}</span><div><b>{overlay.name}</b><small>{Math.round(overlay.width)} × {Math.round(overlay.height)} · {Math.round(overlay.rotation * 180 / Math.PI)}°</small></div>
        <button title={overlay.visible ? "Hide" : "Show"} onClick={() => void actions.patchOverlay(overlay.id, { visible: !overlay.visible })}>{overlay.visible ? <Eye /> : <EyeOff />}</button>
        <button title={overlay.locked ? "Unlock" : "Lock"} onClick={() => void actions.patchOverlay(overlay.id, { locked: !overlay.locked })}>{overlay.locked ? <Lock /> : <Unlock />}</button>
        <button className="danger" title={`Delete ${overlay.name}`} aria-label={`Delete ${overlay.name}`} onClick={() => { if (confirm(`Delete ${overlay.name}? This removes it from the scene and deletes its uploaded asset.`)) void actions.deleteOverlay(overlay.id); }}><Trash2 /></button>
        <div className="overlay-controls"><label>Scale<input type="range" min="60" max="500" value={overlay.width} onChange={event => { const width = Number(event.target.value); void actions.patchOverlay(overlay.id, { width, height: width * .72 }); }} /></label><label>Rotate<input type="range" min="-180" max="180" value={Math.round(overlay.rotation * 180 / Math.PI)} onChange={event => void actions.patchOverlay(overlay.id, { rotation: Number(event.target.value) * Math.PI / 180 })} /></label></div>
      </div>)}
    </div>}
  </>;
}
