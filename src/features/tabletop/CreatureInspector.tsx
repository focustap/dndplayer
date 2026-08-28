import { ChevronRight, Eye, EyeOff, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";
import { CONDITION_OPTIONS, isDmRole, type AbilityScores, type AttackPreset, type Character, type MonsterAction, type MonsterInstance, type MonsterTemplate } from "../../domain/types";
import { useTabletop } from "../../contexts/TabletopContext";
import { useAuth } from "../../contexts/AuthContext";

export function CreatureInspector() {
  const { state } = useTabletop();
  const { user } = useAuth();
  const token = state?.tokens.find((item) => item.id === state.selectedTokenId);
  if (!state) return null;
  if (!isDmRole(state.role) && (!token || token.type !== "PLAYER" || token.ownerUserId !== user?.id)) return null;
  if (!token) return <aside className="inspector-panel empty-inspector"><div className="empty-mark">W</div><h2>Select a creature</h2><p>Combat details appear here without covering the map.</p><small>SHIFT</small><span>Hold for map intel</span></aside>;
  return <InspectorContent key={token.id} tokenId={token.id} />;
}

function InspectorContent({ tokenId }: { tokenId: string }) {
  const { state, actions } = useTabletop();
  const { user } = useAuth();
  const token = state?.tokens.find((item) => item.id === tokenId);
  const [amount, setAmount] = useState("8");
  const [editing, setEditing] = useState(false);
  const [conditionOpen, setConditionOpen] = useState(false);
  const [attackPreset, setAttackPreset] = useState<AttackPreset>(token?.type === "PLAYER" ? "SNEAK_ATTACK" : "MELEE");
  const [attackColor, setAttackColor] = useState("#8d7cff");
  const input = useRef<HTMLInputElement>(null);
  const monster = state?.monsterInstances.find((item) => item.id === token?.referenceId);
  const character = state?.characters.find((item) => item.id === token?.referenceId);
  const npcTemplate = token?.type === "NPC"
    ? state?.npcTemplates.find((item) => item.id === token.referenceId)
    : undefined;
  if (!state || !token) return null;

  const portraitUrl =
    token.imageUrl ??
    character?.imageUrl ??
    monster?.template?.imageUrl ??
    npcTemplate?.imageUrl ??
    null;
  const inspectorKind = monster?.template?.name ?? (token.type === "MONSTER" ? "Monster" : token.type === "NPC" ? "NPC" : "Player character");
  const dm = isDmRole(state.role);
  const canCharacterEdit = Boolean(character && (dm || character.ownerId === user?.id));
  const canAnimate = dm || (token.type === "PLAYER" && token.ownerUserId === user?.id);
  const current = monster?.currentHp ?? character?.currentHp ?? 0;
  const max = monster?.maxHp ?? character?.maxHp ?? 1;
  const ac = monster?.ac ?? character?.ac ?? 0;
  const speed = monster?.template?.speed ?? character?.speed ?? 0;
  const apply = async (mode: "DAMAGE" | "HEAL") => {
    const value = Number(amount);
    if (!Number.isFinite(value)) return;
    if (monster) await actions.adjustHp(monster.id, value, mode);
    else if (character && canCharacterEdit) await actions.adjustCharacterHp(character.id, value, mode);
    else return;
    setAmount("");
    requestAnimationFrame(() => input.current?.focus());
  };

  return <aside className="inspector-panel">
    <div className="inspector-head">
      <div className={`portrait ${token.type === "PLAYER" ? "hero" : ""}`}>
        {portraitUrl ? <img src={portraitUrl} alt="" /> : token.displayName[0]}
      </div>
      <div><small>{token.type} · {token.visible ? "VISIBLE" : "HIDDEN"}</small><h2>{token.displayName}</h2><p>{inspectorKind}</p></div>
      {dm && <button onClick={() => void actions.patchToken(token.id, { visible: !token.visible })} aria-label="Toggle visibility">{token.visible ? <Eye /> : <EyeOff />}</button>}
      {dm && <button className="danger" onClick={() => { if (confirm(`Delete ${token.displayName} from this scene?`)) void actions.deleteToken(token.id); }} aria-label={`Delete ${token.displayName}`} title="Delete token"><Trash2 /></button>}
    </div>
    {canAnimate && <section className={`attack-controls ${token.type==="PLAYER"?"signature-attacks":""}`}>
      <small>ATTACK ANIMATION</small>
      <div>{([["MELEE","Melee"],["RANGED","Ranged"],["SPELL","Spell"]] as [AttackPreset,string][]).map(([preset,label]) => <button className={attackPreset === preset ? "active" : ""} key={preset} onClick={() => setAttackPreset(preset)}>{label}</button>)}</div>
      {token.type==="PLAYER"&&<>
        <small className="attack-subhead">SIGNATURE ANIMATION</small>
        <div className="signature-grid">{([["SNEAK_ATTACK","Sneak"],["SMITE","Smite"],["DRUID","Druid"],["WIZARD","Wizard"]] as [AttackPreset,string][]).map(([preset,label]) => <button className={attackPreset === preset ? "active" : ""} key={preset} onClick={() => setAttackPreset(preset)}>{label}</button>)}</div>
      </>}
      {token.type==="PLAYER"&&attackPreset==="WIZARD"&&<div className="wizard-color-row" aria-label="Wizard spell color">
        {["#8d7cff","#4aa8ff","#5ce1e6","#67d17a","#ff5f63","#ff9a45","#f5f2ff"].map(color=><button key={color} type="button" className={attackColor===color?"active":""} style={{"--spell-color":color} as CSSProperties} onClick={()=>setAttackColor(color)} aria-label={`Use ${color} spell color`}/>)}
      </div>}
      <button className="attack-start" onClick={() => void actions.startAttack(token.id, attackPreset, attackPreset==="WIZARD"?attackColor:null)}>{state.attackSelection?.attackerTokenId === token.id ? "Choose a target on the map" : attackPreset==="SNEAK_ATTACK"||attackPreset==="SMITE"||attackPreset==="DRUID"||attackPreset==="WIZARD"?"Animate ability":"Animate attack"}</button>
    </section>}
    <div className="stat-trio"><Stat label="ARMOR" value={String(ac)} /><Stat label="SPEED" value={`${speed} ft`} /><Stat label="SIZE" value={monster?.template?.creatureSize ? `${monster.template.creatureSize} · ${token.size}×` : `${token.size}×`} /></div>
    {dm && <label className="form-field token-size-control">
      <span>TOKEN SIZE ON MAP</span>
      <select value={String(token.size)} onChange={(event) => void actions.patchToken(token.id, { size: Number(event.target.value) })}>
        <option value="0.8">Tiny · 0.8×</option>
        <option value="1">Small / Medium · 1×</option>
        <option value="2">Large · 2×</option>
        <option value="3">Huge · 3×</option>
        <option value="4">Gargantuan · 4×</option>
      </select>
      <small>Changes only this token's map footprint.</small>
    </label>}
    {character && <CharacterAbilityScores character={character} canEdit={canCharacterEdit} onSave={(abilities) => void actions.setCharacterAbilities(character.id, abilities)} />}
    <section className="hp-card">
      <div className="hp-title"><span>HIT POINTS</span><strong>{current} <i>/ {max}</i></strong></div>
      {character && character.tempHp > 0 && <div className="temp-hp">TEMP HP <b>+{character.tempHp}</b></div>}
      <div className="hp-track"><i style={{ width: `${Math.max(0, Math.min(100, current / max * 100))}%` }} /></div>
      {monster && <>
        <label>Amount<input ref={input} value={amount} onChange={(event) => setAmount(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void apply("DAMAGE"); }} inputMode="numeric" aria-label="HP amount" /></label>
        <div className="hp-actions"><button onClick={() => void apply("DAMAGE")}>DAMAGE</button><button onClick={() => void apply("HEAL")}>HEAL</button></div>
        <button className="direct-edit-toggle" onClick={() => setEditing(!editing)}><RotateCcw />Direct HP edit</button>
        {editing && <DirectHp current={current} max={max} onSave={(newCurrent, newMax) => void actions.setHp(monster.id, newCurrent, newMax)} />}
      </>}
      {character && canCharacterEdit && <>
        <label>Amount<input ref={input} value={amount} onChange={(event) => setAmount(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void apply("DAMAGE"); }} inputMode="numeric" aria-label="HP amount" /></label>
        <div className="hp-actions"><button onClick={() => void apply("DAMAGE")}>DAMAGE</button><button onClick={() => void apply("HEAL")}>HEAL</button></div>
        <button className="direct-edit-toggle" onClick={() => setEditing(!editing)}><RotateCcw />Edit AC / HP</button>
        {editing && <DirectCharacterCombat character={character} onSave={(newCurrent, newMax, newTemp, newAc) => void actions.setCharacterCombat(character.id, newCurrent, newMax, newTemp, newAc)} />}
      </>}
    </section>
    <p className="section-label">CONDITIONS</p>
    <div className="condition-list">
      {(monster?.conditions ?? character?.conditions ?? []).map((condition) => <button key={condition} onClick={() => monster && void actions.toggleCondition(monster.id, condition)}>{condition}<X /></button>)}
      {monster && <button onClick={() => setConditionOpen(!conditionOpen)}><Plus />Add</button>}
    </div>
    {conditionOpen && monster && <div className="condition-picker">{CONDITION_OPTIONS.filter((condition) => !monster.conditions.includes(condition)).map((condition) => <button key={condition} onClick={() => { void actions.toggleCondition(monster.id, condition); setConditionOpen(false); }}>{condition}</button>)}</div>}
    {monster?.template && <MonsterMechanics monster={monster} canEdit={dm} onSaveOverrides={(hpFormulaOverride, damageDiceOverrides) => void actions.setMonsterOverrides(monster.id, hpFormulaOverride, damageDiceOverrides)} />}
  </aside>;
}

function MonsterMechanics({ monster, canEdit, onSaveOverrides }: { monster: MonsterInstance; canEdit: boolean; onSaveOverrides(hpFormulaOverride: string | null, damageDiceOverrides: Record<string, string>): void }) {
  const template = monster.template!;
  const [hpFormula, setHpFormula] = useState(monster.hpFormulaOverride ?? "");
  const [damageDice, setDamageDice] = useState<Record<string, string>>(monster.damageDiceOverrides ?? {});
  const movement = Object.entries(template.movement).filter(([kind, value]) => kind !== "hover" && value).map(([kind, value]) => `${kind === "walk" ? "Walk" : kind[0].toUpperCase() + kind.slice(1)} ${value} ft`);
  if (template.movement.hover) movement.push("Hover");
  const defenses = [["VULNERABLE", template.damageVulnerabilities], ["RESIST", template.damageResistances], ["IMMUNE", template.damageImmunities], ["CONDITION IMMUNE", template.conditionImmunities]].filter(([, values]) => values.length) as [string, string[]][];
  const actionGroups: [string, string, MonsterAction[]][] = [
    ["traits", "Traits", template.traits],
    ["actions", "Actions", template.actions],
    ["bonusActions", "Bonus actions", template.bonusActions],
    ["reactions", "Reactions", template.reactions],
    ["legendaryActions", "Legendary actions", template.legendaryActions],
  ];
  const damageRows = actionGroups.flatMap(([group, groupLabel, actions]) =>
    actions.flatMap((action, actionIndex) =>
      (action.damage ?? []).map((damage, damageIndex) => ({
        key: actionDamageKey(group, actionIndex, damageIndex),
        label: `${groupLabel} · ${action.name}${(action.damage?.length ?? 0) > 1 ? ` · Damage ${damageIndex + 1}` : ""}`,
        baseDice: damage.dice,
      })),
    ),
  );
  const saveOverrides = () => onSaveOverrides(hpFormula.trim() || null, damageDice);
  const resetOverrides = () => {
    setHpFormula("");
    setDamageDice({});
    onSaveOverrides(null, {});
  };
  return <>
    <p className="section-label">{template.creatureSize.toUpperCase()} {template.creatureType.toUpperCase()}</p>
    <div className="mechanics-facts"><span><small>HP FORMULA</small><b>{monster.hpFormulaOverride ?? template.hpFormula ?? "—"}</b></span><span><small>INITIATIVE</small><b>{template.initiative.modifier === null ? "—" : `${template.initiative.modifier >= 0 ? "+" : ""}${template.initiative.modifier}`}</b></span><span><small>PASSIVE</small><b>{template.passivePerception ?? "—"}</b></span></div>
    {canEdit && <section className="monster-instance-overrides">
      <p className="section-label">INSTANCE OVERRIDES</p>
      <p className="dm-notes">Only this placed monster changes. Duplicating its token copies these values; the Bestiary template stays untouched.</p>
      <div className="direct-hp monster-override-fields">
        <label>Hit dice<input value={hpFormula} placeholder={template.hpFormula ?? "e.g. 4d10 + 8"} onChange={(event) => setHpFormula(event.target.value)} /></label>
        {damageRows.map((row) => <label key={row.key}>{row.label}<input value={damageDice[row.key] ?? ""} placeholder={row.baseDice} onChange={(event) => setDamageDice((current) => ({ ...current, [row.key]: event.target.value }))} /></label>)}
      </div>
      <div className="hp-actions"><button onClick={saveOverrides}>SAVE OVERRIDES</button><button onClick={resetOverrides}>RESET TO BESTIARY</button></div>
    </section>}
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
    <ActionSection title="TRAITS" group="traits" actions={template.traits} damageDiceOverrides={monster.damageDiceOverrides} />
    <ActionSection title="ACTIONS" group="actions" actions={template.actions} damageDiceOverrides={monster.damageDiceOverrides} />
    <ActionSection title="BONUS ACTIONS" group="bonusActions" actions={template.bonusActions} damageDiceOverrides={monster.damageDiceOverrides} />
    <ActionSection title="REACTIONS" group="reactions" actions={template.reactions} damageDiceOverrides={monster.damageDiceOverrides} />
    <ActionSection title={template.legendaryActionUses ? `LEGENDARY ACTIONS · ${template.legendaryActionUses} USES` : "LEGENDARY ACTIONS"} group="legendaryActions" actions={template.legendaryActions} damageDiceOverrides={monster.damageDiceOverrides} />
    {template.spellcasting.length > 0 && <section className="monster-reference"><p><b>Spellcasting</b>{template.spellcasting.map((spellcasting) => `${spellcasting.ability ?? ""}${spellcasting.saveDc ? ` · DC ${spellcasting.saveDc}` : ""}${spellcasting.attackBonus ? ` · +${spellcasting.attackBonus} to hit` : ""}`).join(" · ")}</p>{template.spellcasting.flatMap((spellcasting) => spellcasting.spells).map((entry) => <p key={entry.frequency}><b>{entry.frequency}</b>{entry.spells.join(", ")}</p>)}</section>}
    {monster.notes && <><p className="section-label">DM NOTES</p><p className="dm-notes">{monster.notes}</p></>}
  </>;
}

function actionDamageKey(group: string, actionIndex: number, damageIndex: number) {
  return `${group}:${actionIndex}:${damageIndex}`;
}

function withDamageOverrides(action: MonsterAction, group: string, actionIndex: number, overrides: Record<string, string>) {
  if (!action.damage?.length) return action;
  return {
    ...action,
    damage: action.damage.map((damage, damageIndex) => {
      const override = overrides[actionDamageKey(group, actionIndex, damageIndex)]?.trim();
      return override ? { ...damage, dice: override } : damage;
    }),
  };
}

type ActionRollState = {
  rolling?: boolean;
  attack?: { raw: number; bonus: number; total: number };
  damage?: { formula: string; rolls: number[]; modifier: number; total: number; damageType: string }[];
  error?: string;
};

function parseDamageFormula(formula: string, fallbackBonus: number) {
  const clean = formula.trim().replace(/\s+/g, "");
  const dice = clean.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (dice) {
    return {
      quantity: Number(dice[1] || 1),
      sides: Number(dice[2]),
      modifier: dice[3] === undefined ? fallbackBonus : Number(dice[3]),
    };
  }
  const flat = clean.match(/^[+-]?\d+$/);
  if (flat) return { quantity: 0, sides: 0, modifier: Number(clean) };
  return null;
}

function ActionSection({ title, actions, group, damageDiceOverrides }: { title: string; actions: MonsterAction[]; group: string; damageDiceOverrides: Record<string, string> }) {
  const { actions: tabletopActions } = useTabletop();
  const [rolls, setRolls] = useState<Record<number, ActionRollState>>({});
  if (!actions.length) return null;

  const rollAttack = async (index: number, action: MonsterAction) => {
    if (action.attackBonus === null || action.attackBonus === undefined) return;
    setRolls((current) => ({ ...current, [index]: { ...current[index], rolling: true, error: undefined } }));
    try {
      const roll = await tabletopActions.rollDice(20, 1);
      const raw = roll.results[0] ?? roll.total;
      setRolls((current) => ({
        ...current,
        [index]: {
          ...current[index],
          rolling: false,
          attack: { raw, bonus: action.attackBonus ?? 0, total: raw + (action.attackBonus ?? 0) },
        },
      }));
    } catch (error) {
      setRolls((current) => ({ ...current, [index]: { ...current[index], rolling: false, error: error instanceof Error ? error.message : "Attack roll failed." } }));
    }
  };

  const rollDamage = async (index: number, action: MonsterAction) => {
    if (!action.damage?.length) return;
    setRolls((current) => ({ ...current, [index]: { ...current[index], rolling: true, error: undefined } }));
    try {
      const damageResults: NonNullable<ActionRollState["damage"]> = [];
      for (const damage of action.damage) {
        const parsed = parseDamageFormula(damage.dice, damage.flatBonus ?? 0);
        if (!parsed) throw new Error(`Can't auto-roll "${damage.dice}" yet.`);
        if (parsed.quantity === 0) {
          damageResults.push({ formula: damage.dice, rolls: [], modifier: parsed.modifier, total: parsed.modifier, damageType: damage.damageType });
          continue;
        }
        const roll = await tabletopActions.rollDice(parsed.sides, parsed.quantity);
        damageResults.push({
          formula: damage.dice,
          rolls: roll.results,
          modifier: parsed.modifier,
          total: roll.total + parsed.modifier,
          damageType: damage.damageType,
        });
      }
      setRolls((current) => ({ ...current, [index]: { ...current[index], rolling: false, damage: damageResults } }));
    } catch (error) {
      setRolls((current) => ({ ...current, [index]: { ...current[index], rolling: false, error: error instanceof Error ? error.message : "Damage roll failed." } }));
    }
  };

  return <><p className="section-label">{title}</p>{actions.map((action, index) => {
    const effectiveAction = withDamageOverrides(action, group, index, damageDiceOverrides);
    const result = rolls[index];
    const attackBonus = effectiveAction.attackBonus;
    return <details className="action-row" key={`${title}-${action.name}-${index}`}>
      <summary><span><b>{action.name}</b><small>{actionSummary(effectiveAction)}</small></span><ChevronRight /></summary>
      <p>{action.description}</p>
      {(attackBonus !== null && attackBonus !== undefined || effectiveAction.damage?.length) && <div className="monster-action-roll-controls">
        {attackBonus !== null && attackBonus !== undefined && <button disabled={result?.rolling} onClick={() => void rollAttack(index, effectiveAction)}>ROLL ATTACK · d20{attackBonus >= 0 ? "+" : ""}{attackBonus}</button>}
        {effectiveAction.damage?.length ? <button disabled={result?.rolling} onClick={() => void rollDamage(index, effectiveAction)}>ROLL DAMAGE · {effectiveAction.damage.map((damage) => damage.dice).join(" + ")}</button> : null}
      </div>}
      {result?.attack && <div className={`monster-action-roll-result ${result.attack.raw === 20 ? "critical" : result.attack.raw === 1 ? "fumble" : ""}`}>
        <small>ATTACK</small><b>d20 {result.attack.raw} {result.attack.bonus >= 0 ? "+" : "−"} {Math.abs(result.attack.bonus)} = {result.attack.total}</b>
        {result.attack.raw === 20 && <em>NAT 20</em>}{result.attack.raw === 1 && <em>NAT 1</em>}
      </div>}
      {result?.damage?.map((damage, damageIndex) => <div className="monster-action-roll-result" key={`${damage.formula}-${damageIndex}`}>
        <small>{damage.damageType.toUpperCase()} DAMAGE</small>
        <b>{damage.rolls.length ? `[${damage.rolls.join(", ")}]${damage.modifier ? ` ${damage.modifier >= 0 ? "+" : "−"} ${Math.abs(damage.modifier)}` : ""}` : damage.formula} = {damage.total}</b>
      </div>)}
      {result?.error && <p className="monster-action-roll-error">{result.error}</p>}
      {action.variants?.map((variant, variantIndex) => <details className="action-variant" key={`${variant.name}-${variantIndex}`}><summary>{variant.name}</summary><p>{variant.description}</p></details>)}
    </details>;
  })}</>;
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
function DirectCharacterCombat({ character, onSave }: { character: { currentHp: number; maxHp: number; tempHp: number; ac: number }; onSave(current: number, max: number, temp: number, ac: number): void }) {
  const [current, setCurrent] = useState(String(character.currentHp)); const [max, setMax] = useState(String(character.maxHp)); const [temp, setTemp] = useState(String(character.tempHp)); const [ac, setAc] = useState(String(character.ac));
  return <div className="direct-hp character-combat-edit"><label>Current<input value={current} onChange={(event) => setCurrent(event.target.value)} /></label><label>Max<input value={max} onChange={(event) => setMax(event.target.value)} /></label><label>Temp<input value={temp} onChange={(event) => setTemp(event.target.value)} /></label><label>AC<input value={ac} onChange={(event) => setAc(event.target.value)} /></label><button onClick={() => onSave(Number(current), Number(max), Number(temp), Number(ac))}>Save</button></div>;
}
function CharacterAbilityScores({ character, canEdit, onSave }: { character: Character; canEdit: boolean; onSave(abilities: AbilityScores): void }) {
  const [draft, setDraft] = useState(character.abilities);
  const modifier = (score: number) => Math.floor((score - 10) / 2);
  const formatModifier = (score: number) => `${modifier(score) >= 0 ? "+" : ""}${modifier(score)}`;
  const change = (ability: keyof AbilityScores, value: string) => setDraft((current) => ({ ...current, [ability]: Number(value) }));
  return <section className="character-abilities">
    <p className="character-ability-title">ABILITY SCORES</p>
    <div>{(Object.entries(draft) as [keyof AbilityScores, number][]).map(([ability, score]) => <label key={ability}><small>{ability.toUpperCase()} <b>{formatModifier(score)}</b></small>{canEdit ? <input aria-label={`${ability.toUpperCase()} score`} type="number" min={1} max={30} value={score} onChange={(event) => change(ability, event.target.value)} /> : <strong>{score}</strong>}</label>)}</div>
    {canEdit && <button onClick={() => onSave(draft)}>Save ability scores</button>}
  </section>;
}
