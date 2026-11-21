// The Velvet Hour — input: keyboard and mouse, one object the game reads
// each frame. WASD or arrows move; Shift sneaks, Ctrl runs; Enter starts,
// R restarts, P or Escape pauses, M mutes. A mouse click sets a
// click-to-move target on the floor; the game converts it to world pixels.
import { VIEW_H, VIEW_W } from './config.js';

export function createInput(canvas, onKey) {
  const input = {
    keys: new Set(),
    mouse: { x: VIEW_W / 2, y: VIEW_H / 2 },
    click: null, // { x, y } in world pixels, consumed by the game
  };

  function canvasScale() {
    const rect = canvas.getBoundingClientRect();
    return { sx: VIEW_W / rect.width, sy: VIEW_H / rect.height };
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) {
      input.keys.add(event.code);
      if (onKey) onKey(event.code);
    }
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
  });

  canvas.addEventListener('mousemove', (event) => {
    const scale = canvasScale();
    input.mouse.x = (event.clientX - canvas.getBoundingClientRect().left) * scale.sx;
    input.mouse.y = (event.clientY - canvas.getBoundingClientRect().top) * scale.sy;
  });
  canvas.addEventListener('mousedown', (event) => {
    const scale = canvasScale();
    const rect = canvas.getBoundingClientRect();
    input.click = {
      x: (event.clientX - rect.left) * scale.sx,
      y: (event.clientY - rect.top) * scale.sy,
    };
  });

  return input;
}
