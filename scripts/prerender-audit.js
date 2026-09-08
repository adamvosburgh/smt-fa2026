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

// Publishing is a build-time filter, not a runtime one: `isLive` in
// src/lib/content.js runs against Date.now(), so the archive build freezes
// whatever is live at the moment it runs. Anything still ahead of its
// `publish:` date prerenders as its "publishes on" page and stays that way.
// Listed here so a freeze run cannot quietly ship a stub as the final archive.
const DST_ENDS_2026 = '2026-11-01';
const startOfDayNY = (ymd) => Date.parse(`${ymd}T${ymd < DST_ENDS_2026 ? '04' : '05'}:00:00Z`);

const pending = [];
for (const section of ['tutorials', 'assignments']) {
  const dir = path.join('src', 'content', section);
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.md')) continue;
    const src = await readFile(path.join(dir, name), 'utf8');
    const m = /^publish:\s*["']?(\d{4}-\d{2}-\d{2})["']?\s*$/m.exec(src.split('---')[1] ?? '');
    if (m && Date.now() < startOfDayNY(m[1])) pending.push(`${section}/${name.replace(/\.md$/, '')} publishes ${m[1]}`);
  }
}

if (pending.length) {
  console.log('\nnot live at this moment, so a freeze run right now would archive the stub:');
  for (const p of pending) console.log('  ' + p);
} else {
  console.log('every tutorial and assignment is past its publish date.');
}
