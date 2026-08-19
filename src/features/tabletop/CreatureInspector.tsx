import { ChevronRight, Eye, EyeOff, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { CONDITION_OPTIONS, isDmRole, type AttackPreset } from "../../domain/types";
import { useTabletop } from "../../contexts/TabletopContext";
import { useAuth } from "../../contexts/AuthContext";

export function CreatureInspector() {
  const { state } = useTabletop();
  const token = state?.tokens.find((item) => item.id === state.selectedTokenId);
  if (!state) return null;
  if (!token) return <aside className="inspector-panel empty-inspector"><div className="empty-mark">W</div><h2>Select a creature</h2><p>Combat details appear here without covering the map.</p><small>SHIFT</small><span>Hold for map intel</span></aside>;
  return <InspectorContent key={token.id} tokenId={token.id} />;
}

function InspectorContent({ tokenId }: { tokenId: string }) {
  const { state, actions } = useTabletop();
  const { user } = useAuth();
  const [amount, setAmount] = useState("8");
  const [editing, setEditing] = useState(false);
  const [conditionOpen, setConditionOpen] = useState(false);
  const [attackPreset, setAttackPreset] = useState<AttackPreset>("MELEE");
  const input = useRef<HTMLInputElement>(null);
  const token = state?.tokens.find((item) => item.id === tokenId);
  const monster = state?.monsterInstances.find((item) => item.id === token?.referenceId);
  const character = state?.characters.find((item) => item.id === token?.referenceId);
  if (!state || !token) return null;

  const dm = isDmRole(state.role);
  const canAnimate = dm || (token.type === "PLAYER" && token.ownerUserId === user?.id);
  const current = monster?.currentHp ?? character?.currentHp ?? 0;
  const max = monster?.maxHp ?? character?.maxHp ?? 1;
  const ac = monster?.ac ?? character?.ac ?? 0;
  const speed = monster?.template?.speed ?? character?.speed ?? 0;
  const apply = async (mode: "DAMAGE" | "HEAL") => {
    const value = Number(amount);
    if (!monster || !Number.isFinite(value)) return;
    await actions.adjustHp(monster.id, value, mode);
    setAmount("");
    requestAnimationFrame(() => input.current?.focus());
  };

  return <aside className="inspector-panel">
    <div className="inspector-head">
      <div className={`portrait ${token.type === "PLAYER" ? "hero" : ""}`}>{token.displayName[0]}</div>
      <div><small>{token.type} · {token.visible ? "VISIBLE" : "HIDDEN"}</small><h2>{token.displayName}</h2><p>{monster?.template?.name ?? "Player character"}</p></div>
      <button onClick={() => void actions.patchToken(token.id, { visible: !token.visible })} aria-label="Toggle visibility">{token.visible ? <Eye /> : <EyeOff />}</button>
      {dm && <button className="danger" onClick={() => { if (confirm(`Delete ${token.displayName} from this scene?`)) void actions.deleteToken(token.id); }} aria-label={`Delete ${token.displayName}`} title="Delete token"><Trash2 /></button>}
    </div>
    {canAnimate && <section className="attack-controls"><small>ATTACK ANIMATION</small><div>{(["MELEE", "RANGED", "SPELL"] as AttackPreset[]).map((preset) => <button className={attackPreset === preset ? "active" : ""} key={preset} onClick={() => setAttackPreset(preset)}>{preset}</button>)}</div><button className="attack-start" onClick={() => void actions.startAttack(token.id, attackPreset)}>{state.attackSelection?.attackerTokenId === token.id ? "Choose a target on the map" : "Animate attack"}</button></section>}
    <div className="stat-trio"><Stat label="ARMOR" value={String(ac)} /><Stat label="SPEED" value={`${speed} ft`} /><Stat label="SIZE" value={`${token.size}×`} /></div>
    <section className="hp-card">
      <div className="hp-title"><span>HIT POINTS</span><strong>{current} <i>/ {max}</i></strong></div>
      <div className="hp-track"><i style={{ width: `${Math.max(0, Math.min(100, current / max * 100))}%` }} /></div>
      {monster && <>
        <label>Amount<input ref={input} value={amount} onChange={(event) => setAmount(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void apply("DAMAGE"); }} inputMode="numeric" aria-label="HP amount" /></label>
        <div className="hp-actions"><button onClick={() => void apply("DAMAGE")}>DAMAGE</button><button onClick={() => void apply("HEAL")}>HEAL</button></div>
        <button className="direct-edit-toggle" onClick={() => setEditing(!editing)}><RotateCcw />Direct HP edit</button>
        {editing && <DirectHp current={current} max={max} onSave={(newCurrent, newMax) => void actions.setHp(monster.id, newCurrent, newMax)} />}
      </>}
    </section>
    <p className="section-label">CONDITIONS</p>
    <div className="condition-list">
      {(monster?.conditions ?? character?.conditions ?? []).map((condition) => <button key={condition} onClick={() => monster && void actions.toggleCondition(monster.id, condition)}>{condition}<X /></button>)}
      {monster && <button onClick={() => setConditionOpen(!conditionOpen)}><Plus />Add</button>}
    </div>
    {conditionOpen && monster && <div className="condition-picker">{CONDITION_OPTIONS.filter((condition) => !monster.conditions.includes(condition)).map((condition) => <button key={condition} onClick={() => { void actions.toggleCondition(monster.id, condition); setConditionOpen(false); }}>{condition}</button>)}</div>}
    {monster?.template && <>
      <p className="section-label">ABILITIES</p>
      <div className="abilities">{Object.entries(monster.template.abilities).map(([ability, value]) => <span key={ability}><small>{ability.toUpperCase()}</small><b>{value}</b></span>)}</div>
      <p className="section-label">TRAITS & ACTIONS</p>
      {[...monster.template.traits, ...monster.template.actions, ...monster.template.bonusActions, ...monster.template.reactions].map((action) => <details className="action-row" key={action.name}><summary><span><b>{action.name}</b><small>{action.attackBonus ? `+${action.attackBonus} to hit · ${action.damageExpression} ${action.damageType}` : action.description}</small></span><ChevronRight /></summary><p>{action.description}</p></details>)}
      {monster.notes && <><p className="section-label">DM NOTES</p><p className="dm-notes">{monster.notes}</p></>}
    </>}
  </aside>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div><small>{label}</small><b>{value}</b></div>; }
function DirectHp({ current, max, onSave }: { current: number; max: number; onSave(current: number, max: number): void }) {
  const [newCurrent, setCurrent] = useState(String(current));
  const [newMax, setMax] = useState(String(max));
  return <div className="direct-hp"><label>Current<input value={newCurrent} onChange={(event) => setCurrent(event.target.value)} /></label><label>Max<input value={newMax} onChange={(event) => setMax(event.target.value)} /></label><button onClick={() => onSave(Number(newCurrent), Number(newMax))}>Save</button></div>;
}
