// Shadow Veil — staged states for screenshots (?shot=...).
// The game itself is fully playable; these query params only pose
// it for its own screenshots, with fixed positions so every shot
// is reproducible:
//   ?shot=start  title screen over the level
//   ?shot=play   mid-level: one clue taken, a guard sweeping by
//   ?shot=alert  a guard has spotted the player (red cone, SPOTTED!)
//   ?shot=win    the victory screen with stats

import { TILE } from './config.js';

export function applyShot(game, params) {
  const shot = params.get('shot');
  if (!shot) return false;
  game.sounds.ensure = () => {};
  // Screenshot poses: the canvas draws its own HUD strip and overlay
  // screens, and the DOM screens stay out of the way.
  game.shotMode = true;
  game.hud.showScreen(null);

  if (shot === 'start') {
    game.showTitle();
    game.hud.showScreen(null);
    return true;
  }

  if (shot === 'play' || shot === 'alert' || shot === 'win') {
    game.state = 'playing';
    game.hud.showScreen(null);
    if (shot === 'play') {
      // Player crouched behind the crate at (3,3), one clue pocketed,
      // guard A mid-patrol with its cone sweeping the room.
      game.player.x = 3.5 * TILE;
      game.player.y = 4.5 * TILE;
      game.player.sneaking = true;
      game.player.facing = Math.PI / 2;
      game.parsed.clues[0].taken = true;
      game.cluesTaken = 1;
      const guard = game.guards[0];
      guard.x = 10.5 * TILE;
      guard.y = 5.5 * TILE;
      guard.facing = Math.PI / 2;
      guard.suspicion = 0.18;
      game.guards[1].x = 20.5 * TILE;
      game.guards[1].y = 6.5 * TILE;
      game.guards[1].facing = Math.PI;
      game.showBanner('STAY LOW', 'Shift — sneak · Click — move · M — mute', 999);
      game.banner.until = performance.now() + 999999;
    } else if (shot === 'alert') {
      // Player caught in the open, guard A alerted and closing in.
      game.player.x = 10.5 * TILE;
      game.player.y = 3.5 * TILE;
      game.player.facing = Math.PI;
      const guard = game.guards[0];
      guard.x = 8.5 * TILE;
      guard.y = 3.5 * TILE;
      guard.facing = 0;
      guard.state = 'alert';
      guard.suspicion = 1;
      guard.lastSeen = { x: game.player.x, y: game.player.y };
      game.parsed.clues[0].taken = true;
      game.cluesTaken = 1;
      game.spottedCount = 1;
      game.showBanner('SPOTTED!', 'Break line of sight — hide in shadow or behind crates.', 999);
      game.banner.until = performance.now() + 999999;
    } else if (shot === 'win') {
      game.cluesTaken = 3;
      game.parsed.clues.forEach((c) => { c.taken = true; });
      game.timePlayed = 187;
      game.spottedCount = 0;
      game.state = 'won';
      game.hud.showScreen(null);
    }
    return true;
  }
  return false;
}
