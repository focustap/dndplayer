import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Trash2, X } from "lucide-react";
import { SceneEngine } from "./SceneEngine";
import { useTabletop } from "../../contexts/TabletopContext";
import { useAuth } from "../../contexts/AuthContext";
import { isDmRole } from "../../domain/types";
import { TokenContextMenu } from "../tabletop/TokenContextMenu";

export function MapCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SceneEngine | null>(null);
  const { state, playerView, builder, actions } = useTabletop();
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const { user } = useAuth();
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const engine = new SceneEngine(hostRef.current, {
      onSelect: (id, additive) => actions.selectToken(id, additive),
      onSelectMany: (ids, additive) => actions.selectTokens(ids, additive),
      onMoveCommit: (id, x, y) => void actions.commitTokenMove(id, x, y),
      onTokenMove: (id, x, y, final) => actions.broadcastTokenMove(id, x, y, final),
      onInteract: (id) => {
        if (builder) actions.previewNpcInteraction(id);
        else {
          actions.selectToken(id);
          void actions.interactWithNpc(id);
        }
      },
      onOverlayCommit: (id, x, y) => void actions.patchOverlay(id, { x, y }),
      onSceneLinkCommit: (id, x, y) => void actions.updateSceneLink(id, { x, y }),
      onDiscoverableCommit: (id, x, y) => void actions.patchDiscoverable(id, { x, y }),
      onPatrolWaypointAdd: (x, y) => {
        const current = stateRef.current;
        const patrol = current?.patrols.find((item) => item.tokenId === current.patrolEditTokenId);
        if (patrol) void actions.patchPatrol(patrol.id, { waypoints: [...patrol.waypoints, { id: crypto.randomUUID(), x, y }] });
      },
      onPatrolWaypointMove: (waypointId, x, y) => {
        const current = stateRef.current;
        const patrol = current?.patrols.find((item) => item.tokenId === current.patrolEditTokenId);
        if (patrol) void actions.patchPatrol(patrol.id, { waypoints: patrol.waypoints.map((point) => point.id === waypointId ? { ...point, x, y } : point) });
      },
      onPatrolWaypointDelete: (waypointId) => {
        const current = stateRef.current;
        const patrol = current?.patrols.find((item) => item.tokenId === current.patrolEditTokenId);
        if (patrol) void actions.patchPatrol(patrol.id, { waypoints: patrol.waypoints.filter((point) => point.id !== waypointId) });
      },
      onSceneLinkActivate: (id) => void actions.travelSceneLink(id),
      onDiscover: (id) => void actions.discover(id),
      onDiscoverablePreview: (id) => actions.previewDiscoverable(id),
      onPlace: (x, y) => void actions.placeToken(x, y),
      onAttackTarget: (id) => void actions.targetAttack(id),
      onContext: (id, x, y) => setMenu({ id, x, y }),
    });
    engineRef.current = engine;
    void engine.init();
    return () => engine.destroy();
  }, [actions, builder]);

  const snapshot = useMemo(() => {
    if (!state) return null;
    const effectivePlayerView = playerView || state.previewPlayerView;
    const canDm = isDmRole(state.role) && !effectivePlayerView;
    return {
      scene: state.scene,
      scenes: state.scenes,
      sceneLinks: state.sceneLinks,
      discoverables: state.discoverables,
      overlays: state.overlays,
      zoneMarkers: state.zoneMarkers,
      tokens: state.tokens,
      transientTokenIds: state.transientTokenIds,
      motionSegments: state.motionSegments,
      canDm,
      playerView: effectivePlayerView,
      builder,
      shiftIntel: state.shiftIntel,
      placement: state.placement,
      patrolEdit: state.patrols.find((item) => item.tokenId === state.patrolEditTokenId) ?? null,
      attackSelection: state.attackSelection,
      attackEvent: state.attackEvent,
      cinematicEvent: state.cinematicEvent,
      selectedTokenId: state.selectedTokenId,
      selectedTokenIds: state.selectedTokenIds,
      monsterIntel: Object.fromEntries(state.monsterInstances.map((m) => [m.id, { hp: m.currentHp, maxHp: m.maxHp, ac: m.ac }])),
      canInteract: (token: typeof state.tokens[number]) =>
        !canDm &&
        (token.type === "NPC" || token.type === "MONSTER") &&
        state.tokenInteractions.some((item) => item.tokenId === token.id && item.enabled),
      canMove: (token: typeof state.tokens[number]) =>
        !state.placement &&
        !state.attackSelection &&
        !token.locked &&
        (canDm || (token.type === "PLAYER" && token.ownerUserId === user?.id)),
    };
  }, [state, playerView, builder, user?.id]);

  useEffect(() => {
    if (snapshot) void engineRef.current?.render(snapshot);
  }, [snapshot]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.matches("input,textarea,select,[contenteditable=true]")) return;
      if (e.code === "Space") {
        e.preventDefault();
        engineRef.current?.setSpaceDown(true);
      }
      if (e.key === "Shift") actions.setShiftIntel(true);
      if (e.key === "Escape") {
        actions.cancelPlacement();
        actions.cancelAttack();
        actions.selectToken(null);
      }
      if (e.key === "Delete" && state && isDmRole(state.role)) {
        const ids = state.selectedTokenIds.length
          ? state.selectedTokenIds
          : state.selectedTokenId
            ? [state.selectedTokenId]
            : [];
        if (ids.length) void Promise.all(ids.map((id) => actions.deleteToken(id)));
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") engineRef.current?.setSpaceDown(false);
      if (e.key === "Shift") actions.setShiftIntel(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [actions, state]);

  const effectiveCanDm = Boolean(state && isDmRole(state.role) && !(playerView || state.previewPlayerView));
  const selectedIds = state?.selectedTokenIds ?? [];
  const selectedTokens = state?.tokens.filter((token) => selectedIds.includes(token.id)) ?? [];
  const patchSelected = (visible: boolean) => {
    if (!selectedIds.length) return;
    void Promise.all(selectedIds.map((id) => actions.patchToken(id, { visible })));
  };
  const deleteSelected = () => {
    if (!selectedIds.length) return;
    if (!confirm(`Delete ${selectedIds.length} selected tokens from this scene?`)) return;
    void Promise.all(selectedIds.map((id) => actions.deleteToken(id)));
  };

  return (
    <div className="map-canvas" ref={hostRef} onContextMenu={(e) => e.preventDefault()}>
      {state?.attackSelection && (
        <div className="attack-target-hint">
          <b>{state.attackSelection.preset.replaceAll("_", " ")}</b> ready · click a target token
          <button onClick={actions.cancelAttack}>Cancel</button>
        </div>
      )}
      {effectiveCanDm && selectedIds.length > 1 && (
        <div className="multi-token-toolbar">
          <strong>{selectedIds.length} TOKENS</strong>
          <button onClick={() => patchSelected(false)} title="Hide all selected tokens"><EyeOff />Hide</button>
          <button onClick={() => patchSelected(true)} title="Reveal all selected tokens"><Eye />Show</button>
          <button className="danger" onClick={deleteSelected} title="Delete all selected tokens"><Trash2 />Delete</button>
          <button className="icon-only" onClick={() => actions.selectToken(null)} title="Clear selection"><X /></button>
          <small>{selectedTokens.filter((token) => !token.visible).length} hidden · drag any selected token to move the group</small>
        </div>
      )}
      {menu && state && <TokenContextMenu tokenId={menu.id} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
    </div>
  );
}
