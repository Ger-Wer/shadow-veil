// Shadow Veil — shared constants for the whole game.
// One job: every number the other modules agree on lives here.

export const TILE = 40;
export const COLS = 24;
export const ROWS = 15;
export const VIEW_W = COLS * TILE; // 960
export const VIEW_H = ROWS * TILE; // 600

// Movement speeds, pixels per second.
export const PLAYER_WALK = 150;
export const PLAYER_SNEAK = 82;
export const GUARD_PATROL = 62;
export const GUARD_CHASE = 132;
export const GUARD_SEARCH = 78;

// Guard vision.
export const CONE_RANGE = 185;
export const CONE_HALF_ANGLE = 0.62; // ~35 degrees each side
export const CONE_RANGE_SHADOW = 0.72; // player in shadow looks closer

// Detection meter (0..1) fill and drain rates, per second.
export const DETECT_FILL = 0.85;
export const DETECT_FILL_SNEAK = 0.5;
export const DETECT_FILL_SHADOW = 0.38;
export const DETECT_FILL_RUN = 1.25;
export const DETECT_DRAIN = 0.32;
export const SUSPICIOUS_AT = 0.35; // guard turns and stares
export const ALERT_AT = 0.72; // guard chases the last seen spot
export const SPOTTED_AT = 1.0;

// Noise: guards inside the radius hear the player and investigate.
export const NOISE_WALK = 46;
export const NOISE_RUN = 118;
export const NOISE_SNEAK = 0;

// Game flow.
export const START_LIVES = 3;
export const CLUES_TO_WIN = 3;
export const CATCH_DISTANCE = 26;
export const SEARCH_SECONDS = 3.2;
export const WAYPOINT_PAUSE = 1.4;

// Colours.
export const COLORS = {
  floorA: '#20242e',
  floorB: '#1c2029',
  floorLine: '#262b38',
  shadow: '#0d0f16',
  wall: '#3a4152',
  wallTop: '#565f78',
  crate: '#6b4f2a',
  crateEdge: '#8a6a3b',
  clue: '#ffd94d',
  exitLocked: '#c0392b',
  exitOpen: '#2ecc71',
  player: '#2ec4b6',
  playerDark: '#1d7a72',
  guard: '#c0392b',
  guardDark: '#7e241a',
  coneCalm: 'rgba(255, 214, 90, 0.20)',
  coneSuspicious: 'rgba(255, 170, 40, 0.34)',
  coneAlert: 'rgba(255, 60, 40, 0.42)',
  text: '#e8e6df',
  muted: '#9aa0b0',
};
