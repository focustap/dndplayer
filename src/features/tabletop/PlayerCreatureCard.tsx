import { X } from "lucide-react";
import { useTabletop } from "../../contexts/TabletopContext";

export function PlayerCreatureCard() {
  const { state, actions } = useTabletop();
  const token = state?.tokens.find((item) => item.id === state.selectedTokenId);
  if (!token || token.type === "PLAYER") return null;
  return <aside className="player-creature-card" aria-label={`${token.displayName} creature information`}>
    <button onClick={() => actions.selectToken(null)} aria-label="Close creature information"><X /></button>
    <div className="player-creature-portrait" style={token.imageUrl ? { backgroundImage: `url(${token.imageUrl})` } : undefined}>{!token.imageUrl && token.displayName[0]}</div>
    <div><small>CREATURE</small><h2>{token.displayName}</h2></div>
  </aside>;
}
