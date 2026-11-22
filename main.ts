// VELMORA HEIST — the entry program (Node 22, standard library only).
//
// The game is this repository's game/ folder: plain static files a desktop
// browser loads offline (game/index.html and its ES modules, no library and no
// network request). This program hands it in: it copies game/ and screenshots/
// from beside this file to /output and writes /output/dossier.json, the
// summary the judge reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The copy is deterministic on purpose: files are walked in sorted order, so
// two runs of this program write byte-identical output.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Walk a directory tree in sorted order and return every file path, relative
// to the tree root. Sorting keeps the copy (and therefore the dossier) stable
// across runs and machines.
function listFilesSorted(root, relative = '') {
  const found = [];
  const entries = readdirSync(join(root, relative)).sort();
  for (const entry of entries) {
    const child = relative ? `${relative}/${entry}` : entry;
    const stats = statSync(join(root, child));
    if (stats.isDirectory()) found.push(...listFilesSorted(root, child));
    else if (stats.isFile()) found.push(child);
  }
  return found;
}

function copyTreeSorted(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });
  for (const file of listFilesSorted(sourceDir)) {
    const target = join(targetDir, file);
    mkdirSync(join(targetDir, file.split('/').slice(0, -1).join('/')), { recursive: true });
    cpSync(join(sourceDir, file), target);
  }
}

mkdirSync(outputDir, { recursive: true });
copyTreeSorted(join(repoRoot, 'game'), join(outputDir, 'game'));
if (existsSync(join(repoRoot, 'screenshots'))) {
  copyTreeSorted(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes: game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
