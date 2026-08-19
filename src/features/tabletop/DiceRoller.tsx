import { Dices, Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { useTabletop } from "../../contexts/TabletopContext";

const DICE = [4, 6, 8, 10, 12, 20, 100];

export function DiceRoller() {
  const { state, actions } = useTabletop();
  const [open, setOpen] = useState(false);
  const [sides, setSides] = useState(20);
  const [quantity, setQuantity] = useState(1);
  const [rolling, setRolling] = useState(false);
  if (!state) return null;
  const roll = async () => { setRolling(true); try { await actions.rollDice(sides, quantity); } finally { setRolling(false); } };
  return <aside className={`dice-roller ${open ? "open" : ""}`}>
    {open && <div className="dice-popover">
      <div className="dice-title"><span><Dices />Dice roller</span><button onClick={() => setOpen(false)} aria-label="Close dice roller"><X /></button></div>
      <div className="dice-types">{DICE.map((value) => <button key={value} className={sides === value ? "active" : ""} onClick={() => setSides(value)}>d{value}</button>)}</div>
      <div className="dice-quantity"><span>Quantity</span><div><button onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity"><Minus /></button><b>{quantity}</b><button onClick={() => setQuantity((value) => Math.min(20, value + 1))} aria-label="Increase quantity"><Plus /></button></div></div>
      <button className="dice-roll-action" disabled={rolling} onClick={() => void roll()}>{rolling ? "ROLLING…" : `ROLL ${quantity}d${sides}`}</button>
      <div className="dice-history"><small>RECENT VISIBLE ROLLS</small>{state.diceRolls.length ? state.diceRolls.map((entry) => <div key={entry.id}><b>{entry.rollerUserId === state.campaign.ownerId ? "DM" : entry.rollerRole === "PLAYER" ? "PLAYER" : "DM"}</b><span>{entry.quantity}d{entry.sides}: {entry.results.join(" + ")} = <strong>{entry.total}</strong></span></div>) : <p>No rolls yet.</p>}</div>
    </div>}
    <button className="dice-fab" onClick={() => setOpen(!open)} aria-label="Open dice roller" title="Dice roller"><Dices /></button>
  </aside>;
}
