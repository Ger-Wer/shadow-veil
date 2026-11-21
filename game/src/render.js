// Shadow Veil — rendering: everything drawn on the canvas.
// Floor and walls, crates and shadow pools, clues and the exit,
// guards with their vision cones, the player, and the night
// vignette that makes the light pools read as safe ground.

import { TILE, COLS, ROWS, VIEW_W, VIEW_H, CONE_RANGE, CONE_HALF_ANGLE, COLORS } from './config.js';
import { drawText, textWidth } from './font.js';

// Trace an arc from straight segments: this headless Chromium draws
// ctx.arc's partial angles as a full circle, so wedges and rings are
// traced by hand instead of trusting arc.
function traceArc(ctx, x, y, r, a0, a1) {
  const steps = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 0.12));
  for (let i = 0; i <= steps; i += 1) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.time = 0;
  }

  draw(game) {
    const ctx = this.ctx;
    this.time += 1 / 60;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    this._drawFloor(game);
    this._drawShadows(game);
    this._drawExit(game);
    this._drawClues(game);
    this._drawCrates(game);
    this._drawWalls(game);
    this._drawCones(game);
    this._drawGuards(game);
    this._drawPlayer(game);
    this._drawParticles(game);
    this._drawVignette();
    this._drawBanner(game);
    if (game.shotMode) {
      this._drawStatusStrip(game);
      this._drawOverlayScreen(game);
    }
  }

  _drawFloor(game) {
    const ctx = this.ctx;
    const { parsed } = game;
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if (parsed.walls.has(`${c},${r}`)) continue;
        ctx.fillStyle = (c + r) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
        ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
        ctx.strokeStyle = COLORS.floorLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(c * TILE + 0.5, r * TILE + 0.5, TILE - 1, TILE - 1);
      }
    }
  }

  _drawShadows(game) {
    const ctx = this.ctx;
    for (const key of game.parsed.shadows) {
      const [c, r] = key.split(',').map(Number);
      ctx.fillStyle = 'rgba(4, 6, 12, 0.55)';
      ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
      // Diagonal hatch: the dark reads as cover at a glance.
      ctx.strokeStyle = 'rgba(120, 140, 190, 0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c * TILE + 6, r * TILE + TILE - 6);
      ctx.lineTo(c * TILE + TILE - 6, r * TILE + 6);
      ctx.moveTo(c * TILE + 16, r * TILE + TILE - 6);
      ctx.lineTo(c * TILE + TILE - 6, r * TILE + 16);
      ctx.stroke();
    }
  }

  _drawExit(game) {
    const ctx = this.ctx;
    const { exit } = game.parsed;
    const cx = (exit.col + 0.5) * TILE;
    const cy = (exit.row + 0.5) * TILE;
    const open = game.cluesTaken >= game.cluesTotal;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
    ctx.save();
    ctx.fillStyle = open ? COLORS.exitOpen : COLORS.exitLocked;
    ctx.globalAlpha = open ? 0.55 + 0.3 * pulse : 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = open ? '#a9f5c3' : '#f0a49c';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - 15, cy - 15, 30, 30);
    if (open) {
      // Arrow pointing out.
      ctx.fillStyle = '#0d0f16';
      ctx.beginPath();
      ctx.moveTo(cx + 9, cy);
      ctx.lineTo(cx - 3, cy - 7);
      ctx.lineTo(cx - 3, cy - 3);
      ctx.lineTo(cx - 9, cy - 3);
      ctx.lineTo(cx - 9, cy + 3);
      ctx.lineTo(cx - 3, cy + 3);
      ctx.lineTo(cx - 3, cy + 7);
      ctx.closePath();
      ctx.fill();
    } else {
      // Padlock.
      ctx.fillStyle = '#0d0f16';
      ctx.fillRect(cx - 7, cy - 2, 14, 11);
      ctx.strokeStyle = '#0d0f16';
      ctx.lineWidth = 3;
      ctx.beginPath();
      traceArc(ctx, cx, cy - 2, 5, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    const label = open ? 'EXIT - GO!' : 'EXIT - LOCKED';
    drawText(ctx, label, cx, cy + 22, 2, COLORS.text, 'center');
  }

  _drawClues(game) {
    const ctx = this.ctx;
    const pulse = 0.6 + 0.4 * Math.sin(this.time * 4);
    for (const clue of game.parsed.clues) {
      if (clue.taken) continue;
      const cx = (clue.col + 0.5) * TILE;
      const cy = (clue.row + 0.5) * TILE;
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.35 * pulse;
      ctx.fillStyle = COLORS.clue;
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff3c4';
      ctx.fillRect(cx - 8, cy - 10, 16, 20);
      ctx.strokeStyle = '#8a6d1f';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 8, cy - 10, 16, 20);
      ctx.strokeStyle = '#5c4a12';
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 4);
      ctx.lineTo(cx + 5, cy - 4);
      ctx.moveTo(cx - 5, cy);
      ctx.lineTo(cx + 5, cy);
      ctx.moveTo(cx - 5, cy + 4);
      ctx.lineTo(cx + 2, cy + 4);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawCrates(game) {
    const ctx = this.ctx;
    for (const key of game.parsed.crates) {
      const [c, r] = key.split(',').map(Number);
      const x = c * TILE;
      const y = r * TILE;
      ctx.fillStyle = COLORS.crate;
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = COLORS.crateEdge;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 2);
      ctx.lineTo(x + TILE - 2, y + TILE - 2);
      ctx.moveTo(x + TILE - 2, y + 2);
      ctx.lineTo(x + 2, y + TILE - 2);
      ctx.stroke();
    }
  }

  _drawWalls(game) {
    const ctx = this.ctx;
    for (const key of game.parsed.walls) {
      const [c, r] = key.split(',').map(Number);
      const x = c * TILE;
      const y = r * TILE;
      ctx.fillStyle = COLORS.wall;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = COLORS.wallTop;
      ctx.fillRect(x, y, TILE, 6);
      ctx.strokeStyle = '#14161d';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    }
  }

  _coneColor(guard) {
    if (guard.state === 'alert') return COLORS.coneAlert;
    if (guard.state === 'suspicious' || guard.state === 'search') return COLORS.coneSuspicious;
    return COLORS.coneCalm;
  }

  _drawCones(game) {
    const ctx = this.ctx;
    for (const guard of game.guards) {
      const range = CONE_RANGE;
      ctx.save();
      ctx.fillStyle = this._coneColor(guard);
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      traceArc(ctx, guard.x, guard.y, range, guard.facing - CONE_HALF_ANGLE, guard.facing + CONE_HALF_ANGLE);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  _drawGuards(game) {
    const ctx = this.ctx;
    for (const guard of game.guards) {
      // Body.
      ctx.fillStyle = COLORS.guard;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.guardDark;
      ctx.lineWidth = 3;
      ctx.stroke();
      // Facing tick.
      ctx.strokeStyle = '#ffd9d0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      ctx.lineTo(guard.x + Math.cos(guard.facing) * 17, guard.y + Math.sin(guard.facing) * 17);
      ctx.stroke();
      // State mark: ? when suspicious, ! when alerted.
      const mark = guard.state === 'alert' ? '!' : guard.state === 'suspicious' || guard.state === 'search' ? '?' : null;
      if (mark) {
        const bounce = mark === '!' ? Math.sin(this.time * 8) * 2 : 0;
        const color = mark === '!' ? '#ff5040' : '#ffb020';
        drawText(ctx, mark, guard.x, guard.y - 40 + bounce, 3, color, 'center');
      }
      // Suspicion ring while the guard is filling up on the player.
      if (guard.suspicion > 0.03 && guard.state !== 'alert') {
        ctx.strokeStyle = guard.suspicion >= 0.72 ? '#ff5040' : '#ffb020';
        ctx.lineWidth = 3;
        ctx.beginPath();
        traceArc(ctx, guard.x, guard.y, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * guard.suspicion);
        ctx.stroke();
      }
    }
  }

  _drawPlayer(game) {
    const ctx = this.ctx;
    const p = game.player;
    // Soft shadow under the player.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 9, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hooded figure: teal circle, darker rim, facing tick.
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.playerDark;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = '#d8fff8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.facing) * 16, p.y + Math.sin(p.facing) * 16);
    ctx.stroke();
    // Sneak = crouched: a smaller inner dot.
    if (p.sneaking) {
      ctx.fillStyle = COLORS.playerDark;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Click-to-move target marker.
    const target = game.input.moveTarget;
    if (target) {
      ctx.strokeStyle = 'rgba(232, 230, 223, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 8 + 2 * Math.sin(this.time * 5), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _drawParticles(game) {
    const ctx = this.ctx;
    for (const pt of game.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawVignette() {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42,
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85,
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // The in-game banner ("SPOTTED!", "CLUE 1 / 3", ...) lives on the
  // canvas itself, so it is part of every render of the game.
  _drawBanner(game) {
    const ctx = this.ctx;
    const banner = game.banner;
    if (!banner) return;
    ctx.save();
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 10;
    drawText(ctx, banner.text, VIEW_W / 2, VIEW_H * 0.18 - 14, 4, COLORS.clue, 'center');
    drawText(ctx, banner.sub, VIEW_W / 2, VIEW_H * 0.18 + 22, 2, COLORS.text, 'center');
    ctx.restore();
  }

  // Screenshot mode only: a status strip along the bottom edge, so a
  // bare canvas capture still shows clues, alert state, lives, time.
  _drawStatusStrip(game) {
    const ctx = this.ctx;
    const alert = game.alertLevel;
    const label = alert >= 0.72 ? 'SPOTTED!' : alert >= 0.35 ? 'Suspicious…' : 'Hidden';
    const alertColor = alert >= 0.72 ? '#ff5040' : alert >= 0.35 ? '#ffb020' : '#2ec4b6';
    ctx.save();
    ctx.fillStyle = 'rgba(8, 10, 15, 0.85)';
    ctx.fillRect(0, VIEW_H - 30, VIEW_W, 30);
    drawText(ctx, `LEVEL ${game.levelIndex + 1}/2`, 12, VIEW_H - 22, 2, COLORS.text, 'left');
    drawText(ctx, `CLUES ${game.cluesTaken} / ${game.cluesTotal}`, 140, VIEW_H - 22, 2, COLORS.clue, 'left');
    // Alert meter.
    ctx.fillStyle = '#232838';
    ctx.fillRect(290, VIEW_H - 22, 150, 14);
    ctx.fillStyle = alertColor;
    ctx.fillRect(290, VIEW_H - 22, 150 * alert, 14);
    drawText(ctx, label, 450, VIEW_H - 22, 2, COLORS.text, 'left');
    // Lives as small hearts.
    for (let i = 0; i < 3; i += 1) {
      const hx = 600 + i * 22;
      const hy = VIEW_H - 15;
      ctx.fillStyle = i < game.lives ? '#ff6b81' : '#4a4f61';
      ctx.beginPath();
      ctx.arc(hx - 3, hy - 2, 4, 0, Math.PI * 2);
      ctx.arc(hx + 3, hy - 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx - 7, hy - 1);
      ctx.lineTo(hx + 7, hy - 1);
      ctx.lineTo(hx, hy + 7);
      ctx.closePath();
      ctx.fill();
    }
    drawText(ctx, game.timeText, VIEW_W - 12, VIEW_H - 22, 2, COLORS.text, 'right');
    ctx.restore();
  }

  // Screenshot mode only: the title / victory / defeat screens drawn
  // on the canvas, so a bare canvas capture shows them whole.
  _drawOverlayScreen(game) {
    const ctx = this.ctx;
    const state = game.state;
    if (state === 'playing') return;
    const screens = {
      title: {
        title: 'SHADOW VEIL',
        lines: [
          'Night shift at the Meridian Archive. Three clues are hidden',
          'on the floor, the exit is locked until you hold them all —',
          'and the guards patrol with lanterns and sharp eyes.',
          '',
          'WASD / arrows — move · Shift — sneak · Click — walk there',
          'Dark floor is shadow: detection fills slower there.',
          'Crates block a guard’s sight. Running is loud.',
        ],
        cta: 'START THE HEIST',
      },
      won: {
        title: 'YOU VANISHED',
        lines: [
          'All clues stolen, every guard left staring at empty corridors.',
          '',
          `Time ${game.timeText}  ·  Clues ${game.cluesTaken}/${game.cluesTotal}  ·  ${game.rank}`,
        ],
        cta: 'PLAY AGAIN',
      },
      levelclear: {
        title: 'LEVEL CLEAR',
        lines: [
          `Level ${game.levelIndex + 1} clear in ${game.timeText} — ${game.rank}`,
          '',
          'The next floor is guarded twice as well. Same rules: stay unseen.',
        ],
        cta: 'NEXT LEVEL',
      },
      gameover: {
        title: 'CAUGHT',
        lines: [
          'The guards know your face now. The archive keeps its secrets — this time.',
          '',
          `Clues ${game.cluesTaken}/${game.cluesTotal}  ·  Time ${game.timeText}`,
        ],
        cta: 'TRY AGAIN',
      },
      pause: null,
    };
    const screen = screens[state];
    if (!screen) return;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 10, 15, 0.84)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawText(ctx, screen.title, VIEW_W / 2, VIEW_H * 0.3 - 18, 5, COLORS.player, 'center');
    screen.lines.forEach((line, i) => {
      drawText(ctx, line, VIEW_W / 2, VIEW_H * 0.3 + 30 + i * 22, 2, '#cfd3de', 'center');
    });
    const ctaY = VIEW_H * 0.3 + 30 + screen.lines.length * 22 + 26;
    const ctaW = textWidth(screen.cta, 2) + 48;
    ctx.fillStyle = COLORS.player;
    // Plain rect: this headless Chromium draws roundRect as an empty path.
    ctx.fillRect(VIEW_W / 2 - ctaW / 2, ctaY - 20, ctaW, 40);
    drawText(ctx, screen.cta, VIEW_W / 2, ctaY - 7, 2, '#08211e', 'center');
    ctx.restore();
  }
}
