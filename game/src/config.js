// The Velvet Hour — shared tuning constants for the whole game.
// One place holds every number the other files agree on, so a balance
// change never has to be hunted through five files.
export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const VIEW_W = COLS * TILE; // 1280
export const VIEW_H = ROWS * TILE; // 720

// Player movement, pixels per second.
export const PLAYER_WALK_SPEED = 150;
export const PLAYER_SNEAK_SPEED = 82;
export const PLAYER_RUN_SPEED = 235;
export const PLAYER_RADIUS = 13;

// Guard movement, pixels per second.
export const GUARD_PATROL_SPEED = 72;
export const GUARD_CHASE_SPEED = 168;
export const GUARD_RADIUS = 14;
export const GUARD_PAUSE_SECONDS = 1.4;

// Vision: how far a guard sees and how wide the cone opens.
export const VISION_RANGE = 215;
export const VISION_HALF_ANGLE = 0.62; // about 35 degrees each side

// Suspicion: 0 is unseen, 100 is fully alerted.
export const SUSPICION_SUSPICIOUS_AT = 35;
export const SUSPICION_ALERT_AT = 100;
export const SUSPICION_BASE_RATE = 62; // per second, point blank in full light
export const SUSPICION_DECAY_RATE = 18; // per second, unseen
export const SUSPICION_DECAY_IN_SHADOW = 30;
export const ALERT_MEMORY_SECONDS = 4; // how long a chase lasts with no sight
export const SEARCH_SECONDS = 3;

// Noise: running is heard this far away; walking barely carries.
export const NOISE_RUN_RADIUS = 280;
export const NOISE_WALK_RADIUS = 90;
export const NOISE_SNEAK_RADIUS = 0;

// Light: how visible the player is standing in each kind of floor.
export const LIGHT_SHADOW = 0.22;
export const LIGHT_DIM = 0.55;
export const LIGHT_LIT = 1.0;

// Stance multipliers on how fast suspicion builds.
export const STANCE_SNEAK = 0.6;
export const STANCE_WALK = 1.0;
export const STANCE_RUN = 1.55;

// Scoring.
export const SCORE_LOOT = 100;
export const SCORE_RELIC = 500;

// Palette: a moonlit museum — deep blue night, warm lamp gold, cold shadow.
export const COLORS = {
  floorA: '#2b3247',
  floorB: '#262d40',
  floorShadow: '#1a2033',
  floorLit: '#4a4234',
  wall: '#141824',
  wallTrim: '#8a6d2f',
  crate: '#6b4a2a',
  crateEdge: '#8a6238',
  caseGlass: '#7fb3d9',
  caseFrame: '#c9a227',
  lampGlow: '#ffca6a',
  relic: '#ffd94a',
  exit: '#37d67a',
  exitDark: '#0d5c2e',
  player: '#7b5cff',
  playerDark: '#4a2fb8',
  guard: '#c0392b',
  guardDark: '#7b1f16',
  coneCalm: 'rgba(255, 214, 90, 0.20)',
  coneSuspicious: 'rgba(255, 140, 40, 0.30)',
  coneAlert: 'rgba(255, 60, 40, 0.34)',
  hudBg: 'rgba(10, 12, 20, 0.82)',
  text: '#f2ead8',
  textDim: '#a89f88',
};
