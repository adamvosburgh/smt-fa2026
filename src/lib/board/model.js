// What a whiteboard is, shared by the server, the canvas and the archive.
//
// A board is one JSON object: some metadata and `elements`, an object keyed by
// id so an op can address one element without scanning. The server applies ops
// in src/lib/server/boards.js; the canvas applies the same ops locally first,
// with applyOp() below, so both sides agree on what an op means.
//
// Universal: imported by the browser, by server routes, and by the archive
// build. Nothing Node-only here.
import { MODE } from '$lib/data.js';

export const SLUG = /^[a-z0-9-]{1,60}$/;
export const ID = /^[a-z0-9]{6,10}$/;
export const TYPES = ['image', 'video', 'text', 'note', 'tile'];

export const LIMITS = {
  text: 4000,
  note: 1000,
  title: 140,
  opsPerRequest: 50,
  elements: 2000,
  minSize: 24,
  maxSize: 6000
};

// The keys an `update` op may carry. Anything else is refused.
export const PATCHABLE = ['x', 'y', 'w', 'h', 'z', 'locked', 'text', 'size'];

// Uploads. Keep in step with the upload route's whitelist and magic-byte check.
export const UPLOAD_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4'];
export const ASSET_FILE = /^[a-z0-9]+(\.display)?\.(png|jpg|jpeg|webp|gif|mp4)$/;

export function slugify(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

// Made by the client, so an element can be drawn before the server has seen it.
export function newId(n = 8) {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (const b of bytes) s += abc[b % abc.length];
  return s;
}

// Where a board's uploaded files are served. Live: the token-checked route.
// Archive: the copy scripts/sync-assets.js mirrors into static/boards/.
export function assetBase(slug) {
  return MODE === 'archive' ? `/boards/${slug}/assets/` : `/api/boards/${slug}/assets/`;
}

export function maxZ(elements) {
  let z = 0;
  for (const el of Object.values(elements)) if (Number.isInteger(el.z) && el.z > z) z = el.z;
  return z;
}

// One row of the board index, with a sketch of the board for its card.
//
// The card is not a captured image. It is drawn on the index page from this
// sketch: the extents of everything on the board and a box per element, the
// way the board itself lays them out. So nothing is rendered or stored when the
// board changes, and the card is never out of date. The sketch is built when
// the index is asked for, from the board already in memory.
//
// Pictures are capped: only the largest few images and tiles carry a source,
// so a busy board does not make the index fetch every file on it. The rest are
// drawn as plain boxes.
const SKETCH_BOXES = 400;
const SKETCH_PICTURES = 12;

export function summarize(board) {
  const els = Object.values(board.elements ?? {});
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of els) {
    x0 = Math.min(x0, e.x); y0 = Math.min(y0, e.y);
    x1 = Math.max(x1, e.x + e.w); y1 = Math.max(y1, e.y + e.h);
  }
  const area = (e) => e.w * e.h;
  const boxes = [...els].sort((a, b) => area(b) - area(a)).slice(0, SKETCH_BOXES);
  const pictured = new Set(
    boxes.filter((e) => e.type === 'image' || (e.type === 'tile' && e.cover)).slice(0, SKETCH_PICTURES).map((e) => e.id)
  );
  const items = boxes
    .sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
    .map((e) => {
      const item = { type: e.type, x: e.x, y: e.y, w: e.w, h: e.h };
      if (pictured.has(e.id)) {
        item.src = e.type === 'tile' ? e.cover : assetBase(board.slug) + (e.display || e.file);
      }
      return item;
    });
  return {
    slug: board.slug,
    title: board.title,
    kind: board.kind,
    assignment: board.assignment ?? null,
    created: board.created,
    count: els.length,
    sketch: els.length ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0, items } : null
  };
}

// Apply one already-validated op to an elements object, in place. The server
// validates before calling this; the client calls it for its own ops and for
// ops that arrive over the stream. Idempotent enough that an echo is harmless:
// an update to an element that is gone, or a delete of one, does nothing.
export function applyOp(elements, op) {
  if (op.op === 'add') {
    elements[op.element.id] = op.element;
  } else if (op.op === 'update') {
    const el = elements[op.id];
    if (el) Object.assign(el, op.patch);
  } else if (op.op === 'delete') {
    delete elements[op.id];
  }
}
