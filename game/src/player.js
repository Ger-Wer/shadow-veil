// Shadow Veil — the player: keyboard or click-to-move, wall
// sliding, sneak (Shift) and noise. One job: where the player is
// and how loud they are.

import {
  TILE,
  PLAYER_WALK,
  PLAYER_SNEAK,
  NOISE_WALK,
  NOISE_RUN,
  NOISE_SNEAK,
  COLS,
  ROWS,
} from './config.js';
import { isSolidTile } from './levels.js';

export class Player {
  constructor(startCol, startRow) {
    this.radius = 13;
    this.reset(startCol, startRow);
  }

  reset(startCol, startRow) {
    this.x = (startCol + 0.5) * TILE;
    this.y = (startRow + 0.5) * TILE;
    this.facing = 0;
    this.moving = false;
    this.sneaking = false;
    this.running = false;
    this.inShadow = false;
    this.stepPhase = 0;
  }

  get tileCol() {
    return Math.floor(this.x / TILE);
  }

  get tileRow() {
    return Math.floor(this.y / TILE);
  }

  get noiseRadius() {
    if (!this.moving) return 0;
    if (this.sneaking) return NOISE_SNEAK;
    if (this.running) return NOISE_RUN;
    return NOISE_WALK;
  }

  update(dt, input, parsed, sounds) {
    const dir = input.keyboardDir();
    this.sneaking = input.sneaking;
    let vx = 0;
    let vy = 0;
    if (dir) {
      vx = dir.x;
      vy = dir.y;
    } else if (input.moveTarget) {
      const dx = input.moveTarget.x - this.x;
      const dy = input.moveTarget.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 6) {
        input.moveTarget = null;
      } else {
        vx = dx / dist;
        vy = dy / dist;
      }
    }

    const speed = this.sneaking ? PLAYER_SNEAK : PLAYER_WALK;
    this.running = !this.sneaking && (dir !== null || input.moveTarget !== null);
    this.moving = vx !== 0 || vy !== 0;
    if (this.moving) {
      this.facing = Math.atan2(vy, vx);
      this._move(vx * speed * dt, 0, parsed);
      this._move(0, vy * speed * dt, parsed);
      // Footsteps: a soft tap each half-stride.
      this.stepPhase += (speed * dt) / 26;
      if (this.stepPhase >= 1) {
        this.stepPhase -= 1;
        sounds.step(this.sneaking ? 0.25 : 0.7);
      }
    }

    this.inShadow = parsed.shadows.has(`${this.tileCol},${this.tileRow}`);
  }

  // Axis-separated movement: slide along walls instead of sticking.
  _move(dx, dy, parsed) {
    const nx = this.x + dx;
    const ny = this.y + dy;
    const r = this.radius;
    const minX = r + 1;
    const minY = r + 1;
    const maxX = COLS * TILE - r - 1;
    const maxY = ROWS * TILE - r - 1;
    const cx = Math.max(minX, Math.min(maxX, nx));
    const cy = Math.max(minY, Math.min(maxY, ny));
    if (!this._hitsSolid(cx, cy, parsed)) {
      this.x = cx;
      this.y = cy;
    }
  }

  _hitsSolid(x, y, parsed) {
    const r = this.radius - 2;
    const corners = [
      [x - r, y - r],
      [x + r, y - r],
      [x - r, y + r],
      [x + r, y + r],
    ];
    return corners.some(([px, py]) =>
      isSolidTile(parsed, Math.floor(px / TILE), Math.floor(py / TILE)),
    );
  }
}
