// The Velvet Hour — player: the cat burglar. Walk, sneak or run, with
// collision against the museum's walls and cases, and footsteps whose
// loudness is the game's central trade-off: running is fast and heard.
import {
  NOISE_RUN_RADIUS,
  NOISE_SNEAK_RADIUS,
  NOISE_WALK_RADIUS,
  PLAYER_RADIUS,
  PLAYER_RUN_SPEED,
  PLAYER_SNEAK_SPEED,
  PLAYER_WALK_SPEED,
  TILE,
} from './config.js';
import { circleHitsSolid } from './levels.js';

export function createPlayer(start) {
  return {
    x: start.x,
    y: start.y,
    angle: -Math.PI / 2, // facing north, up the gallery
    stance: 'walk', // walk | sneak | run
    moving: false,
    stepTimer: 0,
    stepCount: 0,
    clickTarget: null,
    noiseRadius: 0,
  };
}

/** Speed and noise for a stance, in one place so HUD and AI agree. */
export function stanceProfile(stance) {
  if (stance === 'sneak') return { speed: PLAYER_SNEAK_SPEED, noise: NOISE_SNEAK_RADIUS, stepInterval: 0.62 };
  if (stance === 'run') return { speed: PLAYER_RUN_SPEED, noise: NOISE_RUN_RADIUS, stepInterval: 0.3 };
  return { speed: PLAYER_WALK_SPEED, noise: NOISE_WALK_RADIUS, stepInterval: 0.46 };
}

/** Try to move by (dx, dy), sliding along walls instead of sticking. */
function tryMove(player, grid, dx, dy) {
  // The collision circle is 1px smaller than the drawn body: a graze on a
  // case's corner must not wedge the player in place.
  const radius = PLAYER_RADIUS - 1;
  const nx = player.x + dx;
  if (!circleHitsSolid(grid, nx, player.y, radius)) player.x = nx;
  const ny = player.y + dy;
  if (!circleHitsSolid(grid, player.x, ny, radius)) player.y = ny;
}

/**
 * Step the player. `input` carries the keys held and any click-to-move
 * target; `onStep` fires on each footstep with the stance, so the game can
 * play the sound and the guards can hear the noise.
 */
export function updatePlayer(player, input, dt, grid, onStep) {
  const sneak = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') || input.keys.has('KeyC');
  const run = input.keys.has('ControlLeft') || input.keys.has('ControlRight');
  player.stance = sneak ? 'sneak' : run ? 'run' : 'walk';

  let mx = 0;
  let my = 0;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) my -= 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) my += 1;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) mx -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) mx += 1;

  // Click-to-move: walk toward the clicked floor tile until it is reached
  // or a key is pressed. Clicking always walks, never runs.
  if (mx === 0 && my === 0 && player.clickTarget) {
    const dx = player.clickTarget.x - player.x;
    const dy = player.clickTarget.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 10) {
      player.clickTarget = null;
    } else {
      mx = dx / dist;
      my = dy / dist;
      player.stance = 'walk';
    }
  }

  const len = Math.hypot(mx, my);
  player.moving = len > 0;
  if (player.moving) {
    const profile = stanceProfile(player.stance);
    mx /= len;
    my /= len;
    tryMove(player, grid, mx * profile.speed * dt, my * profile.speed * dt);
    player.angle = Math.atan2(my, mx);
    player.noiseRadius = profile.noise;
    player.stepTimer += dt;
    if (player.stepTimer >= profile.stepInterval) {
      player.stepTimer = 0;
      player.stepCount += 1;
      if (onStep) onStep(player.stance);
    }
  } else {
    player.noiseRadius = 0;
    player.stepTimer = 0;
  }
  return player;
}

export { TILE, PLAYER_RADIUS };
