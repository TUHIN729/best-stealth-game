// The Velvet Hour — level data: three hand-designed museum floors.
// Legend: # wall  . lit floor  , shadow floor (safe)  C crate (cover)
//         D display case (cover)  P player start  R relic  o loot  E exit.
// Guards and lamps are defined per level below the maps, as tile
// coordinates, so a patrol never has to be read out of the picture.
import { TILE } from './config.js';

const LEVEL_1_MAP = [
  '################################',
  '#......,,,,....#......,,,,.....#',
  '#..P...,,,,..C....o...,,,,..R..#',
  '#......,,,,....#......,,,,.....#',
  '#..C...,,,,..D.#..D...,,,,...C.#',
  '#......,,,,....#......,,,,.....#',
  '###.############.#####.#########',
  '#......,,,,....#......,,,,.....#',
  '#..o...,,,,..C....D...,,,,...o.#',
  '#......,,,,....#......,,,,.....#',
  '#..D...,,,,....#..C...,,,,...C.#',
  '#......,,,,....#......,,,,.....#',
  '###.############.#####.#########',
  '#......,,,,....#......,,,,.....#',
  '#..C...,,,,..o....C...,,,,...D.#',
  '#......,,,,....#......,,,,.....#',
  '#..E...,,,,....#......,,,,.....#',
  '################################',
];

const LEVEL_2_MAP = [
  '################################',
  '#......,,,#......,,,.#......,,,#',
  '#..P...C......o..D.......,,,,R.#',
  '#......,,,#......,,,.#......,,,#',
  '#..D...,,,#..C...,,,.#..C...,,,#',
  '#......,,,#......,,,.#......,,,#',
  '####.##########.##########.#####',
  '#......,,,#......,,,.#......,,,#',
  '#..o...,,,....D..,,,....o...,,,#',
  '#......,,,#......,,,.#......,,,#',
  '#..C...,,,#..o...,,,.#..D...,,,#',
  '#......,,,#..........#......,,,#',
  '####.##########.##########.#####',
  '#......,,,#......,,,.#......,,,#',
  '#..C...,,,....o..,,,....D...,,,#',
  '#......,,,#......,,,.#......,,,#',
  '#..E...,,,#......,,,.#......,,,#',
  '################################',
];

const LEVEL_3_MAP = [
  '################################',
  '#.......,,#........,,#.......,,#',
  '#..P...D....o.....D........,,R.#',
  '#.......,,#........,,#.......,,#',
  '#..D....,,#..C.....D,#..C....,,#',
  '#.......,,#........,,#.......,,#',
  '#####.#########.#########.######',
  '#.......,,#........,,#.......,,#',
  '#..o....,,...D.....o,...o....,,#',
  '#.......,,#........,,#.......,,#',
  '#..C....,,#.o......,,#..D....,,#',
  '#.......,,#........,,#.......,,#',
  '#####.#########.#########.######',
  '#.......,,#........,,#.......,,#',
  '#..C....,,....o....,,...D....,,#',
  '#.......,,#........,,#.......,,#',
  '#..E....,,#........,,#.......,,#',
  '################################',
];

// A patrol is a loop of tile waypoints the guard walks in order.
export const LEVELS = [
  {
    name: 'Gallery I — The Moonlit Wing',
    map: LEVEL_1_MAP,
    guards: [
      { path: [[2, 1], [11, 1], [11, 5], [2, 5]] },
      { path: [[17, 2], [27, 2], [27, 5], [17, 5]] },
      { path: [[6, 14], [12, 14], [12, 16], [6, 16]] },
    ],
    lamps: [[5, 1], [26, 1], [5, 8], [26, 8], [5, 15], [26, 15]],
    lampRadius: 175,
  },
  {
    name: 'Gallery II — The Marble Wing',
    map: LEVEL_2_MAP,
    guards: [
      { path: [[2, 1], [6, 1], [6, 5], [2, 5]] },
      { path: [[12, 2], [16, 2], [16, 5], [12, 5]] },
      { path: [[23, 1], [28, 1], [28, 5], [23, 5]] },
      { path: [[13, 14], [18, 14], [18, 16], [13, 16]] },
    ],
    lamps: [[4, 2], [14, 2], [24, 2], [4, 9], [14, 9], [24, 9], [4, 15], [14, 15], [24, 15]],
    lampRadius: 165,
  },
  {
    name: 'Gallery III — The Vault',
    map: LEVEL_3_MAP,
    guards: [
      { path: [[2, 1], [6, 1], [6, 5], [2, 5]] },
      { path: [[12, 2], [16, 2], [16, 5], [12, 5]] },
      { path: [[23, 1], [27, 1], [27, 5], [23, 5]] },
      { path: [[14, 8], [17, 8], [17, 11], [14, 11]] },
      { path: [[25, 14], [29, 14], [29, 16], [25, 16]] },
    ],
    lamps: [[4, 2], [14, 2], [24, 2], [4, 9], [14, 9], [24, 9], [4, 15], [14, 15], [24, 15]],
    lampRadius: 160,
  },
];

export function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

export function tileAt(grid, tx, ty) {
  if (tx < 0 || ty < 0 || ty >= grid.length || tx >= grid[0].length) return '#';
  return grid[ty][tx];
}

export function isSolidTile(ch) {
  return ch === '#' || ch === 'C' || ch === 'D';
}

export function blocksSightTile(ch) {
  return ch === '#' || ch === 'C' || ch === 'D';
}

export function isShadowTile(ch) {
  return ch === ',';
}

/** Turn a level definition into a playable level: grid plus placed objects. */
export function parseLevel(def) {
  const grid = def.map.map((row) => row.split(''));
  const level = {
    name: def.name,
    grid,
    lamps: def.lamps.map(([tx, ty]) => ({ ...tileCenter(tx, ty), radius: def.lampRadius })),
    lampRadius: def.lampRadius,
    playerStart: null,
    relic: null,
    exit: null,
    loot: [],
    guardDefs: def.guards,
  };
  for (let ty = 0; ty < grid.length; ty += 1) {
    for (let tx = 0; tx < grid[ty].length; tx += 1) {
      const ch = grid[ty][tx];
      const at = tileCenter(tx, ty);
      if (ch === 'P') { level.playerStart = at; grid[ty][tx] = '.'; }
      if (ch === 'R') { level.relic = { ...at, taken: false }; grid[ty][tx] = '.'; }
      if (ch === 'E') { level.exit = at; grid[ty][tx] = '.'; }
      if (ch === 'o') { level.loot.push({ ...at, taken: false }); grid[ty][tx] = '.'; }
    }
  }
  return level;
}

/** True when the point (pixels) stands on a shadow tile. */
export function pointInShadow(grid, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  return isShadowTile(tileAt(grid, tx, ty));
}

/** True when the point (pixels) stands inside any lamp's warm pool. */
export function pointInLampLight(level, x, y) {
  for (let i = 0; i < level.lamps.length; i += 1) {
    const lamp = level.lamps[i];
    const dx = x - lamp.x;
    const dy = y - lamp.y;
    if (dx * dx + dy * dy < lamp.radius * lamp.radius) return true;
  }
  return false;
}

/**
 * Line of sight between two pixel points: sample along the line and fail
 * on the first solid tile. Used by guard vision and by the cone renderer.
 */
export function hasLineOfSight(grid, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const tx = Math.floor((x0 + dx * t) / TILE);
    const ty = Math.floor((y0 + dy * t) / TILE);
    if (blocksSightTile(tileAt(grid, tx, ty))) return false;
  }
  return true;
}

/** True when a circle of `radius` at (x, y) overlaps any solid tile. */
export function circleHitsSolid(grid, x, y, radius) {
  const x0 = Math.floor((x - radius) / TILE);
  const x1 = Math.floor((x + radius) / TILE);
  const y0 = Math.floor((y - radius) / TILE);
  const y1 = Math.floor((y + radius) / TILE);
  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      if (!isSolidTile(tileAt(grid, tx, ty))) continue;
      const nearestX = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
      const nearestY = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
      const dx = x - nearestX;
      const dy = y - nearestY;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  }
  return false;
}
