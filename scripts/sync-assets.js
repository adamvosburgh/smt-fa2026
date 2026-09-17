// Mirrors two things into static/, so that files which need to be SERVED end up
// where SvelteKit serves them, while the files that need to be READ at build
// time stay where import.meta.glob can reach them.
//
//   src/content/<section>/images/  ->  static/<section>/images/
//       so markdown can keep saying /tutorials/images/foo.png while the image
//       file lives next to the markdown that uses it.
//
//   src/submissions/<student>/<sandbox>/  ->  static/submissions/<student>/<sandbox>/
//       archive build only (SMT_MODE=archive), so covers and uploaded assets
//       resolve at /submissions/... in the frozen static build. In live mode
//       they are served from src/submissions by /api/submissions instead.
//
//   src/boards/<slug>/  ->  static/boards/<slug>/
//       archive build only, the same way, for the frozen whiteboards.
//
// Runs on predev and prebuild. Everything it writes into static/ is gitignored -
// src/content/ and src/submissions/ are the source of truth.
import { cp, mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function mirror(from, to, label) {
  const src = path.join(root, from);
  const dest = path.join(root, to);
  if (!existsSync(src)) return;
  // Clear first so files deleted from the source do not linger in the served
  // copy. Where deletion is not permitted this is not fatal - the copy below
  // still overwrites, it just leaves any stale files behind.
  try {
    await rm(dest, { recursive: true, force: true });
  } catch (err) {
    console.warn(`sync-assets: could not clear ${to} (${err.code}); ` +
                 `overwriting in place, stale files may remain`);
  }
  await mkdir(dest, { recursive: true });
  await cp(src, dest, { recursive: true, force: true });
  console.log(`sync-assets: ${label} (${(await readdir(dest)).length} entries)`);
}

for (const section of ['tutorials', 'assignments', 'resources', 'sandboxes']) {
  await mirror(`src/content/${section}/images`, `static/${section}/images`, `${section}/images`);
}
// Submissions only for the archive build. In live mode /api/submissions serves
// them straight from src/submissions, and a copy here would be baked into the
// build and go on serving files a student has since replaced.
if (process.env.SMT_MODE === 'archive') {
  await mirror('src/submissions', 'static/submissions', 'submissions');
} else {
  await rm(path.join(root, 'static/submissions'), { recursive: true, force: true });
}
// Whiteboards the same way. In live mode /api/boards serves them from var/;
// src/boards/ is only filled at the freeze, by scripts/export-boards.js.
if (process.env.SMT_MODE === 'archive') {
  await mirror('src/boards', 'static/boards', 'boards');
} else {
  await rm(path.join(root, 'static/boards'), { recursive: true, force: true });
}

// Processed sandbox data. data/original + data/scripts are the source of truth;
// data/processed is what the pipeline writes; static/data is what ships.
for (const sandbox of ['bathtub', 'anthromes', 'pencil', 'after-five',
                       'coefficients', 'sunlight', 'studio-twin']) {
  await mirror(`data/processed/${sandbox}`, `static/data/${sandbox}`, `data/${sandbox}`);
}
