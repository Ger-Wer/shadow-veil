// Shadow Veil — the levels: tile maps and guard patrols.
// Legend: # wall, . floor, C crate (blocks sight and movement),
// s shadow floor (detection fills slower there), P player start,
// E exit, 1/2/3 clues. Guards patrol the waypoint loops below.

export const LEVELS = [
  {
    name: 'Night Shift',
    intro: 'Collect 3 clues, then slip out the east exit. Stay out of the cones.',
    map: [
      '########################',
      '#P....#......#.....2...#',
      '#.....#..1...#.........#',
      '#..C..#......#...C.....#',
      '#.....#......#.........#',
      '#..s..#..C...#....s....#',
      '#.....#......#.........#',
      '###.#######.######.#####',
      '#.....#......#.........#',
      '#..s..#..C...#...C.....#',
      '#.....#......#.........#',
      '#..C..#..3...#....E....#',
      '#.....#...C..#.........#',
      '#..............C..ss...#',
      '########################',
    ],
    guards: [
      { waypoints: [[8, 2], [11, 2], [11, 5], [8, 5]] },
      { waypoints: [[20, 2], [20, 11]] },
      { waypoints: [[3, 13], [21, 13]] },
    ],
  },
  {
    name: 'The Vault Floor',
    intro: 'Four guards now, tighter corridors. Shadows are your friends.',
    map: [
      '########################',
      '#....2.....#....#......#',
      '#.C...#....#....#.C....#',
      '#.....#....#.1..#......#',
      '#..s..#....#....#..s...#',
      '#.....#....#....#......#',
      '#.....#.C..#..C.#.C....#',
      '##.#####.######.#####..#',
      '#.....#....#....#......#',
      '#..s..#....#....#..s...#',
      '#.....#..C.#.C..#......#',
      '#....3.....#....#.E....#',
      '#.C.......C#....#......#',
      '#P.................s...#',
      '########################',
    ],
    guards: [
      { waypoints: [[3, 2], [9, 2]] },
      { waypoints: [[15, 1], [15, 6]] },
      { waypoints: [[3, 11], [9, 11]] },
      { waypoints: [[14, 13], [21, 13]] },
    ],
  },
];

// Parse a map into the pieces the game loop needs.
export function parseLevel(level) {
  const walls = new Set();
  const crates = new Set();
  const shadows = new Set();
  const clues = [];
  let player = null;
  let exit = null;
  level.map.forEach((row, r) => {
    for (let c = 0; c < row.length; c += 1) {
      const ch = row[c];
      const key = `${c},${r}`;
      if (ch === '#') walls.add(key);
      else if (ch === 'C') crates.add(key);
      else if (ch === 's') shadows.add(key);
      else if (ch === 'P') player = { col: c, row: r };
      else if (ch === 'E') exit = { col: c, row: r };
      else if (ch === '1' || ch === '2' || ch === '3') {
        clues.push({ id: Number(ch), col: c, row: r, taken: false });
      }
    }
  });
  return { walls, crates, shadows, clues, player, exit };
}

// Is a tile solid for movement (wall or crate)?
export function isSolidTile(parsed, col, row) {
  return parsed.walls.has(`${col},${row}`) || parsed.crates.has(`${col},${row}`);
}

// Does a tile block a guard's line of sight?
export function blocksSight(parsed, col, row) {
  return parsed.walls.has(`${col},${row}`) || parsed.crates.has(`${col},${row}`);
}

// Flood-fill check used by the dev harness: every clue and the exit
// must be reachable on foot from the player start.
export function levelIsConnected(level) {
  const parsed = parseLevel(level);
  if (!parsed.player || !parsed.exit) return false;
  const seen = new Set([`${parsed.player.col},${parsed.player.row}`]);
  const queue = [[parsed.player.col, parsed.player.row]];
  while (queue.length > 0) {
    const [c, r] = queue.pop();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      const key = `${nc},${nr}`;
      if (seen.has(key) || isSolidTile(parsed, nc, nr)) continue;
      seen.add(key);
      queue.push([nc, nr]);
    }
  }
  const allTargets = [...parsed.clues.map((cl) => `${cl.col},${cl.row}`), `${parsed.exit.col},${parsed.exit.row}`];
  return allTargets.every((t) => seen.has(t));
}
