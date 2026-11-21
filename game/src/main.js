// The Velvet Hour — boot: canvas, game loop, and screenshot modes.
// Play normally in a browser, or open with ?shot=start|play|alert|win to
// render one deterministic scene for a screenshot. The live loop runs at
// the display's refresh rate; a shot scene is staged once and then only
// redrawn, so its frame never drifts while the screenshot is taken.
import { VIEW_H, VIEW_W } from './config.js';
import { SoundBank } from './audio.js';
import { createGame, handleMenuKey, stepGame } from './game.js';
import { createInput } from './input.js';
import { drawGame } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const sound = new SoundBank();
const state = createGame();
const input = createInput(canvas, (code) => {
  sound.ensure();
  handleMenuKey(state, code, sound);
});

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotSeed = Number(params.get('seed') || '1') || 1;

let shotMode = false;
let frozenTime = 0;
if (shotName) {
  shotMode = true;
  stageShot(shotName, state, shotSeed);
  frozenTime = state.time;
}

// Test hooks: the headless play-test reads state and drives input through
// these, so the game can be verified without a human at the keyboard.
window.__velvet = { state, stepGame, handleMenuKey, input, sound };

// Keep the canvas fitted to the window without changing its 1280x720 art.
function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (!shotMode) {
    stepGame(state, input, dt, sound);
    drawGame(ctx, state, now / 1000);
  } else {
    drawGame(ctx, state, frozenTime);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__ready = true;
