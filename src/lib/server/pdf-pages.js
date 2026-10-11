// The pages of an uploaded PDF as JPEGs, 2000px wide at quality 90, the same
// width the browser draws for an image upload. Uses poppler (pdfinfo, pdftoppm), which is on the
// server. Node built-ins only, so scripts/pdf-pages.js can import it directly.
//
// Page 1 is the cover. A PDF of two or more pages also keeps every page under
// pages/ in the submission folder, up to MAX_PAGES, so the whiteboard tile and
// the Student Work page can show more than the first one.
import { mkdtemp, readdir, readFile, rm, mkdir, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const run = promisify(execFile);

export const MAX_PAGES = 20;
const MAX_COVER_BYTES = 2_000_000;

async function pageCount(pdf) {
  try {
    const { stdout } = await run('pdfinfo', [pdf], { timeout: 30_000 });
    const n = Number(/^Pages:\s+(\d+)/m.exec(stdout)?.[1]);
    return Number.isInteger(n) && n > 0 ? n : 1;
  } catch {
    return 1;
  }
}

// Each page's size in points, [width, height] as it is shown (a page rotated a
// quarter turn has its sides swapped), for pages 1 to `last`. Empty if
// pdfinfo can't read it. The whiteboard's spread tile draws pages in
// proportion to these, so an 11x17 sheet is larger than a letter one.
async function pageSizes(pdf, last) {
  try {
    const { stdout } = await run('pdfinfo', ['-f', '1', '-l', String(last), pdf], { timeout: 30_000 });
    const sizes = [];
    for (const m of stdout.matchAll(/^Page\s+(\d+) size:\s+([\d.]+) x ([\d.]+) pts/gm)) {
      const rot = Number(new RegExp(`^Page\\s+${m[1]} rot:\\s+(\\d+)`, 'm').exec(stdout)?.[1] ?? 0);
      const w = Number(m[2]), h = Number(m[3]);
      sizes[Number(m[1]) - 1] = rot % 180 === 90 ? [h, w] : [w, h];
    }
    return sizes.length === last && sizes.every(Boolean) ? sizes.map(([w, h]) => [Math.round(w), Math.round(h)]) : [];
  } catch {
    return [];
  }
}

// Renders `pdf` and, for a PDF of two or more pages, writes <dir>/pages/1.jpg,
// 2.jpg, ... Returns { cover, pages, count, sizes }: the first page as a
// buffer (null if it could not be drawn or is over 2MB), the page paths
// relative to <dir> (empty for a one-page PDF), the PDF's own page count, and
// the size in points of each page drawn (page 1 alone for a one-page PDF). A
// PDF poppler can't read gives { cover: null, pages: [], count: 0, sizes: [] }
// rather than a failed submission.
export async function renderPdf(pdf, dir) {
  const count = await pageCount(pdf);
  const last = Math.min(count, MAX_PAGES);
  const tmp = await mkdtemp(path.join(dir, '.pdf-'));
  try {
    await run(
      'pdftoppm',
      ['-jpeg', '-jpegopt', 'quality=90', '-f', '1', '-l', String(last), '-scale-to-x', '2000', '-scale-to-y', '-1', pdf, path.join(tmp, 'p')],
      { timeout: 30_000 + 10_000 * last }
    );
    // pdftoppm pads the page number to the width of the last one (p-01.jpg),
    // so sort by the number, not the name.
    const files = (await readdir(tmp))
      .map((f) => ({ f, n: Number(/-(\d+)\.jpg$/.exec(f)?.[1]) }))
      .filter((x) => x.n)
      .sort((a, b) => a.n - b.n);
    if (!files.length) return { cover: null, pages: [], count: 0, sizes: [] };

    const first = await readFile(path.join(tmp, files[0].f));
    const cover = first.length <= MAX_COVER_BYTES ? first : null;
    const sizes = await pageSizes(pdf, files.length);
    if (count < 2) return { cover, pages: [], count, sizes };

    await mkdir(path.join(dir, 'pages'), { recursive: true });
    const pages = [];
    for (const [i, { f }] of files.entries()) {
      const rel = `pages/${i + 1}.jpg`;
      await rename(path.join(tmp, f), path.join(dir, rel));
      pages.push(rel);
    }
    return { cover, pages, count, sizes };
  } catch (err) {
    console.error(`pdf pages: ${pdf}: ${err?.message ?? err}`);
    return { cover: null, pages: [], count: 0, sizes: [] };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
