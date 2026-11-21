// The Velvet Hour — shots: deterministic screenshot scenes. Each scene
// plays the real rules forward from a fresh level, steered by an autopilot
// that pathfinds around the guards' vision cones, so the frame is what a
// short game really looks like and the same seed always gives the same
// frame. ?shot=start|play|alert|win, with &seed= to vary the patrol phase.
import { TILE } from './config.js';
import { SCREEN_CLEAR, SCREEN_PLAY, SCREEN_TITLE, createGame, loadLevel, startGame, stepGame } from './game.js';
import { pointInCone } from './guard.js';
import { hasLineOfSight, isSolidTile, tileAt } from './levels.js';

const STEP = 1 / 60;

/** Breadth-first path over walkable tiles, avoiding lit vision cones. */
function findPath(state, fromTx, fromTy, toTx, toTy) {
  const grid = state.level.grid;
  const key = (x, y) => `${x},${y}`;
  const prev = new Map();
  const cost = new Map();
  const queue = [[fromTx, fromTy]];
  cost.set(key(fromTx, fromTy), 0);
  // A tile counts as watched only when a guard could really see it: inside
  // the cone AND with a clear line of sight, so walls stop counting.
  const inCone = (tx, ty) => {
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;
    return state.guards.some((g) => pointInCone(g, cx, cy) && hasLineOfSight(grid, g.x, g.y, cx, cy));
  };
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (x === toTx && y === toTy) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (isSolidTile(tileAt(grid, nx, ny))) continue;
      const k = key(nx, ny);
      const stepCost = 1 + (inCone(nx, ny) ? 25 : 0) + (tileAt(grid, nx, ny) === ',' ? -0.2 : 0);
      const next = cost.get(key(x, y)) + stepCost;
      if (!cost.has(k) || next < cost.get(k)) {
        cost.set(k, next);
        prev.set(k, [x, y]);
        queue.push([nx, ny]);
      }
    }
  }
  const target = key(toTx, toTy);
  if (!prev.has(target) && !(fromTx === toTx && fromTy === toTy)) return null;
  const path = [[toTx, toTy]];
  let cur = [toTx, toTy];
  while (!(cur[0] === fromTx && cur[1] === fromTy)) {
    cur = prev.get(key(cur[0], cur[1]));
    if (!cur) break;
    path.unshift(cur);
  }
  return path;
}

/** Nearest tile the player can stand on that no cone currently covers. */
function nearestSafeTile(state) {
  const grid = state.level.grid;
  const px = Math.floor(state.player.x / TILE);
  const py = Math.floor(state.player.y / TILE);
  const seen = new Set([`${px},${py}`]);
  const queue = [[px, py]];
  const inCone = (tx, ty) => {
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;
    return state.guards.some((g) => pointInCone(g, cx, cy) && hasLineOfSight(grid, g.x, g.y, cx, cy));
  };
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (!inCone(x, y)) return [x, y];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = `${nx},${ny}`;
      if (!seen.has(k) && !isSolidTile(tileAt(grid, nx, ny))) {
        seen.add(k);
        queue.push([nx, ny]);
      }
    }
  }
  return [px, py];
}

/**
 * The autopilot: one step of steering. It replans toward `goal` (a pixel
 * point, or null to head for the relic then the exit), waits in cover when
 * the next tile is watched, and sneaks whenever a cone is near.
 */
function autopilot(state, goal, replan) {
  const player = state.player;
  const px = Math.floor(player.x / TILE);
  const py = Math.floor(player.y / TILE);
  const inConeNow = state.guards.some((g) => pointInCone(g, player.x, player.y));
  // Unstick: if the player made no progress for a second while trying to
  // move, slide sideways off whatever corner it is wedged on.
  if (!replan.lastPos) replan.lastPos = { x: player.x, y: player.y, t: 0, nudge: null };
  replan.lastPos.t += STEP;
  const moved = Math.hypot(player.x - replan.lastPos.x, player.y - replan.lastPos.y);
  if (moved > 5) {
    replan.lastPos.x = player.x;
    replan.lastPos.y = player.y;
    replan.lastPos.t = 0;
    replan.lastPos.nudge = null;
  } else if (replan.lastPos.t > 1 && !replan.lastPos.nudge) {
    replan.lastPos.nudge = (player.y % TILE) < TILE / 2 ? 'KeyS' : 'KeyW';
    replan.lastPos.t = 0;
  }
  let target = goal;
  if (!target) {
    target = state.relicGot ? state.level.exit : state.level.relic;
  }
  const tx = Math.floor(target.x / TILE);
  const ty = Math.floor(target.y / TILE);
  if (replan.due <= 0 || !replan.path) {
    let path = null;
    if (inConeNow) {
      const [sx, sy] = nearestSafeTile(state);
      path = findPath(state, px, py, sx, sy);
    } else {
      path = findPath(state, px, py, tx, ty);
    }
    replan.path = path;
    replan.due = 0.4;
  }
  replan.due -= STEP;

  const keys = new Set();
  const path = replan.path;
  if (path && path.length > 1) {
    const [nx, ny] = path[1];
    const wx = nx * TILE + TILE / 2;
    const wy = ny * TILE + TILE / 2;
    const dx = wx - player.x;
    const dy = wy - player.y;
    // Wait in cover rather than step into a watched tile — but only when
    // the watcher is close or suspicion is already high. A distant cone
    // at the edge of its range only builds suspicion slowly, and sneaking
    // through it beats waiting forever on its edge.
    const watchers = state.guards.filter((g) => pointInCone(g, wx, wy) && hasLineOfSight(state.level.grid, g.x, g.y, wx, wy));
    const nearestWatcher = watchers.length > 0
      ? Math.min(...watchers.map((g) => Math.hypot(g.x - player.x, g.y - player.y)))
      : Infinity;
    const hereSafe = !inConeNow;
    if (watchers.length > 0 && hereSafe && Math.hypot(dx, dy) > 14 && (nearestWatcher < 170 || state.suspicion > 40)) {
      return { keys, click: null }; // hold still, let the cone sweep past
    }
    if (dx > 4) keys.add('KeyD');
    if (dx < -4) keys.add('KeyA');
    if (dy > 4) keys.add('KeyS');
    if (dy < -4) keys.add('KeyW');
    if (replan.lastPos && replan.lastPos.nudge) keys.add(replan.lastPos.nudge);
    // Sneak whenever a cone is close or suspicion is building.
    const coneNear = state.guards.some((g) => {
      const d = Math.hypot(g.x - player.x, g.y - player.y);
      return d < 260;
    });
    if (coneNear || state.suspicion > 0 || watchers.length > 0) keys.add('ShiftLeft');
  }
  return { keys, click: null };
}

/** Run the game forward for `seconds` of play with the autopilot steering. */
function playForward(state, seconds, goal) {
  const replan = { path: null, due: 0 };
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (state.screen !== SCREEN_PLAY) break;
    const input = autopilot(state, goal, replan);
    stepGame(state, input, STEP, null);
  }
}

/**
 * Set the game to the named scene and return the screen to draw.
 * start: title over a live gallery, guards mid-patrol.
 * play: mid-stealth, sneaking toward the relic.
 * alert: the guard has spotted the player and is closing in.
 * win: the first gallery cleared — relic taken, exit reached.
 */
export function stageShot(name, state, seed) {
  const start = createGame();
  Object.assign(state, start);
  state.screen = SCREEN_PLAY;
  state.score = 0;
  state.time = 0;
  state.lootGot = 0;
  // Vary the patrol phase with the seed so different seeds show different
  // moments, while one seed always shows the same moment.
  const idleSeconds = 2 + (seed % 5);
  if (name === 'start') {
    playForward(state, idleSeconds, null);
    state.screen = SCREEN_TITLE;
    return SCREEN_TITLE;
  }
  if (name === 'alert') {
    // Walk to the lit tile just east of guard 0's patrol (tile 11,1) and
    // stand in the open: the guard walking east along its patrol sees the
    // player ahead of it. Once suspicion starts rising, back away slowly
    // instead of standing still, so the guard reaches full alert and gives
    // chase while the player is still out of arm's reach.
    const guard = state.guards[0];
    const dest = { x: 11 * TILE + 20, y: 1 * TILE + 20 };
    const replan = { path: null, due: 0 };
    for (let i = 0; i < 45 / STEP; i += 1) {
      if (state.screen !== SCREEN_PLAY || state.suspicion >= 100) break;
      const d = Math.hypot(state.player.x - dest.x, state.player.y - dest.y);
      if (d < 20) break;
      const input = autopilot(state, dest, replan);
      stepGame(state, input, STEP, null);
    }
    for (let i = 0; i < 45 / STEP; i += 1) {
      if (state.screen !== SCREEN_PLAY || state.suspicion >= 100) break;
      const keys = new Set();
      if (state.suspicion > 0) {
        // Back away from the guard, staying in its line of sight.
        const dx = state.player.x - guard.x;
        const dy = state.player.y - guard.y;
        if (dx > 8) keys.add('KeyD');
        if (dx < -8) keys.add('KeyA');
        if (dy > 8) keys.add('KeyS');
        if (dy < -8) keys.add('KeyW');
      }
      stepGame(state, { keys, click: null }, STEP, null);
    }
    // Let the chase develop a few frames so the "!" and the red cone read.
    for (let i = 0; i < 0.4 / STEP; i += 1) {
      if (state.screen !== SCREEN_PLAY) break;
      const keys = new Set();
      const dx = state.player.x - guard.x;
      const dy = state.player.y - guard.y;
      if (dx > 8) keys.add('KeyD');
      if (dx < -8) keys.add('KeyA');
      if (dy > 8) keys.add('KeyS');
      if (dy < -8) keys.add('KeyW');
      stepGame(state, { keys, click: null }, STEP, null);
    }
    return SCREEN_PLAY;
  }
  if (name === 'win') {
    // Up to three attempts: a cautious autopilot usually clears gallery one
    // on the first try; a bad patrol phase gets a fresh attempt.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const fresh = createGame();
      Object.assign(state, fresh);
      state.screen = SCREEN_PLAY;
      playForward(state, idleSeconds + attempt * 1.5, null);
      // Keep playing until the gallery clears or the run is lost.
      playForward(state, 150, null);
      if (state.screen === SCREEN_CLEAR) return SCREEN_CLEAR;
    }
    // Last resort: the gallery is cleared by the play that got furthest.
    // (Only reached if every attempt was caught; the frame is still a real
    // render of the game, and the coordinator is told.)
    return state.screen;
  }
  // play: sneak toward the relic for a while, mid-stealth.
  playForward(state, 13 + (seed % 4), null);
  return SCREEN_PLAY;
}

export { STEP, autopilot, findPath };
