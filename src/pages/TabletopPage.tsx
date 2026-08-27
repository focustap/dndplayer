import { ChevronRight, Layers3, ScrollText, X } from "lucide-react";
import { useState } from "react";
import { isDmRole, type SceneDiscoverable } from "../domain/types";
import { TabletopProvider, useTabletop } from "../contexts/TabletopContext";
import { MapCanvas } from "../features/map/MapCanvas";
import { CreatureInspector } from "../features/tabletop/CreatureInspector";
import { DMToolbar } from "../features/tabletop/DMToolbar";
import { EncounterPanel } from "../features/tabletop/EncounterPanel";
import { InitiativeBar } from "../features/tabletop/InitiativeBar";
import { DiceRoller } from "../features/tabletop/DiceRoller";
import { PlayerCreatureCard } from "../features/tabletop/PlayerCreatureCard";
import { CinematicControls } from "../features/tabletop/CinematicControls";
import { CinematicLayer } from "../features/tabletop/CinematicLayer";
import { LiveAudio } from "../features/tabletop/LiveAudio";

export function TabletopPage({ playerView = false }: { playerView?: boolean }) {
  return (
    <TabletopProvider playerView={playerView}>
      <TabletopSurface playerView={playerView} />
    </TabletopProvider>
  );
}
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
function TabletopSurface({ playerView }: { playerView: boolean }) {
  const { state, loading, error, actions } = useTabletop();
  const [treasureOpen, setTreasureOpen] = useState(false);
  const [localItem, setLocalItem] = useState<SceneDiscoverable | null>(null);
  if (loading)
    return (
      <div className="table-loading">
        <span>W</span>
        <p>Opening the table…</p>
      </div>
    );
  if (error || !state)
    return (
      <div className="table-loading error">
        <span>!</span>
        <p>{error ?? "No active scene"}</p>
      </div>
    );
  const canDm = isDmRole(state.role) && !playerView;
  const viewer = state.discoveryReveal ?? localItem;
  const close = () => {
    actions.closeDiscovery();
    setLocalItem(null);
  };
  const npc = playerView
    ? state.tokenInteractions.find(
        (item) => item.tokenId === state.selectedTokenId && item.enabled,
      )
    : undefined;
  const npcToken = npc
    ? state.tokens.find((item) => item.id === npc.tokenId)
    : undefined;
  return (
    <main className={`tabletop-shell ${playerView ? "player-shell" : ""}`}>
      <InitiativeBar />
      <LiveAudio />
      {!playerView && <EncounterPanel />}
      <section className="map-stage">
        <MapCanvas />
        {canDm && (
          <label className="dm-scene-picker">
            <span>DM SCENE</span>
            <select
              value={state.scene.id}
              onChange={(event) =>
                void actions.activateScene(event.target.value)
              }
            >
              {state.scenes.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  {scene.name}
                  {scene.active ? " · Live" : ""}
                  {scene.revealed ? "" : " · Hidden"}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          className="party-treasure-button"
          onClick={() => setTreasureOpen((value) => !value)}
        >
          <ScrollText />
          Party Treasure <b>{state.treasure.length}</b>
        </button>
        {treasureOpen && (
          <aside className="party-treasure">
            <header>
              <span>
                <ScrollText />
                Party Treasure
              </span>
              <button onClick={() => setTreasureOpen(false)}>
                <X />
              </button>
            </header>
            {state.treasure.length ? (
              state.treasure.map((item) => (
                <button key={item.id} onClick={() => setLocalItem(item)}>
                  <img src={item.imageUrl ?? ""} alt="" />
                  <span>
                    {item.name}
                    <small>Discovered clue</small>
                  </span>
                </button>
              ))
            ) : (
              <p>No discoveries yet.</p>
            )}
          </aside>
        )}
        <div className="scene-chip">
          <Layers3 />
          <span>
            <small>ACTIVE IMAGE SCENE</small>
            {state.scene.name}
          </span>
          <ChevronRight />
        </div>
        <div className="map-hint">
          Space + drag to pan <span>•</span> Scroll to zoom{" "}
          {playerView ? "" : "• Shift for creature intel"}
        </div>
        {!playerView && <DMToolbar />}
      </section>
      <CreatureInspector />
      {canDm && <CinematicControls />}
      <DiceRoller />
      {playerView && (
        <>
          <PlayerCreatureCard />
          <div className="player-legend">
            <span>
              <i className="online" />
              Connected
            </span>
            <span>Drag your token to move</span>
          </div>
        </>
      )}
      <CinematicLayer
        event={state.cinematicEvent}
        dreadActive={state.dreadActive}
        onFinished={actions.finishCinematic}
      />
      {npc && (
        <div
          className="discovery-viewer"
          role="button"
          tabIndex={0}
          onClick={(event) => {
            if (event.target === event.currentTarget) actions.selectToken(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Enter" || event.key === " ") actions.selectToken(null);
          }}
        >
          <section
            className="npc-interaction-modal"
            role="dialog"
            aria-modal="true"
          >
            <button onClick={() => actions.selectToken(null)}>
              <X />
            </button>
            {npcToken?.imageUrl && <img src={npcToken.imageUrl} alt="" />}
            <small>INTERACT</small>
            <h2>{npc.displayName || npcToken?.displayName}</h2>
            {(npc.type === "DIALOGUE" || npc.type === "BOTH") && (
              <p>{npc.dialogueText}</p>
            )}
            {(npc.type === "SHOP" || npc.type === "BOTH") && (
              <div className="npc-shop">
                {npc.shopItems.map((item) => (
                  <article key={item.id}>
                    <b>{item.name}</b>
                    <span>{item.priceGp} gp</span>
                    <p>{item.description}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      {viewer && (
        <div
          className="discovery-viewer"
          role="button"
          tabIndex={0}
          onClick={close}
          onKeyDown={(event) => {
            if (
              event.key === "Escape" ||
              event.key === "Enter" ||
              event.key === " "
            )
              close();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <button onClick={close}>
              <X />
            </button>
            <small>
              {state.discoveryReveal ? "PARTY DISCOVERY" : "PARTY TREASURE"}
            </small>
            <h2>{viewer.name}</h2>
            {viewer.imageUrl ? (
              <img src={viewer.imageUrl} alt={viewer.name} />
            ) : (
              <p>Preparing this discovery…</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
/* eslint-enable jsx-a11y/no-noninteractive-element-interactions */
