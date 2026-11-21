// Shadow Veil — the game itself: state machine (title / playing /
// level-clear / won / game-over), the main loop, pickups, the exit,
// lives and the timer, and the HUD it drives in the DOM.

import { LEVELS, parseLevel } from './levels.js';
import { Player } from './player.js';
import { Guard } from './guard.js';
import { Renderer } from './render.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { VIEW_W, VIEW_H, START_LIVES, CLUES_TO_WIN, NOISE_WALK, NOISE_RUN, TILE } from './config.js';

export class Game {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.hud = hud;
    this.renderer = new Renderer(canvas);
    this.sounds = new SoundBank();
    this.input = new Input(canvas);
    this.particles = [];
    this.state = 'title'; // title | playing | levelclear | won | gameover
    this.levelIndex = 0;
    this.lives = START_LIVES;
    this.cluesTaken = 0;
    this.cluesTotal = CLUES_TO_WIN;
    this.timePlayed = 0;
    this.spottedCount = 0;
    this.banner = null; // {text, sub, until}
    this.lastTick = 0;
    this.paused = false;
    this.shotMode = false; // true while posing for screenshots (?shot=)

    this.input.onFirstGesture = () => this.sounds.ensure();
    this.input.onMute = () => this.toggleMute();
    this.input.onRestart = () => this.restartLevel();
    this.input.onPause = () => this.togglePause();
    this.hud.bind(this);
    this.loadLevel(0);
    this.showTitle();
  }

  loadLevel(index) {
    this.levelIndex = index;
    this.level = LEVELS[index];
    this.parsed = parseLevel(this.level);
    this.player = new Player(this.parsed.player.col, this.parsed.player.row);
    this.guards = this.level.guards.map((g) => new Guard(g.waypoints));
    this.cluesTaken = 0;
    this.cluesTotal = this.parsed.clues.length;
    this.particles = [];
    this.banner = null;
  }

  start() {
    this.sounds.ensure();
    this.state = 'playing';
    this.timePlayed = 0;
    this.lives = START_LIVES;
    this.spottedCount = 0;
    this.loadLevel(0);
    this.hud.showScreen(null);
    this.hud.setLevel(this.level.name, this.levelIndex + 1, LEVELS.length);
    this.showBanner(this.level.name, this.level.intro, 3.2);
    this.lastTick = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  restartLevel() {
    if (this.state === 'title') return;
    this.sounds.ensure();
    this.loadLevel(this.levelIndex);
    this.state = 'playing';
    this.hud.showScreen(null);
    this.hud.setLevel(this.level.name, this.levelIndex + 1, LEVELS.length);
    this.showBanner(this.level.name, this.level.intro, 2.6);
    this.lastTick = performance.now();
  }

  showTitle() {
    this.state = 'title';
    this.hud.showScreen('title');
    this.hud.setLevel(this.level.name, 1, LEVELS.length);
    this.hud.update(this);
  }

  toggleMute() {
    this.sounds.ensure();
    this.sounds.setMuted(!this.sounds.muted);
    this.hud.update(this);
  }

  togglePause() {
    if (this.state !== 'playing') return;
    this.paused = !this.paused;
    this.hud.showScreen(this.paused ? 'pause' : null);
    this.lastTick = performance.now();
  }

  showBanner(text, sub, seconds) {
    this.banner = { text, sub, until: performance.now() + seconds * 1000 };
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.lastTick) / 1000 || 0.016);
    this.lastTick = now;
    try {
      // Screenshot poses (?shot=) are frozen: the guards hold their
      // staged positions instead of patrolling on.
      if (this.state === 'playing' && !this.paused && !this.shotMode) {
        this.update(dt);
      }
      this.renderer.draw(this);
      this.hud.update(this);
    } catch (err) {
      // One bad frame must never freeze the game: report and continue.
      console.error('Shadow Veil frame error:', err);
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    this.timePlayed += dt;
    this.player.update(dt, this.input, this.parsed, this.sounds);

    // Noise: running footsteps pull nearby guards to investigate.
    if (this.player.moving && !this.player.sneaking) {
      const radius = this.player.running ? NOISE_RUN : NOISE_WALK;
      for (const guard of this.guards) {
        guard.hearNoise(this.player.x, this.player.y, radius);
      }
    }

    const events = [];
    for (const guard of this.guards) {
      guard.update(dt, this.player, this.parsed, events);
    }
    for (const ev of events) {
      if (ev === 'suspicious') this.sounds.suspicious();
      if (ev === 'alert') {
        this.sounds.alert();
        this.spottedCount += 1;
        this.showBanner('SPOTTED!', 'Break line of sight — hide in shadow or behind crates.', 2.2);
      }
      if (ev === 'caught') this.onCaught();
    }

    // Clues: walk over one to pocket it.
    for (const clue of this.parsed.clues) {
      if (clue.taken) continue;
      const cx = (clue.col + 0.5) * TILE;
      const cy = (clue.row + 0.5) * TILE;
      if (Math.hypot(this.player.x - cx, this.player.y - cy) < 26) {
        clue.taken = true;
        this.cluesTaken += 1;
        this.sounds.pickup();
        this.burst(cx, cy, '#ffd94d');
        if (this.cluesTaken >= this.cluesTotal) {
          this.sounds.unlock();
          this.showBanner('EXIT UNLOCKED', 'All clues found — get to the green exit.', 2.6);
        } else {
          this.showBanner(`CLUE ${this.cluesTaken} / ${this.cluesTotal}`, 'Keep low. The exit stays locked.', 1.6);
        }
      }
    }

    // Exit: only open once every clue is pocketed.
    const exit = this.parsed.exit;
    const ex = (exit.col + 0.5) * TILE;
    const ey = (exit.row + 0.5) * TILE;
    if (this.cluesTaken >= this.cluesTotal && Math.hypot(this.player.x - ex, this.player.y - ey) < 28) {
      this.onLevelClear();
    }

    // Particles drift and fade.
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);

    if (this.banner && performance.now() > this.banner.until) this.banner = null;
  }

  burst(x, y, color) {
    for (let i = 0; i < 14; i += 1) {
      const a = (i / 14) * Math.PI * 2;
      const speed = 40 + (i % 5) * 14;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.7,
        maxLife: 0.7,
        size: 2.5,
        color,
      });
    }
  }

  onCaught() {
    this.lives -= 1;
    this.sounds.busted();
    if (this.lives <= 0) {
      this.state = 'gameover';
      this.sounds.lose();
      this.hud.showScreen('gameover');
      return;
    }
    this.showBanner('CAUGHT!', `A guard grabbed you. ${this.lives} ${this.lives === 1 ? 'life' : 'lives'} left.`, 2.4);
    // Back to the start, guards reset to their patrols, clues kept.
    this.player.reset(this.parsed.player.col, this.parsed.player.row);
    for (const guard of this.guards) guard.reset();
    this.input.moveTarget = null;
  }

  onLevelClear() {
    this.sounds.win();
    if (this.levelIndex + 1 < LEVELS.length) {
      this.state = 'levelclear';
      this.hud.showScreen('levelclear');
    } else {
      this.state = 'won';
      this.hud.showScreen('won');
    }
  }

  nextLevel() {
    this.loadLevel(this.levelIndex + 1);
    this.state = 'playing';
    this.hud.showScreen(null);
    this.hud.setLevel(this.level.name, this.levelIndex + 1, LEVELS.length);
    this.showBanner(this.level.name, this.level.intro, 3.0);
    this.lastTick = performance.now();
  }

  get alertLevel() {
    let max = 0;
    for (const guard of this.guards) max = Math.max(max, guard.suspicion);
    return max;
  }

  get rank() {
    if (this.spottedCount === 0) return 'GHOST — never spotted';
    if (this.spottedCount <= 2) return 'SHADOW — spotted, but slipped away';
    return 'LOUD — the whole floor knows your name';
  }

  get timeText() {
    const total = Math.floor(this.timePlayed);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
}

// The HUD: the DOM bar above the canvas and the overlay screens.
// Kept in this file's companion class so game.js owns the wiring
// and index.html stays a thin shell.
export class Hud {
  constructor(root) {
    this.root = root;
    this.el = {};
    for (const id of ['clues', 'alertFill', 'alertLabel', 'lives', 'level', 'time', 'soundBtn', 'restartBtn']) {
      this.el[id] = root.querySelector(`#${id}`);
    }
    this.screens = {};
    for (const name of ['title', 'pause', 'levelclear', 'won', 'gameover']) {
      this.screens[name] = root.querySelector(`#screen-${name}`);
    }
    this.el.soundBtn.addEventListener('click', () => this.game.toggleMute());
    this.el.restartBtn.addEventListener('click', () => this.game.restartLevel());
    root.querySelector('#startBtn').addEventListener('click', () => this.game.start());
    root.querySelector('#againBtn').addEventListener('click', () => this.game.start());
    root.querySelector('#nextBtn').addEventListener('click', () => this.game.nextLevel());
    root.querySelector('#retryBtn').addEventListener('click', () => this.game.start());
    root.querySelector('#resumeBtn').addEventListener('click', () => this.game.togglePause());
  }

  bind(game) {
    this.game = game;
  }

  setLevel(name, n, total) {
    this.el.level.textContent = `Level ${n}/${total} — ${name}`;
  }

  showScreen(name) {
    for (const [key, el] of Object.entries(this.screens)) {
      el.classList.toggle('hidden', key !== name);
    }
    if (name === 'won') {
      const g = this.game;
      this.root.querySelector('#wonStats').textContent =
        `Time ${g.timeText} · Clues ${g.cluesTaken}/${g.cluesTotal} · ${g.rank}`;
    }
    if (name === 'levelclear') {
      this.root.querySelector('#clearStats').textContent =
        `Level ${this.game.levelIndex + 1} clear in ${this.game.timeText} — ${this.game.rank}`;
    }
    if (name === 'gameover') {
      this.root.querySelector('#overStats').textContent =
        `Clues ${this.game.cluesTaken}/${this.game.cluesTotal} · Time ${this.game.timeText}`;
    }
  }

  update(game) {
    this.el.clues.textContent = `Clues ${game.cluesTaken} / ${game.cluesTotal}`;
    const alert = game.alertLevel;
    this.el.alertFill.style.width = `${Math.round(alert * 100)}%`;
    this.el.alertFill.className = alert >= 0.72 ? 'alert-high' : alert >= 0.35 ? 'alert-mid' : 'alert-low';
    this.el.alertLabel.textContent = alert >= 0.72 ? 'SPOTTED!' : alert >= 0.35 ? 'Suspicious…' : 'Hidden';
    this.el.lives.textContent = `♥`.repeat(Math.max(0, game.lives)) + `♡`.repeat(Math.max(0, 3 - game.lives));
    this.el.time.textContent = game.timeText;
    this.el.soundBtn.textContent = game.sounds.muted ? '🔇 Sound off' : '🔊 Sound on';
    // The banner is drawn on the canvas itself (see render.js);
    // the DOM bar above only carries the persistent stats.
  }
}
