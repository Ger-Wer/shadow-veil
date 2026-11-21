// Shadow Veil — input: WASD / arrows to move, Shift to sneak,
// M to mute, R to restart. Mouse click sets a move target
// (click-to-move), so the game is fully playable with keyboard
// or with mouse alone.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.moveTarget = null; // {x, y} in canvas pixels, or null
    this.canvas = canvas;
    this.onFirstGesture = null;
    this.onMute = null;
    this.onRestart = null;
    this.onPause = null;
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (e.repeat) return;
      this.keys.add(e.key.toLowerCase());
      this._gesture();
      if (e.key.toLowerCase() === 'm' && this.onMute) this.onMute();
      if (e.key.toLowerCase() === 'r' && this.onRestart) this.onRestart();
      if (e.key === 'Escape' && this.onPause) this.onPause();
      // Any key cancels a click-to-move target.
      if (['w', 'a', 's', 'd'].includes(e.key.toLowerCase()) || e.key.startsWith('Arrow')) {
        this.moveTarget = null;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener('blur', () => this.keys.clear());
    this.canvas.addEventListener('pointerdown', (e) => {
      this._gesture();
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.moveTarget = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    });
  }

  _gesture() {
    if (this.onFirstGesture) {
      const cb = this.onFirstGesture;
      this.onFirstGesture = null;
      cb();
    }
  }

  get sneaking() {
    return this.keys.has('shift');
  }

  // Normalised keyboard direction, or null when no key is held.
  keyboardDir() {
    let x = 0;
    let y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (x === 0 && y === 0) return null;
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  }
}
