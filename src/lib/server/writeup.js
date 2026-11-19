// The final project's write-up: one .md, or a .zip with the .md and the images
// it shows. A zip is unpacked here, before validation, into the same flat
// assets/ folder as every other upload, so `![](image-1.png)` in the markdown
// finds `assets/image-1.png` (the gallery page rewrites the path).
//
// What a zip may hold is narrow on purpose: markdown and images, nothing else.
// Finder's extras (__MACOSX/, .DS_Store) are skipped, and so is the single
// top-level folder a zip gets when a student compresses the folder rather than
// its contents. Anything else is refused with a sentence, not dropped silently,
// so the student knows why an image is missing.
import { unzipSync } from 'fflate';

const IMAGE = /\.(png|jpe?g|webp|gif)$/i;
const MARKDOWN = /\.(md|markdown)$/i;
const TYPE = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

// The same flattening /api/submit applies to every upload's name.
export const flatName = (name) => String(name).split(/[\\/]/).pop().replace(/[^A-Za-z0-9._-]/g, '_');

const junk = (name) => name.split('/').some((s) => s === '__MACOSX' || s === '.DS_Store' || s.startsWith('._'));

/**
 * Turn the uploaded write-up into asset files.
 * Returns { files, writeup } on success, or { error } with a sentence for the student.
 */
export function unpackWriteup(name, buffer, maxBytes) {
  if (MARKDOWN.test(name)) {
    const md = flatName(name).replace(/\.markdown$/i, '.md');
    return { files: [{ path: `assets/${md}`, type: 'text/markdown', bytes: buffer.length, buffer }], writeup: `assets/${md}` };
  }
  if (!/\.zip$/i.test(name)) {
    return { error: 'The write-up has to be a .md file, or a .zip with the .md and its images.' };
  }

  // Sizes are read from the zip's own directory before anything is inflated,
  // so a small zip that unpacks to gigabytes is refused, not unpacked.
  let declared = 0;
  const problems = [];
  let entries;
  try {
    entries = unzipSync(new Uint8Array(buffer), {
      filter: (f) => {
        if (f.name.endsWith('/') || junk(f.name)) return false;
        declared += f.originalSize;
        if (f.name.startsWith('/') || f.name.split(/[\\/]/).includes('..')) {
          problems.push(`"${f.name}" points outside the zip.`);
          return false;
        }
        if (!MARKDOWN.test(f.name) && !IMAGE.test(f.name)) {
          problems.push(`"${f.name}" is not markdown or an image (png, jpg, webp, gif).`);
          return false;
        }
        return declared <= maxBytes;
      }
    });
  } catch {
    return { error: 'The write-up zip could not be opened. Make it again with your computer\'s "Compress" command.' };
  }
  if (declared > maxBytes) {
    return { error: `The write-up zip unpacks to ${(declared / 1048576).toFixed(1)}MB. The limit is ${(maxBytes / 1048576).toFixed(0)}MB.` };
  }
  if (problems.length) return { error: `The write-up zip can only hold your .md and its images. ${problems.join(' ')}` };

  // One folder around everything (the student zipped the folder): strip it.
  let names = Object.keys(entries);
  const tops = new Set(names.map((n) => (n.includes('/') ? n.split('/')[0] : '')));
  if (tops.size === 1 && !tops.has('')) {
    const top = [...tops][0] + '/';
    entries = Object.fromEntries(names.map((n) => [n.slice(top.length), entries[n]]));
    names = Object.keys(entries);
  }

  const mds = names.filter((n) => MARKDOWN.test(n));
  if (!mds.length) return { error: 'The write-up zip has no .md file in it.' };
  const chosen = mds.length === 1 ? mds[0] : mds.find((n) => /^index\.(md|markdown)$/i.test(n));
  if (!chosen) {
    return { error: `The write-up zip has ${mds.length} .md files (${mds.join(', ')}). Keep one, or name the one to show index.md.` };
  }

  const files = [];
  const seen = new Set();
  for (const n of names) {
    if (MARKDOWN.test(n) && n !== chosen) continue;
    let flat = flatName(n);
    if (n === chosen) flat = flat.replace(/\.markdown$/i, '.md');
    if (seen.has(flat)) return { error: `The write-up zip has two files called "${flat}". Rename one.` };
    seen.add(flat);
    const buf = Buffer.from(entries[n]);
    const ext = flat.split('.').pop().toLowerCase();
    files.push({ path: `assets/${flat}`, type: TYPE[ext] ?? 'text/markdown', bytes: buf.length, buffer: buf });
  }
  return { files, writeup: `assets/${flatName(chosen).replace(/\.markdown$/i, '.md')}` };
}
