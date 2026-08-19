import { ChevronDown, ChevronLeft, ChevronRight, Cloud, LogOut, MoreHorizontal, Play, Swords, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTabletop } from "../../contexts/TabletopContext";

export function InitiativeBar() {
  const { state, actions, playerView } = useTabletop();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [score, setScore] = useState("10");
  if (!state) return null;
  const entries = state.combat.entries;
  const selected = state.tokens.find((token) => token.id === state.selectedTokenId);

  return <header className="initiative-bar live initiative-redesign">
    <Link to={`/campaign/${state.campaign.id}`} className="brand-mark"><span>W</span><div><b>WAYFINDER</b><small>{playerView ? "PLAYER VIEW" : state.scene.name}</small></div></Link>
    <div className="round-control"><small>ROUND</small><strong>{String(state.combat.round).padStart(2, "0")}</strong></div>
    {!playerView && <button className="turn-arrow" onClick={() => void actions.nextTurn(-1)} aria-label="Previous turn"><ChevronLeft /></button>}
    <div className="turn-list portrait-turn-list" aria-label="Turn order">
      {entries.length ? entries.map((entry, index) => {
        const token = state.tokens.find((item) => item.id === entry.tokenId) ?? state.tokens.find((item) => item.referenceId === entry.monsterInstanceId) ?? state.tokens.find((item) => item.referenceId === entry.characterId);
        const monster = state.monsterInstances.find((item) => item.id === (entry.monsterInstanceId ?? token?.referenceId));
        const character = state.characters.find((item) => item.id === (entry.characterId ?? token?.referenceId));
        const player = token?.type === "PLAYER" || Boolean(character);
        const dead = monster?.dead || character?.currentHp === 0;
        const conditions = token?.conditions ?? monster?.conditions ?? character?.conditions ?? [];
        const current = index === state.combat.currentIndex;
        const selectEntry = () => actions.selectToken(token?.id ?? null);
        return <div className={`turn-wrap portrait-turn-wrap ${current ? "current" : ""} ${player ? "player" : "monster"} ${dead ? "dead" : ""}`} key={entry.id} draggable={!playerView} onDragStart={() => setDragging(entry.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragging) void actions.reorderInitiative(dragging, entry.id); setDragging(null); }}>
          <button className="turn-card portrait-turn-card" onClick={() => { selectEntry(); if (entry.groupCount > 1) setExpanded(expanded === entry.id ? null : entry.id); }} aria-label={`Select ${entry.name}`}>
            <span className="initiative-portrait" style={token?.imageUrl || entry.imageUrl ? { backgroundImage: `url(${token?.imageUrl ?? entry.imageUrl})` } : undefined}>{!(token?.imageUrl || entry.imageUrl) && entry.name[0]}</span>
            <b className="initiative-badge">{entry.initiative}</b>
            <span className="turn-name"><strong>{entry.name}{entry.groupCount > 1 ? ` ×${entry.groupCount}` : ""}</strong><small>{player ? "HERO" : "CREATURE"}{conditions.length ? ` · ${conditions.join(", ")}` : ""}</small></span>
            {entry.groupCount > 1 && <ChevronDown />}
          </button>
          {expanded === entry.id && <div className="initiative-group"><b>Group combatants</b>{state.monsterInstances.filter((item) => item.templateId === entry.groupKey).map((item) => <button key={item.id} onClick={() => actions.selectToken(state.tokens.find((token) => token.referenceId === item.id)?.id ?? null)}><span>{item.customName}</span><small>{item.currentHp} / {item.maxHp} HP</small></button>)}</div>}
        </div>;
      }) : <div className="empty-initiative"><Swords /><span><b>No active combat</b><small>{playerView ? "Waiting for the DM" : "Add a creature to begin"}</small></span></div>}
    </div>
    {!playerView && <button className="turn-arrow primary" onClick={() => void actions.nextTurn(1)} aria-label="Next turn"><ChevronRight /></button>}
    <div className={`sync-state ${state.connected ? "" : "demo"}`}><Cloud />{state.connected ? "LIVE" : "DEMO"}</div>
    {!playerView && <div className="combat-menu-wrap"><button className="top-more" title="Combat options" onClick={() => setMenu(!menu)}><MoreHorizontal /></button>{menu && <div className="combat-menu"><div><b>Combat control</b><button onClick={() => setMenu(false)}><X /></button></div>{!state.combat.active ? <button onClick={() => void actions.startCombat()}><Play />Start combat</button> : <button className="danger" onClick={() => void actions.endCombat()}><X />End combat</button>}{selected && <form onSubmit={(event) => { event.preventDefault(); void actions.addToInitiative(selected.id, Number(score)); }}><label>Selected creature<span>{selected.displayName}</span></label><div><input value={score} onChange={(event) => setScore(event.target.value)} inputMode="numeric" /><button>Add</button><button type="button" onClick={() => setScore(String(Math.floor(Math.random() * 20) + 1))}>Roll</button></div></form>}<p>Drag turn portraits to reorder.</p>{entries.map((entry) => <button className="remove-entry" key={entry.id} onClick={() => void actions.removeInitiative(entry.id)}><span>{entry.name}</span><Trash2 /></button>)}</div>}</div>}
    {playerView && <Link className="leave-table" to={`/campaign/${state.campaign.id}`}><LogOut />Leave</Link>}
  </header>;
}
