export type CinematicMotionPreference = 'SYSTEM' | 'FULL' | 'REDUCED';
const key = 'wayfinder:cinematic-motion:v1';
const changed = 'wayfinder:cinematic-motion-changed';
let fallback: CinematicMotionPreference = 'SYSTEM';
export function getCinematicMotionPreference(): CinematicMotionPreference {
  try {
    const value = window.localStorage.getItem(key);
    return value === 'FULL' || value === 'REDUCED' || value === 'SYSTEM' ? value : 'SYSTEM';
  } catch { return fallback; }
}
export function setCinematicMotionPreference(value: CinematicMotionPreference) {
  fallback = value;
  try { window.localStorage.setItem(key, value); } catch { /* Current-tab opt-in still works without storage. */ }
  window.dispatchEvent(new Event(changed));
}
export function subscribeCinematicMotion(listener: () => void) {
  window.addEventListener(changed, listener);
  window.addEventListener('storage', listener);
  return () => { window.removeEventListener(changed, listener); window.removeEventListener('storage', listener); };
}
export function shouldReduceCinematicMotion(preference: CinematicMotionPreference, browserReduced: boolean) {
  return preference === 'REDUCED' || (preference !== 'FULL' && browserReduced);
}
export function prefersReducedCinematicMotion() {
  return shouldReduceCinematicMotion(getCinematicMotionPreference(), window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
