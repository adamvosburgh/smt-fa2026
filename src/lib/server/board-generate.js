// Assignment boards, built from the submissions.
//
// Run by the ticker at 9:00 New York on the morning an assignment is due, by
// /api/submit when a late submission lands on an assignment that already has a
// board, and by hand from the owner's button. Idempotent: a student who
// already has a tile gets nothing new, and tiles already on the board are never
// moved or changed.
import { randomInt } from 'node:crypto';
import { stat, open } from 'node:fs/promises';
import path from 'node:path';
import { doc } from '$lib/content.js';
import { newId } from '$lib/board/model.js';
import { listSubmissions, submissionDir } from './repo.js';
import { get, create, apply, SITE } from './boards.js';

// A tile is as tall as its cover at full width, uncropped, plus room for the
// title, name, gallery text and link below it. Tiles go into whichever column
// is shortest, so the grid comes out irregular when the covers differ.
const COLUMNS = 4;
const TILE = { w: 480, h: 600 };
const TEXT_H = 240;
// The page-turning buttons under a multi-page PDF's cover.
const PAGER_H = 48;
const PITCH = { x: 720, y: 840 };
const GAP = PITCH.y - TILE.h;

async function isFile(p) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

// Height over width of a JPEG or PNG, read from its header. Null for anything
// else, or a file it can't parse; the tile then gets the old 4:3 box.
async function coverRatio(file) {
  let fh;
  try {
    fh = await open(file, 'r');
    const { buffer: b, bytesRead } = await fh.read(Buffer.alloc(65536), 0, 65536, 0);
    if (bytesRead >= 24 && b.readUInt32BE(0) === 0x89504e47) {
      const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
      return w && h ? h / w : null;
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < bytesRead) {
        if (b[i] !== 0xff) { i++; continue; }
        const marker = b[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          const h = b.readUInt16BE(i + 5), w = b.readUInt16BE(i + 7);
          return w && h ? h / w : null;
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    await fh?.close();
  }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function boardTitle(a) {
  return `Assignment ${a.sequence}: ${a.title}`;
}

// The ticker and a late submission can ask for the same board at the same
// moment; without this both would see the same student missing and add two.
const running = new Map();

export function buildAssignmentBoard(slug) {
  const prev = running.get(slug) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(() => build(slug));
  running.set(slug, next);
  next.finally(() => {
    if (running.get(slug) === next) running.delete(slug);
  }).catch(() => {});
  return next;
}

async function build(slug) {
  const a = doc('assignments', slug);
  if (!a || a.submit !== true) throw new Error(`boards: ${slug} is not an assignment that takes uploads`);

  let created = false;
  if (!(await get(slug))) {
    const r = await create({ slug, title: boardTitle(a), kind: 'assignment', assignment: slug, by: 'site' });
    if (r.ok) {
      created = true;
      await apply(slug, [{
        op: 'add',
        element: {
          id: newId(),
          type: 'text',
          x: 0,
          y: -160,
          w: COLUMNS * PITCH.x - (PITCH.x - TILE.w),
          h: 80,
          z: 1,
          locked: true,
          text: boardTitle(a),
          size: 'large'
        }
      }], SITE);
    }
  }

  const board = await get(slug);
  const tiles = Object.values(board.elements).filter((e) => e.type === 'tile');
  const have = new Set(tiles.map((t) => t.student));

  const rows = (await listSubmissions()).filter(
    (s) => s.sandbox === slug && s.manifest.kind === 'assignment' && !have.has(s.student)
  );
  shuffle(rows);

  // Where each column ends now. Tiles already on the board stay where they are.
  const bottoms = Array(COLUMNS).fill(-GAP);
  for (const t of tiles) {
    const c = Math.round(t.x / PITCH.x);
    if (c >= 0 && c < COLUMNS) bottoms[c] = Math.max(bottoms[c], t.y + t.h);
  }

  const ops = [];
  let z = Object.values(board.elements).reduce((m, e) => Math.max(m, e.z ?? 0), 0);
  for (const s of rows) {
    const dir = submissionDir(s.student, slug);
    const base = `/api/submissions/${s.student}/${slug}/`;
    let cover = null;
    let file = null;
    if (s.manifest.cover_file && (await isFile(path.join(dir, s.manifest.cover_file)))) file = s.manifest.cover_file;
    else if (await isFile(path.join(dir, 'cover.png'))) file = 'cover.png';
    if (file) cover = base + file;
    const ratio = file ? await coverRatio(path.join(dir, file)) : null;
    const pages = (s.manifest.pages ?? []).map((p) => base + p);
    const h = (ratio ? Math.round(TILE.w * ratio) + TEXT_H : TILE.h) + (pages.length > 1 ? PAGER_H : 0);

    const c = bottoms.indexOf(Math.min(...bottoms));
    const y = bottoms[c] + GAP;
    bottoms[c] = y + h;
    ops.push({
      op: 'add',
      element: {
        id: newId(),
        type: 'tile',
        x: c * PITCH.x,
        y,
        w: TILE.w,
        h,
        z: ++z,
        locked: true,
        student: s.student,
        title: s.manifest.title ?? '',
        gallery_text: s.manifest.gallery_text ?? '',
        cover,
        ratio,
        pages,
        href: `/gallery/${s.student}/${slug}/`
      }
    });
  }

  let added = 0;
  for (let i = 0; i < ops.length; i += 50) {
    const r = await apply(slug, ops.slice(i, i + 50), SITE);
    added += r?.applied ?? 0;
  }
  return { created, added };
}
