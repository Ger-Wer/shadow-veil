// Shadow Veil — entry point: wire the canvas and the HUD together,
// start the render loop, and pose the game when a ?shot= param
// asks for a screenshot scene.

import { Game, Hud } from './game.js';
import { applyShot } from './shots.js';

const canvas = document.querySelector('#game');
const hudRoot = document.querySelector('#app');

const game = new Game(canvas, new Hud(hudRoot));

// Exposed for debugging and automated smoke tests in the browser.
window.__game = game;

// The loop runs from the title screen on: the level is alive
// behind the overlay, guards already on patrol.
game.lastTick = performance.now();
requestAnimationFrame((t) => game.loop(t));

// Screenshot staging (?shot=start|play|alert|win) — deterministic
// poses, used only to take the entry's own screenshots.
const params = new URLSearchParams(window.location.search);
applyShot(game, params);
