import type { CinematicEvent, CinematicStep } from './types';

export type MapTiltStep = Extract<CinematicStep, { type: 'MAP_TILT' }>;
export const turnDirections = {
  N: { x: 0, y: -1 }, NE: { x: 1, y: -1 }, E: { x: 1, y: 0 }, SE: { x: 1, y: 1 },
  S: { x: 0, y: 1 }, SW: { x: -1, y: 1 }, W: { x: -1, y: 0 }, NW: { x: -1, y: -1 },
} as const;
export type TurnDirection = keyof typeof turnDirections | 'TOWARD' | 'AWAY';

export function resolveTurnDirection(direction: TurnDirection, center: { x: number; y: number }, reference?: { x: number; y: number }) {
  const vector = direction === 'TOWARD' || direction === 'AWAY'
    ? reference && { x: (reference.x - center.x) * (direction === 'AWAY' ? -1 : 1), y: (reference.y - center.y) * (direction === 'AWAY' ? -1 : 1) }
    : turnDirections[direction];
  if (!vector || !Number.isFinite(vector.x) || !Number.isFinite(vector.y)) return null;
  const length = Math.hypot(vector.x, vector.y);
  return length < .001 ? null : { x: vector.x / length, y: vector.y / length };
}

// One server timestamp, rather than each subscriber's receipt time. Older presets
// retain their existing local timeline; late/reconnected Turn events cannot replay.
export function cinematicElapsed(event: CinematicEvent, localElapsed: number, wallNow: number) {
  const started = Date.parse(event.createdAt);
  return event.steps.some(s => s.type === 'MAP_TILT') && Number.isFinite(started)
    ? Math.max(0, wallNow - started) : localElapsed;
}
export function cinematicAppliesToScene(event: CinematicEvent, sceneId: string) {
  return event.steps.every(step => step.type !== 'MAP_TILT' || step.sceneId === sceneId);
}
export function tiltOnly(event: CinematicEvent) {
  return event.steps.length > 0 && event.steps.every(s => s.type === 'MAP_TILT');
}
export function mapTiltFrame(step: MapTiltStep, elapsed: number, width: number, height: number, reducedMotion = false) {
  const duration = Math.max(1, step.duration ?? 8000), age = elapsed - step.at;
  const ease = (t: number) => { const p = Math.max(0, Math.min(1, t)); return p * p * (3 - 2 * p); };
  const envelope = age < 0 || age >= duration ? 0 : Math.min(ease(age / 700), ease((duration - age) / 900));
  const vector = resolveTurnDirection('TOWARD', { x: 0, y: 0 }, { x: step.directionX, y: step.directionY }) ?? { x: 1, y: 0 };
  // A modest 2D roll is a presentation cue, not a gravity simulation. The arrow
  // communicates the actual map-space direction, including north/south/diagonals.
  const sign = vector.x !== 0 ? Math.sign(vector.x) : -Math.sign(vector.y);
  const degrees = Number.isFinite(step.degrees) ? Math.max(0, Math.min(20, step.degrees)) : 16;
  const rotation = reducedMotion ? 0 : sign * degrees * Math.PI / 180 * envelope;
  const sin = Math.abs(Math.sin(rotation)), cos = Math.abs(Math.cos(rotation));
  // Fit the rotated viewport back inside its original bounds to protect edges.
  const scale = width > 0 && height > 0 ? Math.min(1, width / (width * cos + height * sin), height / (width * sin + height * cos)) : 1;
  const arrowRotation = Math.atan2(-vector.x, vector.y) + rotation;
  return { rotation, scale, envelope, arrowRotation };
}
