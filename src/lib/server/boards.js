// The whiteboards. One module owns them: every /api/boards route, the ticker
// and the submit hook call in here, and the routes stay thin.
//
//   var/boards/<slug>.json                       the board
//   var/boards/<slug>/assets/<id>.<ext>          an original upload
//   var/boards/<slug>/assets/<id>.display.jpg    the browser-drawn copy
//
// A board is runtime state, like the budget and the sessions, so it lives under
// var/ and is machine-local. scripts/export-boards.js is how it gets into the
// archive at the end of the semester.
//
// The realtime hub is here too, in module memory. The site runs as one PM2
// fork, so one subscriber list is the whole hub; a restart drops every stream
// and the clients reconnect and compare versions.
import { json } from '@sveltejs/kit';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { read, update } from './store.js';
import { config } from './config.js';
import { MAX_PAGES } from './pdf-pages.js';
import { hashToken, bearer } from './auth.js';
import {
  SLUG,
  ID,
  TYPES,
  LIMITS,
  PATCHABLE,
  ASSET_FILE,
  applyOp,
  maxZ,
  summarize
} from '$lib/board/model.js';

export { SLUG, summarize };
export { slugify } from '$lib/board/model.js';

export const MESSAGES = {
  token:
    'This needs your submission token. Open the enrollment link I emailed you at the start of the semester and this browser will remember it, or paste the token itself into the box. Lost the email? Ask me and I will send a new one.',
  notOwner: "you're not adam!",
  noTitle: 'Give the board a title.',
  exists: 'A board with that name already exists.',
  locked: 'That one is locked.',
  full: 'This board is full.',
  type: 'Images, GIFs and mp4 only.'
};

export const SITE = { student: 'site', name: 'Site' };

const file = (slug) => `boards/${slug}.json`;
export const boardsDir = () => path.join(config.stateDir, 'boards');
export const assetsDir = (slug) => path.join(boardsDir(), slug, 'assets');

// ------------------------------------------------------------------ boards --

/** @type {Map<string, object>} */
const cache = new Map();

export async function get(slug) {
  if (!SLUG.test(slug)) return null;
  if (cache.has(slug)) return cache.get(slug);
  const board = await read(file(slug), null);
  if (board) cache.set(slug, board);
  return board;
}

export async function exists(slug) {
  if (!SLUG.test(slug)) return false;
  if (cache.has(slug)) return true;
  try {
    return (await stat(path.join(config.stateDir, file(slug)))).isFile();
  } catch {
    return false;
  }
}

export async function list() {
  let names = [];
  try {
    names = await readdir(boardsDir());
  } catch {
    return [];
  }
  const rows = [];
  for (const name of names) {
    const m = /^(.+)\.json$/.exec(name);
    if (!m || !SLUG.test(m[1])) continue;
    const board = await get(m[1]);
    if (board) rows.push(summarize(board));
  }
  return rows.sort((a, b) => String(b.created).localeCompare(String(a.created)));
}

export async function create({ slug, title, kind, assignment = null, by }) {
  if (!SLUG.test(slug)) return { ok: false, error: MESSAGES.noTitle };
  return update(file(slug), null, (cur) => {
    if (cur) return { state: cur, result: { ok: false, error: MESSAGES.exists } };
    const board = {
      slug,
      title: String(title).slice(0, LIMITS.title),
      kind: kind === 'assignment' ? 'assignment' : 'exercise',
      assignment,
      created: new Date().toISOString(),
      created_by: by,
      version: 0,
      elements: {}
    };
    cache.set(slug, board);
    return { state: board, result: { ok: true, board } };
  });
}

// ------------------------------------------------------------- validation --

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const size = (v) => clamp(v, LIMITS.minSize, LIMITS.maxSize);
const coord = (v) => clamp(v, -1e6, 1e6);
const str = (v, max) => String(v ?? '').slice(0, max);
// A tile's links point at Student Work and nowhere else.
const localUrl = (v, prefix) => (typeof v === 'string' && v.startsWith(prefix) && !/[\s"'<>]/.test(v) ? v : null);

// Build a clean element from whatever the client sent: known fields only, the
// author and time from the token, sizes clamped. Null if it cannot be one.
function cleanElement(raw, who, elements) {
  if (!raw || typeof raw !== 'object') return null;
  const { id, type } = raw;
  if (typeof id !== 'string' || !ID.test(id) || !TYPES.includes(type)) return null;
  if (![raw.x, raw.y, raw.w, raw.h].every(num)) return null;
  const el = {
    id,
    type,
    x: coord(raw.x),
    y: coord(raw.y),
    w: size(raw.w),
    h: size(raw.h),
    z: Number.isInteger(raw.z) ? raw.z : maxZ(elements) + 1,
    locked: raw.locked === true,
    by: who.student,
    name: who.name,
    at: new Date().toISOString()
  };
  if (type === 'image' || type === 'video') {
    if (typeof raw.file !== 'string' || !ASSET_FILE.test(raw.file) || raw.file.includes('.display.')) return null;
    el.file = raw.file;
  }
  if (type === 'image') {
    el.display = typeof raw.display === 'string' && ASSET_FILE.test(raw.display) ? raw.display : null;
    el.natural = num(raw.natural?.w) && num(raw.natural?.h) ? { w: raw.natural.w, h: raw.natural.h } : null;
  }
  if (type === 'text') {
    el.text = str(raw.text, LIMITS.text);
    el.size = raw.size === 'large' ? 'large' : 'normal';
  }
  if (type === 'note') el.text = str(raw.text, LIMITS.note);
  if (type === 'tile') {
    el.student = SLUG.test(String(raw.student)) ? raw.student : null;
    if (!el.student) return null;
    el.title = str(raw.title, LIMITS.title);
    el.gallery_text = str(raw.gallery_text, LIMITS.text);
    el.cover = localUrl(raw.cover, '/api/submissions/') ?? localUrl(raw.cover, '/submissions/');
    el.href = localUrl(raw.href, '/gallery/');
    // Height over width of the cover, so it shows uncropped. Tiles made before
    // this have none and keep the 4:3 crop.
    el.ratio = num(raw.ratio) ? clamp(raw.ratio, 0.1, 10) : null;
    // A PDF of two or more pages: every page, so the tile can page through them.
    const pages = Array.isArray(raw.pages)
      ? raw.pages.slice(0, MAX_PAGES).map((v) => localUrl(v, '/api/submissions/') ?? localUrl(v, '/submissions/'))
      : [];
    el.pages = pages.length > 1 && pages.every(Boolean) ? pages : [];
  }
  return el;
}

function cleanPatch(raw, el) {
  if (!raw || typeof raw !== 'object') return null;
  const keys = Object.keys(raw);
  if (!keys.length || keys.some((k) => !PATCHABLE.includes(k))) return null;
  const patch = {};
  for (const k of keys) {
    const v = raw[k];
    if (k === 'x' || k === 'y') { if (!num(v)) return null; patch[k] = coord(v); }
    else if (k === 'w' || k === 'h') { if (!num(v)) return null; patch[k] = size(v); }
    else if (k === 'z') { if (!Number.isInteger(v)) return null; patch.z = v; }
    else if (k === 'locked') { if (typeof v !== 'boolean') return null; patch.locked = v; }
    else if (k === 'text') {
      if (el.type !== 'text' && el.type !== 'note') return null;
      patch.text = str(v, el.type === 'note' ? LIMITS.note : LIMITS.text);
    } else if (k === 'size') {
      if (el.type !== 'text' || (v !== 'normal' && v !== 'large')) return null;
      patch.size = v;
    }
  }
  return patch;
}

// Check one op against the current elements. Returns the op as it should be
// applied and broadcast, or { error }.
function check(op, elements, who) {
  if (!op || typeof op !== 'object') return { error: 'bad op' };
  if (op.op === 'add') {
    const el = cleanElement(op.element, who, elements);
    if (!el) return { error: 'bad element' };
    if (elements[el.id]) return { error: 'id exists' };
    if (Object.keys(elements).length >= LIMITS.elements) return { error: MESSAGES.full };
    return { op: { op: 'add', element: el } };
  }
  if (op.op === 'update') {
    const el = elements[op.id];
    if (!el) return { error: 'no such element' };
    const patch = cleanPatch(op.patch, el);
    if (!patch) return { error: 'bad patch' };
    const unlocking = Object.keys(patch).length === 1 && patch.locked === false;
    if (el.locked && !unlocking) return { error: MESSAGES.locked };
    return { op: { op: 'update', id: el.id, patch, ...(op.transient ? { transient: true } : {}) } };
  }
  if (op.op === 'delete') {
    const el = elements[op.id];
    if (!el) return { error: 'no such element' };
    if (el.locked) return { error: MESSAGES.locked };
    return { op: { op: 'delete', id: el.id } };
  }
  return { error: 'bad op' };
}

// Apply a batch in order. Persisted ops go through the serialized store write
// and bump the version once; transient ops (live drag) are checked against the
// current state, broadcast and forgotten.
export async function apply(slug, ops, who, cid = null) {
  if (!(await get(slug))) return null;
  const transient = ops.filter((o) => o?.transient === true);
  const persisted = ops.filter((o) => o?.transient !== true);

  if (transient.length) {
    const board = cache.get(slug);
    const ok = [];
    for (const o of transient) {
      if (o.op !== 'update') continue;
      const r = check(o, board.elements, who);
      if (r.op) ok.push(r.op);
    }
    if (ok.length) broadcast(slug, 'ops', { version: board.version, ops: ok, from: who.student, cid }, cid);
  }
  if (!persisted.length) {
    return { version: cache.get(slug).version, applied: 0, rejected: [] };
  }

  const out = await update(file(slug), null, (cur) => {
    // The cached copy and the file are the same object's history; the file
    // wins on a restart, the cache in between.
    const board = cache.get(slug) ?? cur;
    const applied = [];
    const rejected = [];
    persisted.forEach((o, index) => {
      const r = check(o, board.elements, who);
      if (r.error) rejected.push({ index, id: o?.id ?? o?.element?.id ?? null, error: r.error });
      else {
        applyOp(board.elements, r.op);
        applied.push(r.op);
      }
    });
    if (applied.length) board.version += 1;
    cache.set(slug, board);
    return { state: board, result: { version: board.version, applied, rejected } };
  });

  if (out.applied.length) {
    broadcast(slug, 'ops', { version: out.version, ops: out.applied, from: who.student, cid });
  }
  return { version: out.version, applied: out.applied.length, rejected: out.rejected };
}

// -------------------------------------------------------------------- hub --

const SUBSCRIBER_CAP = 200;
const encoder = new TextEncoder();

/** @type {Map<string, Set<{ controller: ReadableStreamDefaultController, who: object, cid: string|null }>>} */
const hub = new Map();

export function subscriberCount(slug) {
  return hub.get(slug)?.size ?? 0;
}
export const canSubscribe = (slug) => subscriberCount(slug) < SUBSCRIBER_CAP;

export function frame(event, data) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function people(slug, extra = null) {
  const seen = new Map();
  for (const s of [...(hub.get(slug) ?? []), ...(extra ? [extra] : [])]) {
    seen.set(s.who.student, { student: s.who.student, name: s.who.name });
  }
  return [...seen.values()];
}

export function subscribe(slug, sub) {
  if (!hub.has(slug)) hub.set(slug, new Set());
  // Everyone already here hears about the newcomer; the newcomer's own count
  // comes in its `hello`.
  broadcast(slug, 'presence', { people: people(slug, sub) });
  hub.get(slug).add(sub);
  return () => {
    const set = hub.get(slug);
    if (!set?.delete(sub)) return;
    if (!set.size) hub.delete(slug);
    broadcast(slug, 'presence', { people: people(slug) });
  };
}

// `except` is a client id: the sender's own tab, for things it already has.
export function broadcast(slug, event, data, except = null) {
  const set = hub.get(slug);
  if (!set) return;
  const bytes = frame(event, data);
  for (const sub of set) {
    if (except && sub.cid === except) continue;
    try {
      sub.controller.enqueue(bytes);
    } catch {
      set.delete(sub);
    }
  }
}

// ------------------------------------------------------------- throttling --

// Per token, per kind, per second. Module memory like /api/presence; swept
// once a minute so a token that stops posting does not stay in the map.
const RATES = { ops: 20, cursor: 8 };
/** @type {Map<string, { start: number, n: number }>} */
const windows = new Map();
let lastSweep = Date.now();

export function allow(request, kind) {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    for (const [k, w] of windows) if (now - w.start > 1000) windows.delete(k);
    lastSweep = now;
  }
  const key = `${kind}:${hashToken(bearer(request) ?? '')}`;
  const w = windows.get(key);
  if (!w || now - w.start >= 1000) {
    windows.set(key, { start: now, n: 1 });
    return true;
  }
  w.n += 1;
  return w.n <= RATES[kind];
}

// ------------------------------------------------------------ route glue --


export const NO_STORE = { 'cache-control': 'no-store' };
export const reply = (body, status = 200) => json(body, { status, headers: NO_STORE });
export const unauthorized = () => reply({ ok: false, error: MESSAGES.token }, 401);
export const badOrigin = () => reply({ ok: false, error: 'bad origin' }, 403);
export const notFound = () => reply({ ok: false, error: 'not found' }, 404);
