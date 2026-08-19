import { animate, stagger } from "animejs";
import { Dices, Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DiceRoll } from "../../domain/types";
import { useTabletop } from "../../contexts/TabletopContext";

const DICE = [4, 6, 8, 10, 12, 20, 100];

export function DiceRoller() {
  const { state, actions } = useTabletop();
  const [open, setOpen] = useState(false);
  const [sides, setSides] = useState(20);
  const [quantity, setQuantity] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [activeRoll, setActiveRoll] = useState<DiceRoll | null>(null);
  const [settled, setSettled] = useState(false);
  const diceRefs = useRef<HTMLSpanElement[]>([]);
  useEffect(() => {
    if (!activeRoll) return;
    const dice = diceRefs.current.filter(Boolean);
    if (!dice.length) return;
    setSettled(false);
    const motion = animate(dice, {
      y: [{ to: -22, duration: 250, ease: "outQuad" }, { to: 0, duration: 480, ease: "outBounce" }],
      rotate: { from: "-1turn" },
      scale: [{ to: 1.1, duration: 220 }, { to: 1, duration: 510 }],
      delay: stagger(15, { from: "center" }),
      ease: "out(4)",
    });
    void motion.then(() => { setSettled(true); setRolling(false); });
    return () => { motion.pause(); };
  }, [activeRoll]);
  if (!state) return null;
  const roll = async () => {
    setRolling(true);
    setSettled(false);
    setActiveRoll(null);
    try { setActiveRoll(await actions.rollDice(sides, quantity)); } catch (error) { console.error("Dice roll failed", error); setRolling(false); }
  };
  const visibleHistory = activeRoll && !settled ? state.diceRolls.filter((entry) => entry.id !== activeRoll.id) : state.diceRolls;
  const critical = activeRoll?.sides === 20 && activeRoll.quantity === 1 && settled ? activeRoll.results[0] : null;
  return <aside className={`dice-roller ${open ? "open" : ""}`}>
    {open && <div className="dice-popover">
      <div className="dice-title"><span><Dices />Dice roller</span><button onClick={() => setOpen(false)} aria-label="Close dice roller"><X /></button></div>
      <div className="dice-types">{DICE.map((value) => <button key={value} className={sides === value ? "active" : ""} onClick={() => setSides(value)}>d{value}</button>)}</div>
      <div className="dice-quantity"><span>Quantity</span><div><button onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity"><Minus /></button><b>{quantity}</b><button onClick={() => setQuantity((value) => Math.min(20, value + 1))} aria-label="Increase quantity"><Plus /></button></div></div>
      <button className="dice-roll-action" disabled={rolling} onClick={() => void roll()}>{rolling ? "ROLLING…" : `ROLL ${quantity}d${sides}`}</button>
      {activeRoll && <section className="dice-result" aria-live="polite">
        <div className="dice-result-header"><small>{settled ? `${activeRoll.quantity}d${activeRoll.sides} RESULT` : "THE FATES ARE ROLLING"}</small>{settled && <strong>{activeRoll.total}</strong>}</div>
        <div className={`dice-tray ${activeRoll.results.length > 8 ? "many" : ""}`}>
          {activeRoll.results.map((result, index) => <span key={`${activeRoll.id}-${index}`} ref={(element) => { if (element) diceRefs.current[index] = element; }} className={`visual-die d${activeRoll.sides} ${settled ? "settled" : "rolling"} ${critical === 20 ? "nat-twenty" : critical === 1 ? "nat-one" : ""}`} aria-label={settled ? `d${activeRoll.sides}: ${result}` : `Rolling d${activeRoll.sides}`}><i>{settled ? result : "?"}</i></span>)}
        </div>
        {settled && <p>{activeRoll.quantity}d{activeRoll.sides}: {activeRoll.results.join(" + ")} = <b>{activeRoll.total}</b></p>}
      </section>}
      <div className="dice-history"><small>RECENT VISIBLE ROLLS</small>{visibleHistory.length ? visibleHistory.map((entry) => <div key={entry.id}><b>{entry.rollerRole === "PLAYER" ? entry.rollerDisplayName ?? "Adventurer" : "DM"}</b><span>{entry.quantity}d{entry.sides}: {entry.results.join(" + ")} = <strong>{entry.total}</strong></span></div>) : <p>No rolls yet.</p>}</div>
    </div>}
    <button className="dice-fab" onClick={() => setOpen(!open)} aria-label="Open dice roller" title="Dice roller"><Dices /></button>
  </aside>;
}
