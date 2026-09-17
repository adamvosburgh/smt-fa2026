// The whiteboards, frozen. Run at the end of the semester, before
// `SMT_MODE=archive npm run build`:
//
//   npm run boards:export
//
// Copies each live board out of var/ (machine-local runtime state) into
// src/boards/, where the archive build can glob it and commit it:
//
//   var/boards/<slug>.json          ->  src/boards/<slug>/board.json
//   var/boards/<slug>/assets/       ->  src/boards/<slug>/assets/
//
// and rewrites the live URLs inside a board to where the static build serves
// the same files: /api/boards/<slug>/assets/ -> /boards/<slug>/assets/ and
// /api/submissions/ -> /submissions/. Idempotent: a second run replaces what
// the first wrote.
//
// Reads SMT_STATE_DIR like the server does, so on the box run it with the same
// environment PM2 uses.
import { readdir, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = path.resolve(root, process.env.SMT_STATE_DIR || 'var');
const from = path.join(stateDir, 'boards');
const to = path.join(root, 'src', 'boards');
const SLUG = /^[a-z0-9-]{1,60}$/;

if (!existsSync(from)) {
  console.log(`export-boards: no boards under ${from}`);
  process.exit(0);
}

let n = 0;
for (const name of await readdir(from)) {
  const m = /^(.+)\.json$/.exec(name);
  if (!m || !SLUG.test(m[1])) continue;
  const slug = m[1];
  const text = (await readFile(path.join(from, name), 'utf8'))
    .split(`/api/boards/${slug}/assets/`).join(`/boards/${slug}/assets/`)
    .split('/api/submissions/').join('/submissions/');
  JSON.parse(text); // refuse to write a board that no longer parses

  const dest = path.join(to, slug);
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  await writeFile(path.join(dest, 'board.json'), text);
  const assets = path.join(from, slug, 'assets');
  if (existsSync(assets)) await cp(assets, path.join(dest, 'assets'), { recursive: true });
  console.log(`export-boards: ${slug}`);
  n++;
}
console.log(`export-boards: ${n} board${n === 1 ? '' : 's'} into src/boards/`);
