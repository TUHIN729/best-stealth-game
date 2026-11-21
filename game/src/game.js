// The Velvet Hour — game: the state machine that ties the pieces together.
// Screens: title, play, paused, level-clear, caught, win. The step
// function advances one tick: the player moves, the guards watch, suspicion
// rises and falls, loot and the relic are collected, and reaching the exit
// with the relic clears the gallery. Everything here is pure logic; the
// renderer only reads this state, and the screenshot autopilot drives it.
import {
  GUARD_RADIUS,
  SCORE_LOOT,
  SCORE_RELIC,
} from './config.js';
import { LEVELS, parseLevel } from './levels.js';
import { GUARD_ALERT, createGuard, guardSeesPlayer, updateGuard } from './guard.js';
import { createPlayer, updatePlayer } from './player.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';

/** A fresh run: level one, no loot, no suspicion, on the title screen. */
export function createGame() {
  const state = {
    screen: SCREEN_TITLE,
    levelIndex: 0,
    level: null,
    player: null,
    guards: [],
    suspicion: 0,
    maxSuspicion: 0,
    lootGot: 0,
    lootTotal: 0,
    relicGot: false,
    score: 0,
    time: 0,
    clearTime: 0,
    levelTime: 0,
    caughtBy: null,
    muted: false,
    message: '',
    messageTimer: 0,
    flash: 0, // red edge flash after being spotted
  };
  loadLevel(state, 0);
  return state;
}

/** Set the state up for a level: fresh player, fresh guards, reset timer. */
export function loadLevel(state, index) {
  state.levelIndex = index;
  state.level = parseLevel(LEVELS[index]);
  state.player = createPlayer(state.level.playerStart);
  state.guards = state.level.guardDefs.map((def, i) => createGuard(def, i));
  state.suspicion = 0;
  state.relicGot = false;
  state.levelTime = 0;
  state.lootTotal = state.level.loot.length;
  state.message = '';
  state.messageTimer = 0;
  state.caughtBy = null;
}

export function startGame(state) {
  state.screen = SCREEN_PLAY;
  state.score = 0;
  state.time = 0;
  state.lootGot = 0;
  state.maxSuspicion = 0;
  loadLevel(state, 0);
}

export function nextLevel(state) {
  if (state.levelIndex + 1 >= LEVELS.length) {
    state.screen = SCREEN_WIN;
    return;
  }
  loadLevel(state, state.levelIndex + 1);
  state.screen = SCREEN_PLAY;
}

function setMessage(state, text, seconds) {
  state.message = text;
  state.messageTimer = seconds || 2.5;
}

/**
 * One tick of play. `sound` is the SoundBank (or null in shot mode);
 * `events` is filled with what happened, for the caller to react to.
 */
export function stepGame(state, input, dt, sound) {
  if (state.screen !== SCREEN_PLAY) return;
  state.time += dt;
  state.levelTime += dt;
  if (state.messageTimer > 0) state.messageTimer -= dt;
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2);

  const player = state.player;
  const level = state.level;

  // Mouse click becomes a click-to-move target on the floor.
  if (input.click) {
    player.clickTarget = { x: input.click.x, y: input.click.y };
    input.click = null;
  }

  updatePlayer(player, input, dt, level.grid, (stance) => {
    if (sound) sound.footstep(stance, 0);
    // Running is heard: any guard inside the noise radius investigates.
    if (stance === 'run') {
      for (const guard of state.guards) {
        const dist = Math.hypot(guard.x - player.x, guard.y - player.y);
        if (dist < 280 && guard.state !== GUARD_ALERT) {
          guard.heardNoise = true;
          guard.investigate = { x: player.x, y: player.y };
        }
      }
    }
  });

  // Guards watch, patrol, chase. Their footsteps are audible when close.
  const events = {};
  let peak = 0;
  for (const guard of state.guards) {
    const suspicion = updateGuard(guard, dt, level, player, player.stance, events);
    peak = Math.max(peak, suspicion);
    if (guard.state === GUARD_ALERT && sound) {
      // A chasing guard's steps, panned by direction, sell the danger.
      guard.stepTimer = (guard.stepTimer || 0) + dt;
      if (guard.stepTimer > 0.42) {
        guard.stepTimer = 0;
        const pan = Math.max(-0.8, Math.min(0.8, (guard.x - player.x) / 300));
        sound.guardStep(pan, Math.hypot(guard.x - player.x, guard.y - player.y));
      }
    }
  }
  const previous = state.suspicion;
  state.suspicion = peak;
  state.maxSuspicion = Math.max(state.maxSuspicion, peak);
  if (sound) {
    if (events.alerted) {
      sound.alertSting();
      state.flash = 1;
      setMessage(state, 'SPOTTED! Break line of sight!', 2.5);
    } else if (events.calmed) {
      setMessage(state, 'The guard lost you. Stay in the shadows.', 2.5);
    } else if (events.heard) {
      sound.suspiciousBlip();
    } else if (peak >= 35 && previous < 35) {
      sound.suspiciousBlip();
      setMessage(state, 'A guard is suspicious — freeze or hide!', 2);
    }
  }

  // Loot: walk over a gem to pocket it.
  for (const gem of level.loot) {
    if (!gem.taken && Math.hypot(gem.x - player.x, gem.y - player.y) < 26) {
      gem.taken = true;
      state.lootGot += 1;
      state.score += SCORE_LOOT;
      if (sound) sound.pickup(false);
      setMessage(state, `Loot pocketed (+${SCORE_LOOT})`, 1.5);
    }
  }

  // The relic: the reason you came. It glows; take it, then leave unseen.
  const relic = level.relic;
  if (!relic.taken && Math.hypot(relic.x - player.x, relic.y - player.y) < 28) {
    relic.taken = true;
    state.relicGot = true;
    state.score += SCORE_RELIC;
    if (sound) sound.pickup(true);
    setMessage(state, 'The Moonstone Idol is yours — reach the green exit!', 3.5);
  }

  // The exit only opens once the relic is taken.
  const exit = level.exit;
  if (state.relicGot && Math.hypot(exit.x - player.x, exit.y - player.y) < 30) {
    const timeBonus = Math.max(0, Math.round(300 - state.levelTime * 2));
    state.score += timeBonus;
    state.clearTime = state.levelTime;
    state.screen = SCREEN_CLEAR;
    if (sound) sound.winJingle();
    return;
  }

  // Caught: a guard gets within arm's reach, alerted or bumped into.
  for (const guard of state.guards) {
    const dist = Math.hypot(guard.x - player.x, guard.y - player.y);
    const seen = guard.state === GUARD_ALERT || guardSeesPlayer(guard, level, player);
    if (dist < GUARD_RADIUS + 13 && (guard.state === GUARD_ALERT || dist < 22 || seen)) {
      state.screen = SCREEN_CAUGHT;
      state.caughtBy = guard.index;
      if (sound) sound.caughtJingle();
      return;
    }
  }
}

/** Keys the title / end screens answer to, outside the play step. */
export function handleMenuKey(state, code, sound) {
  if (code === 'KeyM') {
    state.muted = !state.muted;
    if (sound) sound.setMuted(state.muted);
    return;
  }
  if (state.screen === SCREEN_TITLE && (code === 'Enter' || code === 'Space')) {
    if (sound) { sound.ensure(); sound.click(); }
    startGame(state);
    return;
  }
  if (state.screen === SCREEN_PLAY && (code === 'KeyP' || code === 'Escape')) {
    state.screen = SCREEN_PAUSED;
    if (sound) sound.click();
    return;
  }
  if (state.screen === SCREEN_PAUSED && (code === 'KeyP' || code === 'Escape' || code === 'Enter')) {
    state.screen = SCREEN_PLAY;
    if (sound) sound.click();
    return;
  }
  if (state.screen === SCREEN_CLEAR && (code === 'Enter' || code === 'Space')) {
    if (sound) sound.click();
    nextLevel(state);
    return;
  }
  if ((state.screen === SCREEN_CAUGHT || state.screen === SCREEN_WIN) && (code === 'KeyR' || code === 'Enter')) {
    if (sound) sound.click();
    if (state.screen === SCREEN_CAUGHT) {
      loadLevel(state, state.levelIndex);
      state.screen = SCREEN_PLAY;
    } else {
      startGame(state);
    }
  }
}

export { LEVELS };
