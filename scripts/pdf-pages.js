// Renders the pages of PDF submissions that were uploaded before /api/submit
// kept them. /api/submit does this itself now (src/lib/server/pdf-pages.js);
// this is for what came in before that.
//
//   node scripts/pdf-pages.js          # every assignment PDF without pages
//   node scripts/pdf-pages.js --dry    # list them, change nothing
//
// A one-page PDF gets nothing. For two or more pages it writes pages/1.jpg ...
// into the submission folder and adds `pages` and `page_count` to the
// manifest. The cover is left as it is. A whiteboard tile made before this
// still shows only the cover; a tile made after it can page through.
import { readdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPdf } from '../src/lib/server/pdf-pages.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.resolve(root, process.env.SMT_SUBMISSIONS_DIR || 'src/submissions');
const dry = process.argv.includes('--dry');
const SLUG = /^[a-z0-9-]+$/;

async function folders(p) {
  try {
    return (await readdir(p, { withFileTypes: true })).filter((e) => e.isDirectory() && SLUG.test(e.name)).map((e) => e.name);
  } catch {
    return [];
  }
}

for (const student of await folders(dir)) {
  for (const slug of await folders(path.join(dir, student))) {
    const sub = path.join(dir, student, slug);
    const file = path.join(sub, 'manifest.json');
    let manifest;
    try {
      manifest = JSON.parse(await readFile(file, 'utf8'));
    } catch {
      continue;
    }
    if (manifest.kind !== 'assignment' || !/\.pdf$/i.test(manifest.primary ?? '') || manifest.pages) continue;
    const pdf = path.resolve(sub, manifest.primary);
    if (!pdf.startsWith(sub + path.sep)) continue;

    if (dry) {
      console.log(`would render ${student}/${slug}`);
      continue;
    }
    const r = await renderPdf(pdf, sub);
    if (!r.pages.length) {
      console.log(`${student}/${slug}: ${r.count ? 'one page, nothing to do' : 'could not read the PDF'}`);
      continue;
    }
    manifest.pages = r.pages;
    manifest.page_count = r.count;
    // By rename, as repo.js does: /api/submissions reads these folders live.
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(manifest, null, 2));
    await rename(tmp, file);
    console.log(`${student}/${slug}: ${r.pages.length} of ${r.count} pages`);
  }
}
