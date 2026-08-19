import { ChevronRight, Eye, EyeOff, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { CONDITION_OPTIONS, isDmRole, type AttackPreset, type MonsterAction, type MonsterTemplate } from "../../domain/types";
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
    <div className="stat-trio"><Stat label="ARMOR" value={String(ac)} /><Stat label="SPEED" value={`${speed} ft`} /><Stat label="SIZE" value={monster?.template?.creatureSize ?? `${token.size}×`} /></div>
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
    {monster?.template && <MonsterMechanics template={monster.template} notes={monster.notes} />}
  </aside>;
}

function MonsterMechanics({ template, notes }: { template: MonsterTemplate; notes: string }) {
  const movement = Object.entries(template.movement).filter(([kind, value]) => kind !== "hover" && value).map(([kind, value]) => `${kind === "walk" ? "Walk" : kind[0].toUpperCase() + kind.slice(1)} ${value} ft`);
  if (template.movement.hover) movement.push("Hover");
  const defenses = [["VULNERABLE", template.damageVulnerabilities], ["RESIST", template.damageResistances], ["IMMUNE", template.damageImmunities], ["CONDITION IMMUNE", template.conditionImmunities]].filter(([, values]) => values.length) as [string, string[]][];
  return <>
    <p className="section-label">{template.creatureSize.toUpperCase()} {template.creatureType.toUpperCase()}</p>
    <div className="mechanics-facts"><span><small>HP FORMULA</small><b>{template.hpFormula ?? "—"}</b></span><span><small>INITIATIVE</small><b>{template.initiative.modifier === null ? "—" : `${template.initiative.modifier >= 0 ? "+" : ""}${template.initiative.modifier}`}</b></span><span><small>PASSIVE</small><b>{template.passivePerception ?? "—"}</b></span></div>
    <p className="section-label">ABILITIES</p>
    <div className="abilities">{Object.entries(template.abilities).map(([ability, value]) => <span key={ability}><small>{ability.toUpperCase()}</small><b>{value}</b></span>)}</div>
    {(movement.length || Object.keys(template.savingThrows).length || Object.keys(template.skills).length || defenses.length || template.senses.length || template.languages.length) && <section className="monster-reference">
      {movement.length > 0 && <p><b>Movement</b>{movement.join(" · ")}</p>}
      {Object.keys(template.savingThrows).length > 0 && <p><b>Saves</b>{formatBonuses(template.savingThrows)}</p>}
      {Object.keys(template.skills).length > 0 && <p><b>Skills</b>{formatBonuses(template.skills)}</p>}
      {defenses.map(([label, values]) => <p key={label}><b>{label}</b>{values.join(", ")}</p>)}
      {template.senses.length > 0 && <p><b>Senses</b>{template.senses.map((sense) => `${sense.name}${sense.range ? ` ${sense.range} ${sense.unit ?? "ft"}` : ""}`).join(", ")}</p>}
      {template.languages.length > 0 && <p><b>Languages</b>{template.languages.join(", ")}</p>}
    </section>}
    <ActionSection title="TRAITS" actions={template.traits} />
    <ActionSection title="ACTIONS" actions={template.actions} />
    <ActionSection title="BONUS ACTIONS" actions={template.bonusActions} />
    <ActionSection title="REACTIONS" actions={template.reactions} />
    <ActionSection title={template.legendaryActionUses ? `LEGENDARY ACTIONS · ${template.legendaryActionUses} USES` : "LEGENDARY ACTIONS"} actions={template.legendaryActions} />
    {template.spellcasting.length > 0 && <section className="monster-reference"><p><b>Spellcasting</b>{template.spellcasting.map((spellcasting) => `${spellcasting.ability ?? ""}${spellcasting.saveDc ? ` · DC ${spellcasting.saveDc}` : ""}${spellcasting.attackBonus ? ` · +${spellcasting.attackBonus} to hit` : ""}`).join(" · ")}</p>{template.spellcasting.flatMap((spellcasting) => spellcasting.spells).map((entry) => <p key={entry.frequency}><b>{entry.frequency}</b>{entry.spells.join(", ")}</p>)}</section>}
    {notes && <><p className="section-label">DM NOTES</p><p className="dm-notes">{notes}</p></>}
  </>;
}

function ActionSection({ title, actions }: { title: string; actions: MonsterAction[] }) {
  if (!actions.length) return null;
  return <><p className="section-label">{title}</p>{actions.map((action, index) => <details className="action-row" key={`${title}-${action.name}-${index}`}><summary><span><b>{action.name}</b><small>{actionSummary(action)}</small></span><ChevronRight /></summary><p>{action.description}</p>{action.variants?.map((variant, variantIndex) => <details className="action-variant" key={`${variant.name}-${variantIndex}`}><summary>{variant.name}</summary><p>{variant.description}</p></details>)}</details>)}</>;
}

function actionSummary(action: MonsterAction) {
  const parts = [action.attackBonus === null || action.attackBonus === undefined ? null : `${action.attackBonus >= 0 ? "+" : ""}${action.attackBonus} to hit`, action.save ? `DC ${action.save.dc} ${action.save.ability}` : null, action.damage?.map((damage) => `${damage.dice} ${damage.damageType}`).join(" + "), action.usage?.kind === "RECHARGE" ? `Recharge ${action.usage.value}` : action.usage?.uses ? `${action.usage.uses}/day` : null].filter(Boolean);
  return parts.join(" · ") || action.description;
}

function formatBonuses(values: Record<string, number>) { return Object.entries(values).map(([name, bonus]) => `${name} ${bonus >= 0 ? "+" : ""}${bonus}`).join(", "); }

function Stat({ label, value }: { label: string; value: string }) { return <div><small>{label}</small><b>{value}</b></div>; }
function DirectHp({ current, max, onSave }: { current: number; max: number; onSave(current: number, max: number): void }) {
  const [newCurrent, setCurrent] = useState(String(current));
  const [newMax, setMax] = useState(String(max));
  return <div className="direct-hp"><label>Current<input value={newCurrent} onChange={(event) => setCurrent(event.target.value)} /></label><label>Max<input value={newMax} onChange={(event) => setMax(event.target.value)} /></label><button onClick={() => onSave(Number(newCurrent), Number(newMax))}>Save</button></div>;
}
