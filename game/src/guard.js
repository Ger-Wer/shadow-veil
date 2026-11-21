// Shadow Veil — guards: patrol waypoints, scan at each stop, and
// watch a vision cone. A guard's suspicion (0..1) fills while the
// player is inside the cone with a clear line of sight, drains when
// hidden. States: patrol -> suspicious -> alert (chase) -> search
// -> back to patrol. Noise pulls a guard to investigate.

import {
  TILE,
  GUARD_PATROL,
  GUARD_CHASE,
  GUARD_SEARCH,
  CONE_RANGE,
  CONE_HALF_ANGLE,
  CONE_RANGE_SHADOW,
  DETECT_FILL,
  DETECT_FILL_SNEAK,
  DETECT_FILL_SHADOW,
  DETECT_FILL_RUN,
  DETECT_DRAIN,
  SUSPICIOUS_AT,
  ALERT_AT,
  SPOTTED_AT,
  SEARCH_SECONDS,
  WAYPOINT_PAUSE,
  CATCH_DISTANCE,
} from './config.js';
import { blocksSight } from './levels.js';

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class Guard {
  constructor(waypoints) {
    this.waypoints = waypoints.map(([c, r]) => ({
      x: (c + 0.5) * TILE,
      y: (r + 0.5) * TILE,
    }));
    this.x = this.waypoints[0].x;
    this.y = this.waypoints[0].y;
    this.wpIndex = 1 % this.waypoints.length;
    this.facing = 0;
    this.state = 'patrol'; // patrol | suspicious | alert | search
    this.suspicion = 0;
    this.pauseLeft = 0;
    this.searchLeft = 0;
    this.lastSeen = null; // {x, y} where the player was last spotted
    this.investigate = null; // {x, y} noise to check out
    this.scanDir = 1;
    this.seesPlayer = false;
  }

  reset() {
    this.x = this.waypoints[0].x;
    this.y = this.waypoints[0].y;
    this.wpIndex = 1 % this.waypoints.length;
    this.facing = 0;
    this.state = 'patrol';
    this.suspicion = 0;
    this.pauseLeft = 0;
    this.searchLeft = 0;
    this.lastSeen = null;
    this.investigate = null;
    this.seesPlayer = false;
  }

  // True when the player stands inside the cone with nothing
  // solid (wall or crate) between guard and player.
  canSee(player, parsed) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const range = player.inShadow ? CONE_RANGE * CONE_RANGE_SHADOW : CONE_RANGE;
    if (dist > range) return false;
    const angle = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(angle, this.facing)) > CONE_HALF_ANGLE) return false;
    // Sample the ray every 8px; a solid tile anywhere blocks sight.
    const steps = Math.ceil(dist / 8);
    for (let i = 1; i < steps; i += 1) {
      const px = this.x + (dx * i) / steps;
      const py = this.y + (dy * i) / steps;
      const col = Math.floor(px / TILE);
      const row = Math.floor(py / TILE);
      if (blocksSight(parsed, col, row)) return false;
    }
    return true;
  }

  hearNoise(x, y, radius) {
    if (this.state === 'alert') return;
    const dist = Math.hypot(x - this.x, y - this.y);
    if (dist <= radius) {
      this.investigate = { x, y };
      if (this.state === 'patrol') this.state = 'suspicious';
    }
  }

  update(dt, player, parsed, events) {
    this.seesPlayer = this.canSee(player, parsed);
    const prevState = this.state;

    if (this.seesPlayer) {
      // Fill faster when the player runs, slower sneaking or in shadow.
      let rate = DETECT_FILL;
      if (player.sneaking) rate *= DETECT_FILL_SNEAK;
      if (player.running) rate *= DETECT_FILL_RUN;
      if (player.inShadow) rate *= DETECT_FILL_SHADOW;
      this.suspicion = Math.min(SPOTTED_AT, this.suspicion + rate * dt);
      this.lastSeen = { x: player.x, y: player.y };
      this.facing = Math.atan2(player.y - this.y, player.x - this.x);
      if (this.suspicion >= ALERT_AT && this.state !== 'alert') {
        this.state = 'alert';
        events.push('alert');
      } else if (this.suspicion >= SUSPICIOUS_AT && this.state === 'patrol') {
        this.state = 'suspicious';
        events.push('suspicious');
      }
    } else {
      this.suspicion = Math.max(0, this.suspicion - DETECT_DRAIN * dt);
      if (this.state === 'suspicious' && this.suspicion <= 0.02) {
        this.state = this.investigate ? 'suspicious' : 'patrol';
      }
    }

    if (this.state === 'alert') this._chase(dt, player, parsed, events);
    else if (this.state === 'search') this._search(dt, events);
    else if (this.state === 'suspicious' && this.investigate) this._investigate(dt, events);
    else this._patrol(dt, events);

    if (prevState !== this.state && this.state === 'patrol') {
      this.investigate = null;
    }
  }

  _moveToward(tx, ty, speed, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return true;
    const step = Math.min(dist, speed * dt);
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    this.facing = Math.atan2(dy, dx);
    return dist <= speed * dt + 1;
  }

  _patrol(dt, events) {
    if (this.pauseLeft > 0) {
      // Scan the room while waiting at a waypoint.
      this.pauseLeft -= dt;
      this.facing += this.scanDir * 0.9 * dt;
      if (this.facing > Math.PI) this.scanDir = -1;
      if (this.facing < -Math.PI) this.scanDir = 1;
      return;
    }
    const target = this.waypoints[this.wpIndex];
    if (this._moveToward(target.x, target.y, GUARD_PATROL, dt)) {
      this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
      this.pauseLeft = WAYPOINT_PAUSE;
    }
    void events;
  }

  _investigate(dt, events) {
    const target = this.investigate;
    if (!target) {
      this.state = 'patrol';
      return;
    }
    if (this._moveToward(target.x, target.y, GUARD_SEARCH, dt)) {
      this.investigate = null;
      this.state = 'search';
      this.searchLeft = SEARCH_SECONDS;
    }
    void events;
  }

  _chase(dt, player, parsed, events) {
    const target = this.seesPlayer ? { x: player.x, y: player.y } : this.lastSeen;
    if (!target) {
      this.state = 'search';
      this.searchLeft = SEARCH_SECONDS;
      return;
    }
    this._moveToward(target.x, target.y, GUARD_CHASE, dt);
    // Caught the player?
    if (Math.hypot(player.x - this.x, player.y - this.y) < CATCH_DISTANCE) {
      events.push('caught');
      return;
    }
    // Lost the trail: give up and search the last seen spot.
    if (!this.seesPlayer && Math.hypot(target.x - this.x, target.y - this.y) < 14) {
      this.state = 'search';
      this.searchLeft = SEARCH_SECONDS;
    }
    void parsed;
  }

  _search(dt, events) {
    this.searchLeft -= dt;
    this.facing += 1.6 * dt;
    if (this.searchLeft <= 0) {
      this.state = 'patrol';
      this.suspicion = 0;
    }
    void events;
  }
}
