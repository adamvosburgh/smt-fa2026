// The December freeze, checked in August.
//
// The archive build swaps adapter-node for adapter-static and prerenders
// everything outside /api. That only works if no page route depends on a
// server-only load. This script fails loudly the moment one does, so the freeze
// stays a config change instead of a finals-week rewrite.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const problems = [];

async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { await walk(p); continue; }
    if (p.includes(`routes${path.sep}api`)) continue;
    if (/\+(page|layout)\.server\.(js|ts)$/.test(e.name)) {
      problems.push(`${p} - a server load outside /api cannot be prerendered.`);
    }
    if (/\+server\.(js|ts)$/.test(e.name)) {
      problems.push(`${p} - an endpoint outside /api will not exist in the archive build.`);
    }
    if (/\+page\.(js|ts)$/.test(e.name)) {
      const src = await readFile(p, 'utf8');
      if (/prerender\s*=\s*false/.test(src)) problems.push(`${p} - prerender is explicitly off.`);
    }
  }
}

await walk('src/routes');

if (problems.length) {
  console.error('FREEZE AUDIT FAILED\n');
  for (const p of problems) console.error('  ' + p);
  console.error('\nEvery sandbox must render from static data. Anything that cannot does not ship.');
  process.exit(1);
}
console.log('freeze audit: clean. `SMT_MODE=archive npm run build` will prerender.');
