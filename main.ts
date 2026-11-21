// Shadow Veil — the entry program (Node 22, standard library only).
// Hands the game in: it clears the output directory, copies game/
// and screenshots/ from beside this file, and writes
// /output/dossier.json with the vendored make.fun library.
// Deterministic: two runs write byte-for-byte identical output.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps for this bounty: game/ at most 993 entries and
// 48 MiB, screenshots at most 4 files of 256 KiB each, the dossier
// text at most 160 KiB. Refuse here what the scorer would refuse.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function countEntries(dir) {
  let total = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    total += 1;
    if (statSync(path).isDirectory()) total += countEntries(path);
  }
  return total;
}

function isImageFile(name) {
  return /\.(png|jpe?g)$/i.test(name);
}

function checkShots(shotsDir, shots) {
  for (const name of shots) {
    const bytes = readFileSync(join(shotsDir, name));
    const isPng = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isJpeg = bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!isPng && !isJpeg) throw new Error(`screenshots/${name} is not a PNG or JPEG file`);
    if (bytes.length > 262144) throw new Error(`screenshots/${name} is over 256 KiB`);
  }
}

function main() {
  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(join(gameDir, 'index.html'))) {
    throw new Error('game/index.html is missing: nothing to hand in');
  }
  if (statSync(join(gameDir, 'index.html')).size > 1048576) {
    throw new Error('game/index.html is over 1 MiB');
  }
  const shots = existsSync(shotsDir)
    ? readdirSync(shotsDir).filter((n) => !n.startsWith('.'))
    : [];
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`screenshots/ must hold 3 or 4 images, found ${shots.length}`);
  }
  if (!shots.every(isImageFile)) {
    throw new Error('screenshots/ must hold only PNG or JPEG files');
  }
  checkShots(shotsDir, shots);

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outDir, CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  const gameEntries = countEntries(join(outDir, 'game'));
  console.log(
    `Shadow Veil handed in: ${gameEntries} game entries, ${shots.length} screenshots, ` +
    `dossier ${Buffer.byteLength(dossier)} bytes -> ${outDir}`,
  );
}

main();
