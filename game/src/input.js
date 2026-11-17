// Keyboard and mouse input for Neon Tide. Held keys and the pointer are read as state
// every frame; one-shot presses (interact, reload, pause, confirm) are queued as flags
// and taken once by the loop, so a press between frames is never lost or doubled.

export const ACTION_INTERACT = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CONFIRM = 4;
export const ACTION_RELOAD = 8;
export const ACTION_MUTE = 16;

const KEYMAP = {
  KeyE: ACTION_INTERACT,
  Enter: ACTION_CONFIRM,
  KeyR: ACTION_RELOAD,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyM: ACTION_MUTE,
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  window.addEventListener('keydown', (event) => {
    held.add(event.code);
    const action = KEYMAP[event.code];
    if (action !== undefined && !event.repeat) actions |= action;
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouseY = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      mouseDown = true;
      actions |= ACTION_CONFIRM;
    }
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Is a key (by KeyboardEvent.code) currently held down? */
    down(code) {
      return held.has(code);
    },
    /** Movement axes from WASD or the arrow keys: x right, y down, each -1..1. */
    moveAxes() {
      const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    /** Throttle for driving: 1 forward, -1 reverse/brake, 0 neither. */
    throttle() {
      return (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
    },
    /** Steering for driving: -1 left, 1 right. */
    steer() {
      return (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
    },
    /** Is the handbrake (Space) held? */
    handbrake() {
      return held.has('Space');
    },
    /** Is the sprint key (Shift) held? */
    sprint() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    /** Pointer position in canvas pixels, and whether the left button is held. */
    pointer() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
