import type { Scene, SceneDiscoverable, SceneLink, SceneOverlay, SceneZoneMarker, Token } from "../../domain/types";

export interface SceneStructureSnapshot {
  scene: Scene;
  overlays: SceneOverlay[];
  zoneMarkers: SceneZoneMarker[];
  tokens: Token[];
  sceneLinks: SceneLink[];
  discoverables: SceneDiscoverable[];
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
      feetPerCell: scene.feetPerCell, gridColor: scene.gridColor, gridOpacity: scene.gridOpacity, gridLineWidth: scene.gridLineWidth,
mapX: scene.mapX, mapY: scene.mapY,
      mapScale: scene.mapScale, gridOffsetX: scene.gridOffsetX, gridOffsetY: scene.gridOffsetY,
      playerCameraX: scene.playerCameraX, playerCameraY: scene.playerCameraY, playerCameraZoom: scene.playerCameraZoom,
    },
    overlays: [...snapshot.overlays].sort((a, b) => a.id.localeCompare(b.id)).map((overlay) => ({
      id: overlay.id, sceneId: overlay.sceneId, name: overlay.name, image: stableAssetIdentity(null, overlay.imageUrl),
      kind: overlay.kind, width: overlay.width, height: overlay.height, rotation: overlay.rotation,
      opacity: overlay.opacity, zIndex: overlay.zIndex, visible: overlay.visible, locked: overlay.locked,
    })),
    zoneMarkers: [...snapshot.zoneMarkers].sort((a,b)=>a.id.localeCompare(b.id)).map((marker)=>({
      id:marker.id,label:marker.label,x:marker.x,y:marker.y,radiusFt:marker.radiusFt,color:marker.color,opacity:marker.opacity,visible:marker.visible,
    })),
    discoverables: [...snapshot.discoverables].sort((a,b)=>a.id.localeCompare(b.id)).map((item)=>({
      id:item.id,
      sceneId:item.sceneId,
      name:item.name,
      hidden:item.hidden,
      discoveredAt:item.discoveredAt,
    })),

    // These modes affect which board objects exist. Selection/placement and monster
    // Intel updates incrementally.
    canDm: snapshot.canDm,
    playerView: snapshot.playerView,
  });
}
