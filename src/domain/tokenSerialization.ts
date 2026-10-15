import type { Token } from './types';

const finite = (value: unknown, fallback: number) => {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
// Database defaults do not run for offline fixtures or incomplete older payloads.
// Never pass NaN/Infinity transforms to Pixi: the entire token becomes invisible.
export function asToken(r: Record<string, unknown>): Token {
  const size = finite(r.size, 1);
  return {
    id: String(r.id), sceneId: String(r.scene_id), referenceId: r.reference_id ? String(r.reference_id) : null,
    ownerUserId: r.owner_user_id ? String(r.owner_user_id) : null, type: r.type as Token['type'],
    displayName: String(r.display_name ?? ''), imageUrl: r.image_url ? String(r.image_url) : null,
    imagePath: r.image_path ? String(r.image_path) : null,
    x: finite(r.x, 0), y: finite(r.y, 0), size: size > 0 ? size : 1, rotation: finite(r.rotation, 0),
    visible: r.visible === undefined || r.visible === null ? true : Boolean(r.visible), locked: Boolean(r.locked),
    conditions: Array.isArray(r.conditions) ? r.conditions.filter((value): value is string => typeof value === 'string') : [],
  };
}
