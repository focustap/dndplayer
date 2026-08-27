import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "react-router-dom";
import type {
  AttackPreset,
  Character,
  CinematicEvent,
  DiceRoll,
  GridType,
  NpcShopItem,
  Placement,
  Scene,
  SceneDiscoverable,
  SceneLink,
  SceneOverlay,
  SceneZoneMarker,
  TabletopState,
  Token,
  TokenInteraction,
  TokenMotionSegment,
  TokenPatrol,
} from "../domain/types";
import { isDmRole } from "../domain/types";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import {
  asCinematicEvent,
  asDiceRoll,
  PATROL_PRESENTATION_DELAY_MS,
  serverNowMs,
  tabletopService,
} from "../services/tabletopService";

interface TabletopActions {
  selectToken(id: string | null): void;
  setShiftIntel(value: boolean): void;
  togglePlayerPreview(): void;
  startPlacement(placement: Placement): void;
  startPlayerPlacement(characterIds: string[]): void;
  startSceneLinkPlacement(destinationSceneId: string, label: string): void;
  cancelPlacement(): void;
  startAttack(attackerTokenId: string, preset: AttackPreset, color?:string|null): Promise<void>;
  startZoneMarkerPlacement(label:string,radiusFt:number,color:string): void;
  targetAttack(targetTokenId: string | null): Promise<void>;
  cancelAttack(): void;
  triggerCinematic(
    name: string,
    duration: number,
    steps: CinematicEvent["steps"],
  ): Promise<void>;
  finishCinematic(): void;
  cancelCinematic(): void;
  rollDice(sides: number, quantity: number): Promise<DiceRoll>;
  placeToken(x: number, y: number): Promise<void>;
  updateSceneGrid(gridType: GridType, gridSize?: number): Promise<void>;
  updateScene(patch: Partial<Scene>): Promise<void>;
  activateScene(sceneId: string): Promise<void>;
  travelSceneLink(linkId: string): Promise<void>;
  updateSceneLink(
    id: string,
    patch: Partial<Pick<SceneLink, "destinationSceneId" | "label" | "x" | "y" | "musicMode" | "musicTrackId" | "musicLoop" | "musicNextTrackId" | "musicNextLoop" | "ambienceMode" | "ambienceTrackId" | "ambienceLoop">>,
  ): Promise<void>;
  deleteSceneLink(id: string): Promise<void>;
  commitTokenMove(id: string, x: number, y: number): Promise<void>;
  broadcastTokenMove(id: string, x: number, y: number, final: boolean): void;
  deleteToken(id: string): Promise<void>;
  patchToken(id: string, patch: Partial<Token>): Promise<void>;
  adjustHp(
    instanceId: string,
    amount: number,
    mode: "DAMAGE" | "HEAL",
  ): Promise<void>;
  setHp(instanceId: string, currentHp: number, maxHp: number): Promise<void>;
  adjustCharacterHp(
    characterId: string,
    amount: number,
    mode: "DAMAGE" | "HEAL",
  ): Promise<void>;
  setCharacterCombat(
    characterId: string,
    currentHp: number,
    maxHp: number,
    tempHp: number,
    ac: number,
  ): Promise<void>;
  setCharacterAbilities(
    characterId: string,
    abilities: Character["abilities"],
  ): Promise<void>;
  toggleCondition(instanceId: string, condition: string): Promise<void>;
  nextTurn(delta: 1 | -1): Promise<void>;
  startCombat(): Promise<void>;
  endCombat(): Promise<void>;
  addToInitiative(tokenId: string, initiative?: number): Promise<void>;
  removeInitiative(entryId: string): Promise<void>;
  reorderInitiative(sourceId: string, targetId: string): Promise<void>;
  duplicateToken(tokenId: string): Promise<void>;
  addOverlay(file: File): Promise<void>;
  createNpcTemplate(name: string, file: File): Promise<void>;
  deleteNpcTemplate(id: string): Promise<void>;
  patchOverlay(id: string, patch: Partial<SceneOverlay>): Promise<void>;
  deleteOverlay(id: string): Promise<void>;
  updateZoneMarker(id:string,patch:Partial<Pick<SceneZoneMarker,"label"|"x"|"y"|"radiusFt"|"color"|"opacity"|"visible">>):Promise<void>;
  deleteZoneMarker(id:string):Promise<void>;
  addDiscoverable(name: string, file: File, hidden: boolean): Promise<void>;
  patchDiscoverable(
    id: string,
    patch: Partial<Pick<SceneDiscoverable, "name" | "x" | "y" | "hidden">>,
  ): Promise<void>;
  deleteDiscoverable(id: string): Promise<void>;
  discover(id: string): Promise<void>;
  closeDiscovery(): void;
  createPatrol(tokenId: string): Promise<void>;
  patchPatrol(
    id: string,
    patch: Partial<
      Omit<
        TokenPatrol,
        "id" | "tokenId" | "sceneId" | "createdAt" | "updatedAt"
      >
    >,
  ): Promise<void>;
  deletePatrol(id: string): Promise<void>;
  setPatrolEditing(tokenId: string | null): void;
  updateTokenInteraction(
    tokenId: string,
    patch: Partial<
      Omit<TokenInteraction, "tokenId" | "campaignId" | "shopItems">
    >,
    shopItems?: Omit<NpcShopItem, "id" | "interactionId">[],
  ): Promise<void>;
  interactWithNpc(tokenId: string): Promise<void>;
  closeNpcInteraction(): void;
  reload(): Promise<void>;
}
interface TabletopValue {
  state: TabletopState | null;
  loading: boolean;
  error: string | null;
  playerView: boolean;
  builder: boolean;
  actions: TabletopActions;
}
const TabletopContext = createContext<TabletopValue | null>(null);

export function TabletopProvider({
  children,
  playerView,
  sceneId,
  builder = false,
}: {
  children: ReactNode;
  playerView: boolean;
  sceneId?: string;
  builder?: boolean;
}) {
  const { campaignId = "demo" } = useParams();
  const [state, setState] = useState<TabletopState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const patrolRole = state?.role;
  const movementChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const movementSourceId = useRef(crypto.randomUUID());
  const moveSequences = useRef(new Map<string, number>());
  const receivedSequences = useRef(new Map<string, number>());
  const reloadGeneration = useRef(0);
  const syncReloadTimer = useRef<number | null>(null);
  const patrolCheckpointing = useRef(new Set<string>());
  const patrolStarting = useRef(new Set<string>());
  const patrolResumeAt = useRef(new Map<string, number>());
  const sendTokenMovement = useCallback(
    (id: string, x: number, y: number, final: boolean) => {
      const channel = movementChannelRef.current;
      if (!channel) return;
      const sequence = (moveSequences.current.get(id) ?? 0) + 1;
      moveSequences.current.set(id, sequence);
      void channel.send({
        type: "broadcast",
        event: "token-move",
        payload: { tokenId: id, x, y, sequence, final, sourceId: movementSourceId.current },
      });
    },
    [],
  );
  const sendPatrolSegment = useCallback((segment: TokenMotionSegment) => {
    const channel = movementChannelRef.current;
    if (!channel) return;
    void channel.send({
      type: "broadcast",
      event: "patrol-segment",
      payload: segment,
    });
  }, []);
  const reload = useCallback(async () => {
    const generation = ++reloadGeneration.current;
    try {
      const next = await tabletopService.load(campaignId, playerView, sceneId);
      if (generation !== reloadGeneration.current) return;
      setState((current) => {
        if (!current) return next;
        const transient = new Set(current.transientTokenIds);
        const tokens = next.tokens.map((token) => {
          const live = current.tokens.find((item) => item.id === token.id);
          return transient.has(token.id) && live
            ? { ...token, x: live.x, y: live.y }
            : token;
        });
        return {
          ...next,
          tokens,
          transientTokenIds: [...transient].filter((id) =>
            tokens.some((token) => token.id === id),
          ),
          selectedTokenId: current.selectedTokenId,
          activeInteractionTokenId: current.activeInteractionTokenId,
          patrolEditTokenId: current.patrolEditTokenId,
          previewPlayerView: current.previewPlayerView,
          shiftIntel: current.shiftIntel,
          attackSelection: current.attackSelection,
          attackEvent: current.attackEvent,
          cinematicEvent: current.cinematicEvent,
          discoveryReveal: current.discoveryReveal,
        };
      });
      setError(null);
    } catch (e) {
      if (generation !== reloadGeneration.current) return;
      if (stateRef.current) {
        console.error("Failed to refresh tabletop; keeping current state", e);
      } else {
        setError(e instanceof Error ? e.message : "Unable to load the tabletop");
      }
    } finally {
      if (generation === reloadGeneration.current) setLoading(false);
    }
  }, [campaignId, playerView, sceneId]);
  const scheduleReload = useCallback(() => {
    if (syncReloadTimer.current !== null)
      window.clearTimeout(syncReloadTimer.current);
    syncReloadTimer.current = window.setTimeout(() => {
      syncReloadTimer.current = null;
      void reload();
    }, 220);
  }, [reload]);

  const beginPatrolSegment = useCallback(
    async (patrolId: string) => {
      if (
        patrolStarting.current.has(patrolId) ||
        patrolCheckpointing.current.has(patrolId)
      )
        return;
      const current = stateRef.current;
      const patrol = current?.patrols.find((item) => item.id === patrolId);
      if (
        !current ||
        !patrol ||
        !patrol.active ||
        patrol.waypoints.length < 2 ||
        (patrol.pauseDuringCombat && current.combat.active) ||
        (patrolResumeAt.current.get(patrolId) ?? 0) > Date.now() ||
        current.motionSegments.some(
          (segment) => segment.tokenId === patrol.tokenId && segment.active,
        )
      )
        return;

      patrolStarting.current.add(patrolId);
      try {
        const segment = await tabletopService.ensurePatrolSegment(patrol.id);
        patrolResumeAt.current.delete(patrolId);
        setState((live) =>
          live
            ? {
                ...live,
                motionSegments: [
                  ...live.motionSegments.filter(
                    (item) => item.tokenId !== patrol.tokenId,
                  ),
                  segment,
                ],
              }
            : live,
        );
        sendPatrolSegment(segment);
      } catch (error) {
        console.error("Failed to ensure patrol segment", error);
        // Patrol traffic is non-critical. Back off and retry instead of
        // replacing the entire tabletop with a fatal error screen.
        patrolResumeAt.current.set(patrolId, Date.now() + 1500);
      } finally {
        patrolStarting.current.delete(patrolId);
      }
    },
    [sendPatrolSegment],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    if (!isSupabaseConfigured || campaignId === "demo") return;
    const channel = supabase
      .channel(`campaign-sync:${campaignId}`)
      .on("broadcast", { event: "patrol-segment" }, (message) => {
        const p = message.payload as Partial<TokenMotionSegment>;
        if (
          !p.tokenId ||
          !p.sceneId ||
          !Number.isFinite(p.fromX) ||
          !Number.isFinite(p.fromY) ||
          !Number.isFinite(p.toX) ||
          !Number.isFinite(p.toY) ||
          !p.startedAt ||
          !Number.isFinite(p.durationMs) ||
          !Number.isFinite(p.revision)
        )
          return;
        const segment = p as TokenMotionSegment;
        setState((current) =>
          current && current.scene.id === segment.sceneId
            ? {
                ...current,
                motionSegments: [
                  ...current.motionSegments.filter(
                    (item) => item.tokenId !== segment.tokenId,
                  ),
                  segment,
                ],
              }
            : current,
        );
      })
      .on("broadcast", { event: "token-move" }, (message) => {
        const p = message.payload as {
          tokenId?: string;
          x?: number;
          y?: number;
          sequence?: number;
          final?: boolean;
          sourceId?: string;
        };
        if (
          !p.tokenId ||
          !Number.isFinite(p.x) ||
          !Number.isFinite(p.y) ||
          !Number.isFinite(p.sequence)
        )
          return;
        const tokenId = p.tokenId,
          sequence = p.sequence as number,
          x = p.x as number,
          y = p.y as number;
        const sourceKey = `${p.sourceId ?? "legacy"}:${tokenId}`;
        const last = receivedSequences.current.get(sourceKey) ?? -1;
        if (sequence <= last) return;
        receivedSequences.current.set(sourceKey, sequence);
        setState((current) =>
          current
            ? {
                ...current,
                tokens: current.tokens.map((token) =>
                  token.id === tokenId ? { ...token, x, y } : token,
                ),
                transientTokenIds: p.final
                  ? current.transientTokenIds.filter((id) => id !== tokenId)
                  : [...new Set([...current.transientTokenIds, tokenId])],
              }
            : current,
        );
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sync_events",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          const event = payload.new as {
            event_type?: string;
            entity_id?: string | null;
          };
          const type = event.event_type ?? "";
          const entityId = event.entity_id ?? null;
          const current = stateRef.current;

          // Patrol motion has its own lightweight realtime path. Reloading the
          // entire tabletop for every segment/start/checkpoint is extremely
          // expensive when many NPCs are moving at once.
          if (type === "token_motion_segments") return;

          if (type === "token_patrols") {
            if (playerView) return;
            const patrol = entityId
              ? current?.patrols.find((item) => item.id === entityId)
              : null;
            if (patrol?.active) return;
          }

          if (type === "tokens" && entityId) {
            const activePatrol = current?.patrols.some(
              (item) => item.tokenId === entityId && item.active,
            );
            const activeSegment = current?.motionSegments.some(
              (item) => item.tokenId === entityId && item.active,
            );
            if (activePatrol || activeSegment) return;
          }

          scheduleReload();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tabletop_animation_events",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          const event = payload.new as {
            id: string;
            campaign_id: string;
            attacker_token_id: string;
            target_token_id: string;
            preset: AttackPreset;
            color?: string | null;
            created_at: string;
          };
          setState((current) =>
            current
              ? {
                  ...current,
                  attackEvent: {
                    id: event.id,
                    campaignId: event.campaign_id,
                    attackerTokenId: event.attacker_token_id,
                    targetTokenId: event.target_token_id,
                    preset: event.preset,
                    color: event.color ?? null,
                    createdAt: event.created_at,
                  },
                }
              : current,
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tabletop_dice_rolls",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          void tabletopService
            .hydrateDiceRollerName(
              asDiceRoll(payload.new as Record<string, unknown>),
            )
            .then((roll) => {
              setState((current) =>
                current
                  ? {
                      ...current,
                      diceRolls: [
                        roll,
                        ...current.diceRolls.filter(
                          (item) => item.id !== roll.id,
                        ),
                      ].slice(0, 12),
                    }
                  : current,
              );
            });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tabletop_cinematic_events",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          const event = asCinematicEvent(
            payload.new as Record<string, unknown>,
          );
          setState((current) => {
            if (!current) return current;
            if (event.name === "Dread")
              return { ...current, dreadActive: true };
            if (event.name === "Dread off")
              return { ...current, dreadActive: false };
            return { ...current, cinematicEvent: event };
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tabletop_discovery_events",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          const id = String(
            (payload.new as Record<string, unknown>).discoverable_id,
          );
          void tabletopService
            .discover(id)
            .then((item) =>
              setState((current) =>
                current ? { ...current, discoveryReveal: item } : current,
              ),
            )
            .catch(() => void reload());
        },
      )
      .subscribe();
    movementChannelRef.current = channel;
    return () => {
      if (movementChannelRef.current === channel)
        movementChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [campaignId, playerView, reload, scheduleReload]);
  useEffect(() => {
    if (!patrolRole || !isDmRole(patrolRole)) return;
    let disposed = false;

    const drivePatrols = async () => {
      if (disposed) return;
      const current = stateRef.current;
      if (!current) return;
      const localNow = Date.now();
      const serverNow = serverNowMs();

      for (const patrol of current.patrols) {
        if (
          !patrol.active ||
          patrol.waypoints.length < 2 ||
          (patrol.pauseDuringCombat && current.combat.active) ||
          (patrolResumeAt.current.get(patrol.id) ?? 0) > localNow ||
          patrolCheckpointing.current.has(patrol.id) ||
          patrolStarting.current.has(patrol.id)
        )
          continue;

        const token = current.tokens.find((item) => item.id === patrol.tokenId);
        if (!token) continue;

        const segment = current.motionSegments.find(
          (item) => item.tokenId === token.id && item.active,
        );

        if (!segment) {
          if ((patrolResumeAt.current.get(patrol.id) ?? 0) <= localNow)
            void beginPatrolSegment(patrol.id);
          continue;
        }

        const endsAt =
          Date.parse(segment.startedAt) + Math.max(1, segment.durationMs);
        if (serverNow < endsAt + PATROL_PRESENTATION_DELAY_MS) continue;

        patrolCheckpointing.current.add(patrol.id);
        void tabletopService
          .completePatrolSegment(patrol.id, segment.revision)
          .then((updatedPatrol) => {
            if (disposed) return;
            if (updatedPatrol.active)
              patrolResumeAt.current.set(
                updatedPatrol.id,
                Date.now() + updatedPatrol.waypointPauseMs,
              );
            else patrolResumeAt.current.delete(updatedPatrol.id);

            setState((currentState) =>
              currentState
                ? {
                    ...currentState,
                    tokens: currentState.tokens.map((item) =>
                      item.id === patrol.tokenId
                        ? { ...item, x: segment.toX, y: segment.toY }
                        : item,
                    ),
                    motionSegments: currentState.motionSegments.filter(
                      (item) =>
                        !(
                          item.tokenId === patrol.tokenId &&
                          item.revision === segment.revision
                        ),
                    ),
                    patrols: currentState.patrols.map((item) =>
                      item.id === updatedPatrol.id
                        ? { ...item, ...updatedPatrol }
                        : item,
                    ),
                  }
                : currentState,
            );
          })
          .catch((error) => {
            console.error("Failed to complete patrol segment", error);
            patrolResumeAt.current.set(patrol.id, Date.now() + 1500);
          })
          .finally(() => {
            patrolCheckpointing.current.delete(patrol.id);
          });
      }
    };

    void drivePatrols();
    const interval = window.setInterval(() => void drivePatrols(), 40);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [patrolRole, beginPatrolSegment]);

  useEffect(() => () => {
    if (syncReloadTimer.current !== null) {
      window.clearTimeout(syncReloadTimer.current);
      syncReloadTimer.current = null;
    }
  }, []);

  const actions = useMemo<TabletopActions>(
    () => ({
      selectToken(id) {
        setState((s) => (s ? { ...s, selectedTokenId: id } : s));
      },
      setShiftIntel(value) {
        setState((s) => (s ? { ...s, shiftIntel: value } : s));
      },
      togglePlayerPreview() {
        setState((s) =>
          s ? { ...s, previewPlayerView: !s.previewPlayerView } : s,
        );
      },
      startPlacement(placement) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role)) return;
        setState((current) =>
          current ? { ...current, placement } : current,
        );
      },
      startPlayerPlacement(characterIds) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role)) return;
        const ids = characterIds.filter(
          (id) =>
            !s.tokens.some(
              (token) => token.type === "PLAYER" && token.referenceId === id,
            ),
        );
        if (!ids.length) return;
        setState((current) =>
          current
            ? {
                ...current,
                placement: {
                  kind: "CHARACTERS",
                  referenceIds: ids,
                  name: "Players",
                  imageUrl: null,
                },
              }
            : current,
        );
      },
      startSceneLinkPlacement(destinationSceneId, label) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role) || destinationSceneId === s.scene.id)
          return;
        setState((current) =>
          current
            ? {
                ...current,
                placement: {
                  kind: "SCENE_LINK",
                  destinationSceneId,
                  name: label.trim() || "Scene link",
                  imageUrl: null,
                },
              }
            : current,
        );
      },
      startZoneMarkerPlacement(label, radiusFt, color) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role)) return;
        setState((current) =>
          current
            ? {
                ...current,
                placement: {
                  kind: "ZONE_MARKER",
                  name: label.trim() || "Effect",
                  radiusFt: Math.max(1, Math.min(300, radiusFt)),
                  color,
                  imageUrl: null,
                },
              }
            : current,
        );
      },
      cancelPlacement() {
        setState((current) =>
          current ? { ...current, placement: null } : current,
        );
      },
      async startAttack(attackerTokenId, preset, color = null) {
        const s = stateRef.current;
        const attacker = s?.tokens.find(
          (token) => token.id === attackerTokenId,
        );
        if (!s || !attacker) return;
        if (!isDmRole(s.role)) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (attacker.type !== "PLAYER" || attacker.ownerUserId !== user?.id)
            return;
        }
        setState((current) =>
          current
            ? {
                ...current,
                attackSelection: { attackerTokenId, preset, color },
                placement: null,
              }
            : current,
        );
      },
      cancelAttack() {
        setState((current) =>
          current ? { ...current, attackSelection: null } : current,
        );
      },
      async triggerCinematic(name, duration, steps) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role)) return;
        const event = await tabletopService.triggerCinematic(
          s.campaign.id,
          name,
          duration,
          steps,
        );
        setState((current) => {
          if (!current) return current;
          if (event.name === "Dread")
            return { ...current, dreadActive: true };
          if (event.name === "Dread off")
            return { ...current, dreadActive: false };
          return { ...current, cinematicEvent: event };
        });
      },
      finishCinematic() {
        setState((current) =>
          current?.cinematicEvent
            ? {
                ...current,
                cinematicEvent: { ...current.cinematicEvent, completed: true },
              }
            : current,
        );
      },
      cancelCinematic() {
        setState((current) =>
          current ? { ...current, cinematicEvent: null } : current,
        );
      },
      async targetAttack(targetTokenId) {
        const s = stateRef.current;
        const selection = s?.attackSelection;
        if (!s || !selection) return;
        if (!targetTokenId || targetTokenId === selection.attackerTokenId) {
          setState((current) =>
            current ? { ...current, attackSelection: null } : current,
          );
          return;
        }
        const event = await tabletopService.triggerAttack(
          s.campaign.id,
          selection.attackerTokenId,
          targetTokenId,
          selection.preset,
          selection.color,
        );
        setState((current) =>
          current
            ? { ...current, attackSelection: null, attackEvent: event }
            : current,
        );
      },
      async rollDice(sides, quantity) {
        const s = stateRef.current;
        if (!s) throw new Error("No tabletop is open.");
        const roll = await tabletopService.rollDice(
          s.campaign.id,
          sides,
          quantity,
        );
        setState((current) =>
          current
            ? {
                ...current,
                diceRolls: [
                  roll,
                  ...current.diceRolls.filter((item) => item.id !== roll.id),
                ].slice(0, 12),
              }
            : current,
        );
        return roll;
      },
      async placeToken(x, y) {
        const s = stateRef.current;
        const placement = s?.placement;
        if (!s || !placement || !isDmRole(s.role)) return;
        if (placement.kind === "SCENE_LINK") {
          const link = await tabletopService.addSceneLink(
            s.scene.id,
            placement.destinationSceneId,
            placement.name,
            x,
            y,
          );
          setState((current) =>
            current
              ? {
                  ...current,
                  sceneLinks: [...current.sceneLinks, link],
                  placement: null,
                }
              : current,
          );
          return;
        }
        if (placement.kind === "ZONE_MARKER") {
          const marker = await tabletopService.addZoneMarker(
            s.scene.id,
            s.campaign.id,
            placement.name,
            placement.radiusFt,
            placement.color,
            x,
            y,
          );
          setState((current) =>
            current
              ? { ...current, zoneMarkers: [...current.zoneMarkers, marker], placement: null }
              : current,
          );
          return;
        }
        if (placement.kind === "DISCOVERABLE") {
          await tabletopService.updateDiscoverable(placement.referenceId, {
            x,
            y,
          });
          setState((current) =>
            current
              ? {
                  ...current,
                  discoverables: current.discoverables.map((item) =>
                    item.id === placement.referenceId
                      ? { ...item, x, y }
                      : item,
                  ),
                  placement: null,
                }
              : current,
          );
          return;
        }
        const merge = (tokens: Token[], token: Token) => [
          ...tokens.filter((existing) => existing.id !== token.id),
          token,
        ];
        if (placement.kind === "CHARACTERS") {
          const spacing = s.scene.gridSize * 0.65;
          const columns = Math.ceil(Math.sqrt(placement.referenceIds.length));
          const tokens = await Promise.all(
            placement.referenceIds.map((id, index) => {
              const column = index % columns,
                row = Math.floor(index / columns);
              return tabletopService.placeCharacterToken(
                s.scene.id,
                id,
                x + (column - (columns - 1) / 2) * spacing,
                y +
                  (row -
                    (Math.ceil(placement.referenceIds.length / columns) - 1) /
                      2) *
                    spacing,
              );
            }),
          );
          setState((current) =>
            current
              ? {
                  ...current,
                  tokens: tokens.reduce(merge, current.tokens),
                  placement: null,
                }
              : current,
          );
          return;
        }
        if (placement.kind === "MONSTER") {
          const placed = await tabletopService.placeMonsterToken(
            s.scene.id,
            placement.referenceId,
            x,
            y,
          );
          setState((current) =>
            current
              ? {
                  ...current,
                  tokens: merge(current.tokens, placed.token),
                  monsterInstances: [
                    ...current.monsterInstances.filter(
                      (instance) => instance.id !== placed.instance.id,
                    ),
                    placed.instance,
                  ],
                  placement: null,
                }
              : current,
          );
          return;
        }
        const token =
          placement.kind === "CHARACTER"
            ? await tabletopService.placeCharacterToken(
                s.scene.id,
                placement.referenceId,
                x,
                y,
              )
            : await tabletopService.placeNpcToken(
                s.scene.id,
                placement.referenceId,
                x,
                y,
              );
        setState((current) =>
          current
            ? {
                ...current,
                tokens: merge(current.tokens, token),
                placement: null,
              }
            : current,
        );
      },
      async createNpcTemplate(name, file) {
        const current = stateRef.current;
        if (!current || !isDmRole(current.role)) return;
        const item = await tabletopService.createNpcTemplate(
          current.campaign.id,
          name.trim(),
          file,
        );
        setState((state) =>
          state
            ? {
                ...state,
                npcTemplates: [...state.npcTemplates, item].sort((a, b) =>
                  a.name.localeCompare(b.name),
                ),
              }
            : state,
        );
      },
      async deleteNpcTemplate(id) {
        const current = stateRef.current;
        if (!current || !isDmRole(current.role)) return;
        await tabletopService.deleteNpcTemplate(id);
        setState((state) =>
          state
            ? {
                ...state,
                npcTemplates: state.npcTemplates.filter((item) => item.id !== id),
                placement:
                  state.placement?.kind === "NPC" &&
                  state.placement.referenceId === id
                    ? null
                    : state.placement,
              }
            : state,
        );
      },
      async addDiscoverable(name, file, hidden) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role)) return;
        const item = await tabletopService.addDiscoverable(
          s.scene.id,
          s.campaign.id,
          name,
          file,
          hidden,
        );
        setState((current) =>
          current
            ? {
                ...current,
                discoverables: [...current.discoverables, item],
                placement: {
                  kind: "DISCOVERABLE",
                  referenceId: item.id,
                  name: item.name,
                  imageUrl: null,
                },
              }
            : current,
        );
      },
      async patchDiscoverable(id, patch) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role)) return;
        await tabletopService.updateDiscoverable(id, patch);
        setState((current) =>
          current
            ? {
                ...current,
                discoverables: current.discoverables.map((item) =>
                  item.id === id ? { ...item, ...patch } : item,
                ),
              }
            : current,
        );
      },
      async deleteDiscoverable(id) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role)) return;
        await tabletopService.deleteDiscoverable(id);
        setState((current) =>
          current
            ? {
                ...current,
                discoverables: current.discoverables.filter(
                  (item) => item.id !== id,
                ),
              }
            : current,
        );
      },
      async discover(id) {
        const item = await tabletopService.discover(id);
        setState((current) =>
          current
            ? {
                ...current,
                discoverables: current.discoverables.map((candidate) =>
                  candidate.id === id ? { ...candidate, ...item } : candidate,
                ),
                treasure: [
                  item,
                  ...current.treasure.filter(
                    (candidate) => candidate.id !== item.id,
                  ),
                ],
                discoveryReveal: item,
              }
            : current,
        );
      },
      closeDiscovery() {
        setState((current) =>
          current ? { ...current, discoveryReveal: null } : current,
        );
      },
      async updateSceneGrid(gridType, gridSize) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role)) return;
        const size = Math.max(
          20,
          Math.min(240, Math.round(gridSize ?? s.scene.gridSize)),
        );
        await tabletopService.updateSceneGrid(s.scene.id, gridType, size);
        setState((current) =>
          current
            ? {
                ...current,
                scene: { ...current.scene, gridType, gridSize: size },
              }
            : current,
        );
      },
      async updateScene(patch) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role)) return;
        await tabletopService.updateScene(s.scene.id, patch);
        setState((current) =>
          current
            ? { ...current, scene: { ...current.scene, ...patch } }
            : current,
        );
      },
      async activateScene(sceneId) {
        const s = stateRef.current;
        if (
          !s ||
          !isDmRole(s.role) ||
          (sceneId === s.scene.id && s.scene.active && s.scene.revealed)
        )
          return;
        await tabletopService.activateAndRevealScene(sceneId);
        await reload();
      },
      async travelSceneLink(linkId) {
        const s = stateRef.current;
        const link = s?.sceneLinks.find((candidate) => candidate.id === linkId);
        if (!s || !link || !isDmRole(s.role)) return;
        await tabletopService.activateSceneLink(link.id);
        await reload();
      },
      async updateSceneLink(id, patch) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role)) return;
        await tabletopService.updateSceneLink(id, patch);
        setState((current) =>
          current
            ? {
                ...current,
                sceneLinks: current.sceneLinks.map((link) =>
                  link.id === id ? { ...link, ...patch } : link,
                ),
              }
            : current,
        );
      },
      async deleteSceneLink(id) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role)) return;
        await tabletopService.deleteSceneLink(id);
        setState((current) =>
          current
            ? {
                ...current,
                sceneLinks: current.sceneLinks.filter((link) => link.id !== id),
              }
            : current,
        );
      },
      broadcastTokenMove: sendTokenMovement,
      async commitTokenMove(id, x, y) {
        const patrol = stateRef.current?.patrols.find(
          (item) => item.tokenId === id && item.active,
        );
        try {
          if (patrol)
            await tabletopService.checkpointPatrol(
              patrol,
              x,
              y,
              patrol.currentWaypoint,
              patrol.direction,
              false,
            );
          else await tabletopService.moveToken(id, x, y);
          setState((current) =>
            current
              ? {
                  ...current,
                  tokens: current.tokens.map((token) =>
                    token.id === id ? { ...token, x, y } : token,
                  ),
                  transientTokenIds: current.transientTokenIds.filter(
                    (tokenId) => tokenId !== id,
                  ),
                  patrols: current.patrols.map((item) =>
                    item.id === patrol?.id ? { ...item, active: false } : item,
                  ),
                }
              : current,
          );
          sendTokenMovement(id, x, y, true);
        } catch (error) {
          await reload();
          throw error;
        }
      },
      async createPatrol(tokenId) {
        const s = stateRef.current;
        const token = s?.tokens.find((item) => item.id === tokenId);
        if (
          !s ||
          !token ||
          !isDmRole(s.role) ||
          (token.type !== "MONSTER" && token.type !== "NPC")
        )
          return;
        const existing = s.patrols.find((item) => item.tokenId === tokenId);
        if (existing) {
          setState((current) =>
            current ? { ...current, patrolEditTokenId: tokenId } : current,
          );
          return;
        }
        const patrol = await tabletopService.createPatrol(tokenId, s.scene.id);
        setState((current) =>
          current
            ? {
                ...current,
                patrols: [...current.patrols, patrol],
                patrolEditTokenId: tokenId,
              }
            : current,
        );
      },
      async patchPatrol(id, patch) {
        const s = stateRef.current;
        const patrol = s?.patrols.find((item) => item.id === id);
        if (!s || !patrol || !isDmRole(s.role)) return;
        if (patch.active === false && patrol.active) {
          patrolResumeAt.current.delete(id);
          const token = s.tokens.find((item) => item.id === patrol.tokenId);
          if (token) {
            await tabletopService.checkpointPatrol(
              patrol,
              token.x,
              token.y,
              patch.currentWaypoint ?? patrol.currentWaypoint,
              patch.direction ?? patrol.direction,
              false,
            );
            setState((current) =>
              current
                ? {
                    ...current,
                    transientTokenIds: current.transientTokenIds.filter(
                      (item) => item !== token.id,
                    ),
                    patrols: current.patrols.map((item) =>
                      item.id === id
                        ? { ...item, ...patch, active: false }
                        : item,
                    ),
                  }
                : current,
            );
            sendTokenMovement(token.id, token.x, token.y, true);
            return;
          }
        }
        await tabletopService.updatePatrol(id, patch);
        const active = patch.active ?? patrol.active;
        const currentWaypoint = patch.currentWaypoint ?? patrol.currentWaypoint;
        const updated = { ...patrol, ...patch, active, currentWaypoint };
        setState((current) =>
          current
            ? {
                ...current,
                patrols: current.patrols.map((item) =>
                  item.id === id ? updated : item,
                ),
              }
            : current,
        );
      },
      async deletePatrol(id) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role)) return;
        await tabletopService.deletePatrol(id);
        setState((current) =>
          current
            ? {
                ...current,
                patrols: current.patrols.filter((item) => item.id !== id),
                patrolEditTokenId:
                  current.patrols.find((item) => item.id === id)?.tokenId ===
                  current.patrolEditTokenId
                    ? null
                    : current.patrolEditTokenId,
              }
            : current,
        );
      },
      setPatrolEditing(tokenId) {
        setState((current) =>
          current ? { ...current, patrolEditTokenId: tokenId } : current,
        );
      },
      async updateTokenInteraction(tokenId, patch, shopItems) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role)) return;
        const existing = s.tokenInteractions.find(
          (item) => item.tokenId === tokenId,
        );
        const next = {
          tokenId,
          campaignId: s.campaign.id,
          enabled: patch.enabled ?? existing?.enabled ?? false,
          type: patch.type ?? existing?.type ?? "DIALOGUE",
          displayName: patch.displayName ?? existing?.displayName ?? "",
          dialogueText: patch.dialoguePages
            ? (patch.dialoguePages[0] ?? "")
            : (patch.dialogueText ?? existing?.dialogueText ?? ""),
          dialoguePages: patch.dialoguePages
            ? patch.dialoguePages
            : patch.dialogueText !== undefined
              ? (patch.dialogueText.trim() ? [patch.dialogueText] : [])
              : (existing?.dialoguePages ?? (existing?.dialogueText.trim() ? [existing.dialogueText] : [])),
          shopItems: shopItems
            ? shopItems.map((item, index) => ({
                id: existing?.shopItems[index]?.id ?? crypto.randomUUID(),
                interactionId: tokenId,
                ...item,
                sortOrder: index,
              }))
            : (existing?.shopItems ?? []),
        };
        await tabletopService.updateTokenInteraction(
          tokenId,
          s.campaign.id,
          next,
        );
        if (shopItems)
          await tabletopService.replaceShopItems(tokenId, shopItems);
        setState((current) =>
          current
            ? {
                ...current,
                tokenInteractions: [
                  ...current.tokenInteractions.filter(
                    (item) => item.tokenId !== tokenId,
                  ),
                  next,
                ],
              }
            : current,
        );
      },
      async interactWithNpc(tokenId) {
        const s = stateRef.current;
        const interaction = s?.tokenInteractions.find(
          (item) => item.tokenId === tokenId && item.enabled,
        );
        if (!s || !interaction) return;
        const token = await tabletopService.interactWithNpc(tokenId);
        setState((current) =>
          current
            ? {
                ...current,
                selectedTokenId: tokenId,
                activeInteractionTokenId: tokenId,
                tokens: current.tokens.map((item) =>
                  item.id === tokenId
                    ? { ...item, x: token.x, y: token.y }
                    : item,
                ),
                motionSegments: current.motionSegments.filter(
                  (item) => item.tokenId !== tokenId,
                ),
                patrols: current.patrols.map((item) =>
                  item.tokenId === tokenId ? { ...item, active: false } : item,
                ),
              }
            : current,
        );
      },
      closeNpcInteraction() {
        setState((current) =>
          current
            ? {
                ...current,
                activeInteractionTokenId: null,
                selectedTokenId:
                  current.selectedTokenId === current.activeInteractionTokenId
                    ? null
                    : current.selectedTokenId,
              }
            : current,
        );
      },
      async deleteToken(id) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role)) return;
        if (isSupabaseConfigured && campaignId !== "demo") {
          const { error } = await supabase.from("tokens").delete().eq("id", id);
          if (error) throw error;
        }
        setState((current) =>
          current
            ? {
                ...current,
                selectedTokenId:
                  current.selectedTokenId === id
                    ? null
                    : current.selectedTokenId,
                tokens: current.tokens.filter((t) => t.id !== id),
              }
            : current,
        );
      },
      async patchToken(id, patch) {
        const s = stateRef.current;
        const referenceId = s?.tokens.find((t) => t.id === id)?.referenceId;
        await tabletopService.updateToken(id, patch);
        if (
          patch.visible !== undefined &&
          referenceId &&
          s?.monsterInstances.some((m) => m.id === referenceId) &&
          isSupabaseConfigured &&
          campaignId !== "demo"
        ) {
          const { error } = await supabase
            .from("monster_instances")
            .update({ visible: patch.visible })
            .eq("id", referenceId);
          if (error) throw error;
        }
        setState((current) =>
          current
            ? {
                ...current,
                tokens: current.tokens.map((t) =>
                  t.id === id ? { ...t, ...patch } : t,
                ),
                monsterInstances:
                  patch.visible === undefined
                    ? current.monsterInstances
                    : current.monsterInstances.map((m) =>
                        referenceId === m.id
                          ? { ...m, visible: patch.visible! }
                          : m,
                      ),
              }
            : current,
        );
      },
      async adjustHp(instanceId, amount, mode) {
        const safe = Math.max(0, Math.floor(amount));
        if (!safe) return;
        await tabletopService.adjustMonsterHp(instanceId, safe, mode);
        setState((s) =>
          s
            ? {
                ...s,
                monsterInstances: s.monsterInstances.map((m) =>
                  m.id === instanceId
                    ? {
                        ...m,
                        currentHp:
                          mode === "DAMAGE"
                            ? Math.max(0, m.currentHp - safe)
                            : Math.min(m.maxHp, m.currentHp + safe),
                        dead:
                          mode === "DAMAGE" ? m.currentHp - safe <= 0 : false,
                      }
                    : m,
                ),
              }
            : s,
        );
      },
      async setHp(instanceId, currentHp, maxHp) {
        const max = Math.max(1, maxHp);
        const current = Math.max(0, Math.min(max, currentHp));
        await tabletopService.setMonsterHp(instanceId, current, max);
        setState((s) =>
          s
            ? {
                ...s,
                monsterInstances: s.monsterInstances.map((m) =>
                  m.id === instanceId
                    ? {
                        ...m,
                        currentHp: current,
                        maxHp: max,
                        dead: current === 0,
                      }
                    : m,
                ),
              }
            : s,
        );
      },
      async adjustCharacterHp(characterId, amount, mode) {
        const s = stateRef.current;
        const character = s?.characters.find(
          (candidate) => candidate.id === characterId,
        );
        if (!s || !character) return;
        if (!isDmRole(s.role) && isSupabaseConfigured) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (character.ownerId !== user?.id) return;
        }
        const safe = Math.max(0, Math.floor(amount));
        if (!safe) return;
        const updated = isSupabaseConfigured
          ? await tabletopService.adjustCharacterHp(characterId, safe, mode)
          : mode === "DAMAGE"
            ? {
                ...character,
                tempHp: Math.max(0, character.tempHp - safe),
                currentHp: Math.max(
                  0,
                  character.currentHp - Math.max(0, safe - character.tempHp),
                ),
              }
            : {
                ...character,
                currentHp: Math.min(
                  character.maxHp,
                  character.currentHp + safe,
                ),
              };
        setState((current) =>
          current
            ? {
                ...current,
                characters: current.characters.map((character) =>
                  character.id === updated.id
                    ? { ...character, ...updated }
                    : character,
                ),
              }
            : current,
        );
      },
      async setCharacterCombat(characterId, currentHp, maxHp, tempHp, ac) {
        const s = stateRef.current;
        const character = s?.characters.find(
          (candidate) => candidate.id === characterId,
        );
        if (!s || !character) return;
        if (!isDmRole(s.role) && isSupabaseConfigured) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (character.ownerId !== user?.id) return;
        }
        const max = Math.max(1, Math.floor(maxHp)),
          current = Math.max(0, Math.min(max, Math.floor(currentHp))),
          temp = Math.max(0, Math.floor(tempHp)),
          armor = Math.max(0, Math.min(99, Math.floor(ac)));
        const updated = isSupabaseConfigured
          ? await tabletopService.setCharacterCombat(
              characterId,
              current,
              max,
              temp,
              armor,
            )
          : {
              ...character,
              currentHp: current,
              maxHp: max,
              tempHp: temp,
              ac: armor,
            };
        setState((existing) =>
          existing
            ? {
                ...existing,
                characters: existing.characters.map((character) =>
                  character.id === updated.id
                    ? { ...character, ...updated }
                    : character,
                ),
              }
            : existing,
        );
      },
      async setCharacterAbilities(characterId, abilities) {
        const s = stateRef.current;
        const character = s?.characters.find(
          (candidate) => candidate.id === characterId,
        );
        if (!s || !character) return;
        if (!isDmRole(s.role) && isSupabaseConfigured) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (character.ownerId !== user?.id) return;
        }
        const safe = {
          str: Math.max(1, Math.min(30, Math.floor(abilities.str))),
          dex: Math.max(1, Math.min(30, Math.floor(abilities.dex))),
          con: Math.max(1, Math.min(30, Math.floor(abilities.con))),
          int: Math.max(1, Math.min(30, Math.floor(abilities.int))),
          wis: Math.max(1, Math.min(30, Math.floor(abilities.wis))),
          cha: Math.max(1, Math.min(30, Math.floor(abilities.cha))),
        };
        const updated = isSupabaseConfigured
          ? await tabletopService.setCharacterAbilities(characterId, safe)
          : { ...character, abilities: safe };
        setState((existing) =>
          existing
            ? {
                ...existing,
                characters: existing.characters.map((candidate) =>
                  candidate.id === updated.id
                    ? { ...candidate, ...updated }
                    : candidate,
                ),
              }
            : existing,
        );
      },
      async toggleCondition(instanceId, condition) {
        const s = stateRef.current;
        const instance = s?.monsterInstances.find((m) => m.id === instanceId);
        const token = s?.tokens.find((t) => t.referenceId === instanceId);
        if (!instance || !token) return;
        const conditions = instance.conditions.includes(condition)
          ? instance.conditions.filter((c) => c !== condition)
          : [...instance.conditions, condition];
        if (isSupabaseConfigured && campaignId !== "demo") {
          await Promise.all([
            supabase
              .from("monster_instances")
              .update({ conditions })
              .eq("id", instanceId),
            tabletopService.updateToken(token.id, { conditions }),
          ]);
        }
        setState((current) =>
          current
            ? {
                ...current,
                monsterInstances: current.monsterInstances.map((m) =>
                  m.id === instanceId ? { ...m, conditions } : m,
                ),
                tokens: current.tokens.map((t) =>
                  t.id === token.id ? { ...t, conditions } : t,
                ),
              }
            : current,
        );
      },
      async nextTurn(delta) {
        const s = stateRef.current;
        if (!s || !s.combat.entries.length) return;
        await tabletopService.advanceTurn(s.combat, delta);
        setState((current) => {
          if (!current) return current;
          let index = current.combat.currentIndex + delta;
          let round = current.combat.round;
          if (index >= current.combat.entries.length) {
            index = 0;
            round += 1;
          }
          if (index < 0) {
            index = current.combat.entries.length - 1;
            round = Math.max(1, round - 1);
          }
          return {
            ...current,
            combat: { ...current.combat, currentIndex: index, round },
          };
        });
      },
      async startCombat() {
        const s = stateRef.current;
        if (!s || s.combat.active) return;
        let id = crypto.randomUUID();
        if (isSupabaseConfigured && campaignId !== "demo") {
          const { data, error } = await supabase
            .from("combat_sessions")
            .insert({
              campaign_id: s.campaign.id,
              scene_id: s.scene.id,
              active: true,
            })
            .select("id")
            .single();
          if (error) throw error;
          id = data.id;
        }
        setState((current) =>
          current
            ? {
                ...current,
                combat: {
                  id,
                  campaignId: current.campaign.id,
                  sceneId: current.scene.id,
                  active: true,
                  round: 1,
                  currentIndex: 0,
                  entries: [],
                },
              }
            : current,
        );
      },
      async endCombat() {
        const s = stateRef.current;
        if (!s || !s.combat.active) return;
        if (isSupabaseConfigured && campaignId !== "demo") {
          const { error } = await supabase
            .from("combat_sessions")
            .update({ active: false, ended_at: new Date().toISOString() })
            .eq("id", s.combat.id);
          if (error) throw error;
        }
        setState((current) =>
          current
            ? {
                ...current,
                combat: {
                  ...current.combat,
                  active: false,
                  round: 1,
                  currentIndex: 0,
                  entries: [],
                },
              }
            : current,
        );
      },
      async addToInitiative(tokenId, initiative) {
        const s = stateRef.current;
        if (!s) return;
        const token = s.tokens.find((t) => t.id === tokenId);
        if (!token) return;
        let combat = s.combat;
        if (!combat.active) {
          let id = crypto.randomUUID();
          if (isSupabaseConfigured && campaignId !== "demo") {
            const { data, error } = await supabase
              .from("combat_sessions")
              .insert({
                campaign_id: s.campaign.id,
                scene_id: s.scene.id,
                active: true,
              })
              .select("id")
              .single();
            if (error) throw error;
            id = data.id;
          }
          combat = {
            id,
            campaignId: s.campaign.id,
            sceneId: s.scene.id,
            active: true,
            round: 1,
            currentIndex: 0,
            entries: [],
          };
        }
        const score = initiative ?? Math.floor(Math.random() * 20) + 1;
        const entry = {
          id: crypto.randomUUID(),
          combatSessionId: combat.id,
          tokenId: token.id,
          monsterInstanceId:
            token.type === "MONSTER" ? token.referenceId : null,
          characterId: token.type === "PLAYER" ? token.referenceId : null,
          name: token.displayName,
          imageUrl: token.imageUrl,
          initiative: score,
          sortOrder: combat.entries.length,
          groupKey: null,
          groupCount: 1,
        };
        if (isSupabaseConfigured && campaignId !== "demo") {
          const { error } = await supabase
            .from("initiative_entries")
            .insert({
              id: entry.id,
              combat_session_id: combat.id,
              token_id: entry.tokenId,
              monster_instance_id: entry.monsterInstanceId,
              character_id: entry.characterId,
              name: entry.name,
              image_url: entry.imageUrl,
              initiative: score,
              sort_order: entry.sortOrder,
            });
          if (error) throw error;
        }
        setState((current) =>
          current
            ? {
                ...current,
                combat: {
                  ...combat,
                  entries: [...combat.entries, entry]
                    .sort((a, b) => b.initiative - a.initiative)
                    .map((e, i) => ({ ...e, sortOrder: i })),
                },
              }
            : current,
        );
      },
      async removeInitiative(entryId) {
        if (isSupabaseConfigured && campaignId !== "demo") {
          const { error } = await supabase
            .from("initiative_entries")
            .delete()
            .eq("id", entryId);
          if (error) throw error;
        }
        setState((current) =>
          current
            ? {
                ...current,
                combat: {
                  ...current.combat,
                  currentIndex: Math.min(
                    current.combat.currentIndex,
                    Math.max(0, current.combat.entries.length - 2),
                  ),
                  entries: current.combat.entries
                    .filter((e) => e.id !== entryId)
                    .map((e, i) => ({ ...e, sortOrder: i })),
                },
              }
            : current,
        );
      },
      async reorderInitiative(sourceId, targetId) {
        const s = stateRef.current;
        if (!s) return;
        const entries = [...s.combat.entries];
        const from = entries.findIndex((e) => e.id === sourceId),
          to = entries.findIndex((e) => e.id === targetId);
        if (from < 0 || to < 0 || from === to) return;
        const [moved] = entries.splice(from, 1);
        entries.splice(to, 0, moved);
        const ordered = entries.map((e, i) => ({ ...e, sortOrder: i }));
        if (isSupabaseConfigured && campaignId !== "demo")
          await Promise.all(
            ordered.map((e) =>
              supabase
                .from("initiative_entries")
                .update({ sort_order: e.sortOrder })
                .eq("id", e.id)
                .then(({ error }) => {
                  if (error) throw error;
                }),
            ),
          );
        setState((current) =>
          current
            ? { ...current, combat: { ...current.combat, entries: ordered } }
            : current,
        );
      },
      async duplicateToken(tokenId) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role)) return;
        const token = s.tokens.find((t) => t.id === tokenId);
        if (!token) return;
        let referenceId = token.referenceId;
        let copiedMonster = null;
        const monster = s.monsterInstances.find(
          (m) => m.id === token.referenceId,
        );
        if (monster) {
          referenceId = crypto.randomUUID();
          copiedMonster = {
            ...monster,
            id: referenceId,
            customName: `${monster.customName} copy`,
          };
          if (isSupabaseConfigured && campaignId !== "demo") {
            const { error } = await supabase
              .from("monster_instances")
              .insert({
                id: referenceId,
                campaign_id: monster.campaignId,
                template_id: monster.templateId,
                custom_name: copiedMonster.customName,
                current_hp: monster.currentHp,
                max_hp: monster.maxHp,
                ac: monster.ac,
                conditions: monster.conditions,
                visible: monster.visible,
                notes: monster.notes,
                dead: monster.dead,
              });
            if (error) throw error;
          }
        }
        const duplicate = {
          ...token,
          id: crypto.randomUUID(),
          referenceId,
          displayName: monster
            ? copiedMonster!.customName
            : `${token.displayName} copy`,
          x: token.x + s.scene.gridSize,
          y: token.y + s.scene.gridSize,
        };
        if (isSupabaseConfigured && campaignId !== "demo") {
          const { error } = await supabase
            .from("tokens")
            .insert({
              id: duplicate.id,
              scene_id: duplicate.sceneId,
              reference_id: duplicate.referenceId,
              owner_user_id: duplicate.ownerUserId,
              type: duplicate.type,
              display_name: duplicate.displayName,
              image_url: duplicate.imageUrl,
              x: duplicate.x,
              y: duplicate.y,
              size: duplicate.size,
              rotation: duplicate.rotation,
              visible: duplicate.visible,
              locked: duplicate.locked,
              conditions: duplicate.conditions,
            });
          if (error) throw error;
        }
        setState((current) =>
          current
            ? {
                ...current,
                tokens: [...current.tokens, duplicate],
                monsterInstances: copiedMonster
                  ? [...current.monsterInstances, copiedMonster]
                  : current.monsterInstances,
              }
            : current,
        );
      },
      async addOverlay(file) {
        const s = stateRef.current;
        if (!s) return;
        const overlay = await tabletopService.addOverlay(
          s.scene.id,
          s.campaign.id,
          file,
        );
        setState((current) =>
          current
            ? { ...current, overlays: [...current.overlays, overlay] }
            : current,
        );
      },
      async patchOverlay(id, patch) {
        await tabletopService.updateOverlay(id, patch);
        setState((s) =>
          s
            ? {
                ...s,
                overlays: s.overlays.map((o) =>
                  o.id === id ? { ...o, ...patch } : o,
                ),
              }
            : s,
        );
      },
      async deleteOverlay(id) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role)) return;
        await tabletopService.deleteOverlay(id);
        setState((current) =>
          current
            ? {
                ...current,
                overlays: current.overlays.filter(
                  (overlay) => overlay.id !== id,
                ),
              }
            : current,
        );
      },
      async updateZoneMarker(id, patch) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role)) return;
        await tabletopService.updateZoneMarker(id, patch);
        setState((current) =>
          current
            ? {
                ...current,
                zoneMarkers: current.zoneMarkers.map((marker) =>
                  marker.id === id ? { ...marker, ...patch } : marker,
                ),
              }
            : current,
        );
      },
      async deleteZoneMarker(id) {
        const s = stateRef.current;
        if (!s || !isDmRole(s.role)) return;
        await tabletopService.deleteZoneMarker(id);
        setState((current) =>
          current
            ? {
                ...current,
                zoneMarkers: current.zoneMarkers.filter((marker) => marker.id !== id),
              }
            : current,
        );
      },
      reload,
    }),
    [campaignId, reload, sendTokenMovement],
  );
  return (
    <TabletopContext.Provider
      value={{ state, loading, error, playerView, builder, actions }}
    >
      {children}
    </TabletopContext.Provider>
  );
}
export function useTabletop() {
  const value = useContext(TabletopContext);
  if (!value) throw new Error("useTabletop must be inside TabletopProvider");
  return value;
}
