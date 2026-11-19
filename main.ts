// Neon Tide — the hand-in program for the gta6-01 bounty (Node 22, standard library only).
//
// The game itself is the static site in game/: plain files a desktop browser opens offline,
// no build step, no network. This program's whole job is to hand that game in — copy game/
// and screenshots/ into the output directory and write the dossier the judge reads, using
// the kit's own library (vendor/makefun-game.ts, untouched) so the bytes match what the
// scorer rebuilds for itself.
//
// Version 2 of the game (the harbour update: boats, a second gun, street races and the
// night-lighting pass) changes nothing about the hand-in: the output directory is only
// ever created if missing and filled — never removed — so the grader can run this twice
// into the same directory and get identical bytes.
//
// Run it the way the grader does, with MAKEFUN_OUTPUT_DIR naming the output directory:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play the game locally instead with: node serve.ts  (then open http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** The caps the gate scorer enforces; the dossier is built inside them or not at all. */
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn() {
  const repoRoot = fileURLToPath(new URL('.', import.meta.url));
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

  mkdirSync(outDir, { recursive: true });
  cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });

  const shotsDir = join(outDir, 'screenshots');
  mkdirSync(shotsDir, { recursive: true });
  const localShots = join(repoRoot, 'screenshots');
  if (existsSync(localShots)) cpSync(localShots, shotsDir, { recursive: true });

  writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, CAPS));
}

handIn();
