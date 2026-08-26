import type { FogRegion, Scene, SceneLink, SceneOverlay, Token } from "../../domain/types";

export interface SceneStructureSnapshot {
  scene: Scene;
  overlays: SceneOverlay[];
  tokens: Token[];
  fogRegions: FogRegion[];
  sceneLinks: SceneLink[];
  canDm: boolean;
  playerView: boolean;
}

/** Signed storage URLs change on every reload; their path is the rendered asset identity. */
export function stableAssetIdentity(path: string | null | undefined, url: string | null | undefined) {
  if (path) return `path:${path}`;
  return url ? `url:${url.split(/[?#]/, 1)[0]}` : null;
}

/**
 * Only include inputs that require rebuilding Pixi display objects. Position and
 * transient UI changes are applied incrementally, so realtime reloads may safely
 * refresh signed URLs without recreating the map or grid.
 */
export function createSceneStructureKey(snapshot: SceneStructureSnapshot) {
  const scene = snapshot.scene;
  return JSON.stringify({
    scene: {
      id: scene.id,
      map: scene.mapId ? `map:${scene.mapId}` : stableAssetIdentity(null, scene.mapUrl),
      width: scene.width, height: scene.height, gridType: scene.gridType, gridSize: scene.gridSize,
      feetPerCell: scene.feetPerCell, gridColor: scene.gridColor, gridOpacity: scene.gridOpacity,
      fogEnabled: scene.fogEnabled, fogCovered: scene.fogCovered, mapX: scene.mapX, mapY: scene.mapY,
      mapScale: scene.mapScale, gridOffsetX: scene.gridOffsetX, gridOffsetY: scene.gridOffsetY,
      lighting: scene.lighting, playerCameraX: scene.playerCameraX, playerCameraY: scene.playerCameraY, playerCameraZoom: scene.playerCameraZoom,
    },
    tokens: [...snapshot.tokens].sort((a, b) => a.id.localeCompare(b.id)).map((token) => ({
      id: token.id, sceneId: token.sceneId, referenceId: token.referenceId, ownerUserId: token.ownerUserId,
      type: token.type, displayName: token.displayName, image: stableAssetIdentity(token.imagePath, token.imageUrl),
      size: token.size, rotation: token.rotation, visible: token.visible, locked: token.locked,
      conditions: [...token.conditions].sort(),
    })),
    overlays: [...snapshot.overlays].sort((a, b) => a.id.localeCompare(b.id)).map((overlay) => ({
      id: overlay.id, sceneId: overlay.sceneId, name: overlay.name, image: stableAssetIdentity(null, overlay.imageUrl),
      kind: overlay.kind, width: overlay.width, height: overlay.height, rotation: overlay.rotation,
      opacity: overlay.opacity, zIndex: overlay.zIndex, visible: overlay.visible, locked: overlay.locked,
    })),
    fogRegions: [...snapshot.fogRegions].sort((a, b) => a.id.localeCompare(b.id)).map((region) => ({
      id: region.id, sceneId: region.sceneId, mode: region.mode, shape: region.shape, points: region.points,
    })),
    sceneLinks: [...snapshot.sceneLinks].sort((a, b) => a.id.localeCompare(b.id)).map((link) => ({
      id: link.id, sceneId: link.sceneId, destinationSceneId: link.destinationSceneId, label: link.label,
    })),
    // These modes affect which board objects exist. Selection/placement and monster
    // intel update incrementally; the fog tool is interaction state only.
    canDm: snapshot.canDm,
    playerView: snapshot.playerView,
  });
}
