// The Velvet Hour — guard: patrol routes, vision cones and suspicion.
// A guard walks a loop of waypoints, pauses at each to look around, and
// watches a wedge of floor in front of it. When the player is seen inside
// the lit cone, suspicion climbs; at full suspicion the guard gives chase.
// Lose the guard and it searches the last place it saw you, then returns
// to its patrol and calms down. That rise-and-recover arc is the game.
import {
  ALERT_MEMORY_SECONDS,
  GUARD_CHASE_SPEED,
  GUARD_PATROL_SPEED,
  GUARD_PAUSE_SECONDS,
  GUARD_RADIUS,
  SEARCH_SECONDS,
  SUSPICION_ALERT_AT,
  SUSPICION_BASE_RATE,
  SUSPICION_DECAY_IN_SHADOW,
  SUSPICION_DECAY_RATE,
  SUSPICION_SUSPICIOUS_AT,
  VISION_HALF_ANGLE,
  VISION_RANGE,
} from './config.js';
import { hasLineOfSight, pointInLampLight, pointInShadow, tileCenter } from './levels.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALERT = 'alert';
export const GUARD_SEARCH = 'search';
export const GUARD_RETURN = 'return';

export function createGuard(def, index) {
  const [tx, ty] = def.path[0];
  const at = tileCenter(tx, ty);
  return {
    index,
    x: at.x,
    y: at.y,
    angle: 0, // facing, radians; 0 is east
    path: def.path.map(([wx, wy]) => tileCenter(wx, wy)),
    waypoint: 1 % def.path.length,
    state: GUARD_PATROL,
    suspicion: 0,
    pauseTimer: 0,
    scanPhase: 0,
    chaseTimer: 0,
    searchTimer: 0,
    lastSeen: null,
    investigate: null,
    heardNoise: false,
    justAlerted: false,
    justCalmed: false,
  };
}

/** Smallest signed turn from angle `from` toward angle `to`. */
export function angleDifference(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function pointInCone(guard, x, y) {
  const dx = x - guard.x;
  const dy = y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > VISION_RANGE) return false;
  if (dist < 4) return true;
  return Math.abs(angleDifference(guard.angle, Math.atan2(dy, dx))) < VISION_HALF_ANGLE;
}

/** Can this guard see the player right now (cone, range, line of sight)? */
export function guardSeesPlayer(guard, level, player) {
  if (!pointInCone(guard, player.x, player.y)) return false;
  return hasLineOfSight(level.grid, guard.x, guard.y, player.x, player.y);
}

/**
 * How fast suspicion builds while the player is seen: closer is worse,
 * bright light is worse, running is worse, sneaking in shadow is safest.
 */
export function suspicionRate(guard, level, player, stance) {
  const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
  const closeness = 1.35 - Math.min(1, dist / VISION_RANGE);
  let light = 0.55; // dim moonlight by default
  if (pointInShadow(level.grid, player.x, player.y)) light = 0.22;
  else if (pointInLampLight(level, player.x, player.y)) light = 1.0;
  const stanceFactor = stance === 'sneak' ? 0.6 : stance === 'run' ? 1.55 : 1.0;
  return SUSPICION_BASE_RATE * closeness * light * stanceFactor;
}

/** Walk toward a point at `speed`, turning to face the way of travel. */
function moveToward(guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  const targetAngle = Math.atan2(dy, dx);
  guard.angle += angleDifference(guard.angle, targetAngle) * Math.min(1, dt * 8);
  return dist - step < 2;
}

/**
 * Step one guard forward. `events` collects what happened this tick:
 * { alerted, calmed, heard } flags the game turns into sound and HUD.
 * Returns the guard's suspicion (0..100) for the HUD meter.
 */
export function updateGuard(guard, dt, level, player, stance, events) {
  guard.justAlerted = false;
  guard.justCalmed = false;
  const sees = guardSeesPlayer(guard, level, player);

  if (sees) {
    guard.lastSeen = { x: player.x, y: player.y };
    guard.suspicion = Math.min(SUSPICION_ALERT_AT, guard.suspicion + suspicionRate(guard, level, player, stance) * dt);
    guard.chaseTimer = ALERT_MEMORY_SECONDS;
    if (guard.suspicion >= SUSPICION_ALERT_AT && guard.state !== GUARD_ALERT) {
      guard.state = GUARD_ALERT;
      guard.justAlerted = true;
      events.alerted = true;
    } else if (guard.suspicion >= SUSPICION_SUSPICIOUS_AT && guard.state === GUARD_PATROL) {
      guard.state = GUARD_SUSPICIOUS;
    }
  } else {
    const decay = (pointInShadow(level.grid, player.x, player.y) ? SUSPICION_DECAY_IN_SHADOW : SUSPICION_DECAY_RATE);
    guard.suspicion = Math.max(0, guard.suspicion - decay * dt);
    if (guard.state === GUARD_ALERT) {
      guard.chaseTimer -= dt;
      if (guard.chaseTimer <= 0) {
        guard.state = GUARD_SEARCH;
        guard.searchTimer = SEARCH_SECONDS;
      }
    } else if (guard.state === GUARD_SUSPICIOUS && guard.suspicion < SUSPICION_SUSPICIOUS_AT) {
      guard.state = GUARD_PATROL;
      guard.justCalmed = true;
      events.calmed = true;
    }
  }

  // A loud noise the guard hears pulls it to investigate that spot.
  if (guard.heardNoise && guard.state !== GUARD_ALERT) {
    guard.suspicion = Math.min(SUSPICION_ALERT_AT - 1, guard.suspicion + 30);
    guard.state = GUARD_SEARCH;
    guard.searchTimer = SEARCH_SECONDS;
    guard.heardNoise = false;
    events.heard = true;
  }

  switch (guard.state) {
    case GUARD_PATROL: {
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
        // Look around while paused: a slow sweep, so the cone is learnable.
        guard.scanPhase += dt;
        guard.angle += Math.sin(guard.scanPhase * 1.6) * dt * 0.9;
        break;
      }
      const target = guard.path[guard.waypoint];
      if (moveToward(guard, target.x, target.y, GUARD_PATROL_SPEED, dt)) {
        guard.waypoint = (guard.waypoint + 1) % guard.path.length;
        guard.pauseTimer = GUARD_PAUSE_SECONDS;
        guard.scanPhase = 0;
      }
      break;
    }
    case GUARD_SUSPICIOUS: {
      // Freeze and stare at where the player was seen.
      if (guard.lastSeen) {
        const want = Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x);
        guard.angle += angleDifference(guard.angle, want) * Math.min(1, dt * 6);
      }
      break;
    }
    case GUARD_ALERT: {
      // Chase the player's live position.
      moveToward(guard, player.x, player.y, GUARD_CHASE_SPEED, dt);
      break;
    }
    case GUARD_SEARCH: {
      const target = guard.investigate ?? guard.lastSeen ?? guard.path[0];
      if (moveToward(guard, target.x, target.y, GUARD_PATROL_SPEED * 1.3, dt)) {
        guard.searchTimer -= dt;
        guard.angle += dt * 1.8; // sweep the room while searching
        if (guard.searchTimer <= 0) {
          guard.state = GUARD_RETURN;
          guard.investigate = null;
        }
      }
      break;
    }
    case GUARD_RETURN: {
      const home = guard.path[0];
      if (moveToward(guard, home.x, home.y, GUARD_PATROL_SPEED, dt)) {
        guard.state = GUARD_PATROL;
        guard.waypoint = 1 % guard.path.length;
      }
      break;
    }
    default:
      break;
  }
  return guard.suspicion;
}

/**
 * The cone as a polygon of raycast endpoints, so walls cut the wedge off
 * instead of the light shining through them. Used by the renderer.
 */
export function conePolygon(guard, level) {
  const points = [{ x: guard.x, y: guard.y }];
  const rays = 26;
  for (let i = 0; i <= rays; i += 1) {
    const a = guard.angle - VISION_HALF_ANGLE + (2 * VISION_HALF_ANGLE * i) / rays;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let reach = VISION_RANGE;
    for (let d = 8; d <= VISION_RANGE; d += 8) {
      const px = guard.x + dx * d;
      const py = guard.y + dy * d;
      const tx = Math.floor(px / 40);
      const ty = Math.floor(py / 40);
      if (tx < 0 || ty < 0 || ty >= level.grid.length || tx >= level.grid[0].length) { reach = d; break; }
      const ch = level.grid[ty][tx];
      if (ch === '#' || ch === 'C' || ch === 'D') { reach = d; break; }
    }
    points.push({ x: guard.x + dx * reach, y: guard.y + dy * reach });
  }
  return points;
}

export { GUARD_RADIUS };
