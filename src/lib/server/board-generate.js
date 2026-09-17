// Assignment boards, built from the submissions.
//
// Run by the ticker at 9:00 New York on the morning an assignment is due, by
// /api/submit when a late submission lands on an assignment that already has a
// board, and by hand from the owner's button. Idempotent: a student who
// already has a tile gets nothing new, and tiles already on the board are never
// moved or changed.
import { randomInt } from 'node:crypto';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { doc } from '$lib/content.js';
import { newId } from '$lib/board/model.js';
import { listSubmissions, submissionDir } from './repo.js';
import { get, create, apply, SITE } from './boards.js';

const COLUMNS = 4;
const TILE = { w: 480, h: 600 };
const PITCH = { x: 720, y: 840 };

async function isFile(p) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
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

  const ops = [];
  let cell = tiles.length;
  let z = Object.values(board.elements).reduce((m, e) => Math.max(m, e.z ?? 0), 0);
  for (const s of rows) {
    const dir = submissionDir(s.student, slug);
    const base = `/api/submissions/${s.student}/${slug}/`;
    let cover = null;
    if (s.manifest.cover_file && (await isFile(path.join(dir, s.manifest.cover_file)))) cover = base + s.manifest.cover_file;
    else if (await isFile(path.join(dir, 'cover.png'))) cover = base + 'cover.png';
    ops.push({
      op: 'add',
      element: {
        id: newId(),
        type: 'tile',
        x: (cell % COLUMNS) * PITCH.x,
        y: Math.floor(cell / COLUMNS) * PITCH.y,
        w: TILE.w,
        h: TILE.h,
        z: ++z,
        locked: true,
        student: s.student,
        title: s.manifest.title ?? '',
        gallery_text: s.manifest.gallery_text ?? '',
        cover,
        href: `/gallery/${s.student}/${slug}/`
      }
    });
    cell++;
  }

  let added = 0;
  for (let i = 0; i < ops.length; i += 50) {
    const r = await apply(slug, ops.slice(i, i + 50), SITE);
    added += r?.applied ?? 0;
  }
  return { created, added };
}
