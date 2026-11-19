// The saved game, in the browser's local storage: cash, story progress, whether
// Vera's SMG has been earned, and where Jax stood. Nothing leaves the machine; a
// save that does not parse is no save, and an old save without the newer fields
// simply loads with their defaults.

import { SAVE_KEY } from './config.js';

/** Read the save, or null when there is none worth loading. */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (raw === null) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return { ...data, hasSmg: data.hasSmg === true };
  } catch {
    return null;
  }
}

/** Write the save. Failures (private windows, full storage) are silent by design. */
export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // The game plays on; the save simply lasts this visit only.
  }
}

/** Forget the save (New Game). */
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to forget.
  }
}
