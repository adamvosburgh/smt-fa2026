<script>
  // The whiteboard canvas.
  //
  // DOM and CSS transforms, not a <canvas>: one stage div carries the pan and
  // zoom as a transform, and every element is absolutely positioned inside it
  // at its board coordinates (1 unit = 1 css px at zoom 1). The only canvas is
  // the overlay that draws other people's cursors.
  //
  // Every change is an op (src/lib/board/model.js). A local op is applied at
  // once and then posted; ops from everyone else arrive over the stream in
  // src/lib/board/transport.js and are applied in version order. A gap in the
  // versions, a refused op or a reconnect all end the same way: refetch the
  // board and replace the local state.
  //
  // mode 'view' is the archive: pan and zoom, nothing else.
  import { onMount } from 'svelte';
  import { token } from '$lib/token.js';
  import { inlineMarkdown } from '$lib/inline-markdown.js';
  import { drawCopy } from '$lib/draw-copy.js';
  import { applyOp, assetBase, maxZ, newId, LIMITS, UPLOAD_EXT } from '$lib/board/model.js';
  import { connect, fetchBoard, clientId } from '$lib/board/transport.js';
  import { loadAsset, needsToken } from '$lib/board/assets.js';

  let {
    slug,
    mode = 'edit',
    initial = null,
    who = null,
    onmeta = () => {},
    onpresence = () => {},
    onerror = () => {},
    // Bumped by the page's ? button: shows the hint again for ten seconds.
    hintRequest = 0
  } = $props();

  const editable = mode === 'edit';
  const MAX_BYTES = 15 * 1024 * 1024;
  const ZOOM = [0.1, 4];
  const GRID = 32;
  const TOAST_MS = 6000;
  const VIEW_KEY = `smt.board.view.${slug}`;
  const HINT_KEY = 'smt.board.hint';
  const HINT_AGAIN_MS = 10_000;
  const ARROW = 12;

  // ------------------------------------------------------------------ state --
  let elements = $state(initial?.elements ? JSON.parse(JSON.stringify(initial.elements)) : {});
  let version = initial?.version ?? 0;
  let view = $state({ x: 0, y: 0, k: 1 });
  let selected = $state([]);
  let editingId = $state(null);
  let menu = $state(null);
  let toast = $state(null);
  let pending = $state({});
  let status = $state('live');
  let showHint = $state(false);
  let marquee = $state(null);
  let spaceDown = $state(false);
  let panning = $state(false);
  let moving = $state(false); // hides the toolbar while something is dragged
  let srcs = $state({});

  let boardEl = $state(null);
  let canvasEl = $state(null);
  let fileInput = $state(null);

  const cid = clientId();
  let transport = null;
  let fine = $state(false);
  let plaintextOnly = true;
  let lastPointer = { x: 0, y: 0 };
  let gesture = null;
  let suppressClick = false;
  let fresh = null; // an element added empty; deleted again if left empty
  const pointers = new Map();

  const list = $derived(Object.values(elements));
  const selEls = $derived(selected.map((id) => elements[id]).filter(Boolean));
  const anyLocked = $derived(selEls.some((el) => el.locked));
  const bbox = $derived.by(() => {
    if (!selEls.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const el of selEls) {
      x0 = Math.min(x0, el.x); y0 = Math.min(y0, el.y);
      x1 = Math.max(x1, el.x + el.w); y1 = Math.max(y1, el.y + el.h);
    }
    return { x0, y0, x1, y1 };
  });

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const now = () => new Date().toISOString();

  function chunks(ops, n = LIMITS.opsPerRequest) {
    const out = [];
    for (let i = 0; i < ops.length; i += n) out.push(ops.slice(i, i + n));
    return out;
  }

  // ---------------------------------------------------------------- storage --
  function saveView() {
    try {
      sessionStorage.setItem(VIEW_KEY, JSON.stringify(view));
    } catch {
      // Private windows: the view just is not remembered.
    }
  }
  function restoreView() {
    try {
      const v = JSON.parse(sessionStorage.getItem(VIEW_KEY) ?? 'null');
      if (v && [v.x, v.y, v.k].every(Number.isFinite)) {
        view = { x: v.x, y: v.y, k: clamp(v.k, ...ZOOM) };
        return true;
      }
    } catch {
      // Fall through to fitting the board.
    }
    return false;
  }

  // The hint shows until the first thing is added on this browser, then only
  // when asked for with the ? button.
  function markHintSeen() {
    showHint = false;
    try {
      localStorage.setItem(HINT_KEY, 'seen');
    } catch {
      // Shown again next time; harmless.
    }
  }

  let hintTimer = 0;
  $effect(() => {
    if (!hintRequest) return;
    showHint = true;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => (showHint = false), HINT_AGAIN_MS);
    return () => clearTimeout(hintTimer);
  });

  // Frame everything on the board, never zoomed in past 1.
  function fit() {
    if (!boardEl) return;
    const r = boardEl.getBoundingClientRect();
    const els = Object.values(elements);
    if (!els.length) {
      view = { x: Math.round(r.width / 2 - 240), y: 120, k: 1 };
      return;
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const el of els) {
      x0 = Math.min(x0, el.x); y0 = Math.min(y0, el.y);
      x1 = Math.max(x1, el.x + el.w); y1 = Math.max(y1, el.y + el.h);
    }
    const k = clamp(Math.min((r.width - 120) / (x1 - x0), (r.height - 120) / (y1 - y0), 1), ...ZOOM);
    view = { x: (r.width - (x1 - x0) * k) / 2 - x0 * k, y: 60 - y0 * k, k };
  }

  // ------------------------------------------------------------------- sync --
  function say(text, undo = null) {
    clearTimeout(toast?.timer);
    const timer = setTimeout(() => (toast = null), TOAST_MS);
    toast = { text, undo, timer };
  }

  // Apply locally, then post. Transient ops (live drag) are already on screen.
  function commit(ops) {
    if (!ops.length) return;
    for (const op of ops) if (!op.transient) applyOp(elements, clone(op));
    for (const batch of chunks(ops)) post(batch);
  }

  async function post(ops, tries = 0) {
    if (!transport) return;
    const { status: code, body } = await transport.send(ops);
    if (code === 200 || ops.every((o) => o.transient)) return;
    if ((code === 429 || code === 0) && tries < 3) {
      setTimeout(() => post(ops, tries + 1), 1000 * (tries + 1));
      return;
    }
    if (body?.error) say(body.error);
    refetch();
  }

  let refetching = null;
  function refetch() {
    if (refetching || !editable) return refetching;
    refetching = fetchBoard(slug, $token)
      .then(replace)
      .catch((err) => onerror(err.status ?? 0))
      .finally(() => (refetching = null));
    return refetching;
  }

  function replace(board) {
    elements = board.elements ?? {};
    version = board.version ?? 0;
    selected = selected.filter((id) => elements[id]);
    onmeta(board);
  }

  const cursors = new Map();

  function onevent(event, data) {
    if (event === 'hello') {
      onpresence(data.people?.length ?? 0);
      if (data.version !== version) refetch();
    } else if (event === 'presence') {
      onpresence(data.people?.length ?? 0);
    } else if (event === 'ops') {
      if (data.ops.every((o) => o.transient)) {
        // Someone else's drag in progress. The sender never gets its own back.
        const dragging = new Set(gesture?.items?.map((i) => i.id) ?? []);
        for (const op of data.ops) if (!dragging.has(op.id)) applyOp(elements, op);
        return;
      }
      if (data.version > version + 1) {
        refetch();
        return;
      }
      if (data.cid === cid || data.version <= version) {
        version = Math.max(version, data.version);
        return;
      }
      for (const op of data.ops) applyOp(elements, op);
      version = data.version;
    } else if (event === 'cursor') {
      const key = data.cid ?? data.student;
      if (data.x === null || data.y === null) {
        cursors.delete(key);
        return;
      }
      const c = cursors.get(key);
      if (c) Object.assign(c, { tx: data.x, ty: data.y, at: Date.now(), name: data.name });
      else cursors.set(key, { name: data.name, x: data.x, y: data.y, tx: data.x, ty: data.y, at: Date.now() });
      startCursors();
    }
  }

  // ----------------------------------------------------------------- assets --
  const requested = new Set();
  const urlOf = (el) =>
    el.type === 'image' ? assetBase(slug) + (el.display || el.file)
    : el.type === 'video' ? assetBase(slug) + el.file
    : el.type === 'tile' ? el.cover
    : null;
  const src = (url) => (needsToken(url) ? srcs[url] : url);

  $effect(() => {
    if (!editable) return;
    for (const el of list) {
      const url = urlOf(el);
      if (!url || !needsToken(url) || requested.has(url)) continue;
      requested.add(url);
      loadAsset(url, $token).then((u) => {
        if (u) srcs[url] = u;
        else requested.delete(url);
      });
    }
  });

  function openOriginal(el) {
    const url = assetBase(slug) + el.file;
    if (!needsToken(url)) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    // Opened now, filled in when the file arrives, so no popup blocker objects.
    const win = window.open('', '_blank');
    loadAsset(url, $token).then((u) => {
      if (u && win) win.location.href = u;
      else win?.close();
    });
  }

  // ----------------------------------------------------------------- coords --
  function toBoard(clientX, clientY) {
    const r = boardEl.getBoundingClientRect();
    const sx = clientX - r.left;
    const sy = clientY - r.top;
    return { x: (sx - view.x) / view.k, y: (sy - view.y) / view.k, sx, sy };
  }

  // ----------------------------------------------------------------- adding --
  function authorship() {
    return { by: who?.student ?? '', name: who?.name ?? '', at: now() };
  }

  function addTyped(type, bx, by, text = '') {
    const id = newId();
    const base = { id, x: Math.round(bx), y: Math.round(by), z: maxZ(elements) + 1, locked: false, ...authorship() };
    const el =
      type === 'note'
        ? { ...base, type: 'note', w: 220, h: 220, text: text.slice(0, LIMITS.note) }
        : { ...base, type: 'text', w: 320, h: 48, text: text.slice(0, LIMITS.text), size: 'normal' };
    commit([{ op: 'add', element: el }]);
    selected = [id];
    markHintSeen();
    if (!text) {
      fresh = id;
      editingId = id;
    }
  }

  const extOf = (f) => String(f?.name ?? '').split('.').pop().toLowerCase();

  async function naturalSize(file, ext) {
    try {
      if (ext === 'mp4') {
        return await new Promise((resolve) => {
          const v = document.createElement('video');
          const u = URL.createObjectURL(file);
          const done = (size) => {
            URL.revokeObjectURL(u);
            resolve(size);
          };
          v.preload = 'metadata';
          v.onloadedmetadata = () => done({ w: v.videoWidth || 640, h: v.videoHeight || 360 });
          v.onerror = () => done({ w: 640, h: 360 });
          v.src = u;
        });
      }
      const bmp = await createImageBitmap(file);
      const size = { w: bmp.width, h: bmp.height };
      bmp.close?.();
      return size;
    } catch {
      return { w: 480, h: 360 };
    }
  }

  async function upload(file, bx, by) {
    const ext = extOf(file);
    if (!UPLOAD_EXT.includes(ext)) {
      say('Images, GIFs and mp4 only.');
      return;
    }
    if (file.size > MAX_BYTES) {
      say(`That file is ${(file.size / 1048576).toFixed(1)}MB. The limit is 15MB.`);
      return;
    }
    markHintSeen();
    const id = newId();
    const natural = await naturalSize(file, ext);
    const scale = 480 / Math.max(natural.w, natural.h, 1);
    const box = {
      x: Math.round(bx),
      y: Math.round(by),
      w: Math.max(24, Math.round(natural.w * scale)),
      h: Math.max(24, Math.round(natural.h * scale))
    };
    pending[id] = box;
    try {
      const fd = new FormData();
      fd.append('file', file, file.name || `pasted.${ext}`);
      // No copy for a small file, a GIF (a copy would stop it moving) or a video.
      if (ext !== 'mp4' && ext !== 'gif' && file.size >= 400_000) {
        const copy = await drawCopy(file, { longSide: 1600 });
        if (copy) fd.append('display', copy, 'display.jpg');
      }
      const res = await fetch(`/api/boards/${slug}/assets`, {
        method: 'POST',
        headers: { authorization: `Bearer ${$token}` },
        body: fd
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        say(body?.error ?? 'The upload did not go through. Try again.');
        return;
      }
      const el = { id, type: body.type, ...box, z: maxZ(elements) + 1, locked: false, file: body.file, ...authorship() };
      if (body.type === 'image') Object.assign(el, { display: body.display, natural });
      commit([{ op: 'add', element: el }]);
    } catch {
      say('The upload did not go through. Try again.');
    } finally {
      delete pending[id];
    }
  }

  function chooseFiles(e) {
    const files = [...(e.currentTarget.files ?? [])];
    const at = menuPoint ?? lastPointer;
    files.forEach((f, i) => upload(f, at.x + 40 * i, at.y + 40 * i));
    e.currentTarget.value = '';
    menuPoint = null;
  }

  let menuPoint = null;
  function pick(kind) {
    const at = { x: menu.bx, y: menu.by };
    menu = null;
    if (kind === 'image') {
      menuPoint = at;
      fileInput?.click();
    } else {
      addTyped(kind, at.x, at.y);
    }
  }

  // ---------------------------------------------------------------- editing --
  function editable_(node, el) {
    node.textContent = el.text ?? '';
    node.setAttribute('contenteditable', plaintextOnly ? 'plaintext-only' : 'true');
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const sel = getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  function finishEdit(node) {
    const id = editingId;
    if (!id) return;
    editingId = null;
    const el = elements[id];
    if (!el) return;
    const max = el.type === 'note' ? LIMITS.note : LIMITS.text;
    const text = node.innerText.replace(/\n$/, '').slice(0, max);
    if (!text.trim() && fresh === id) {
      fresh = null;
      selected = selected.filter((s) => s !== id);
      commit([{ op: 'delete', id }]);
      return;
    }
    fresh = null;
    if (text !== el.text) commit([{ op: 'update', id, patch: { text } }]);
  }

  function editKeydown(e) {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }

  // Only where plaintext-only is missing: keep a paste to its text.
  function editPaste(e) {
    e.stopPropagation();
    if (plaintextOnly) return;
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '');
  }

  // ------------------------------------------------------------- selection --
  function setLocked(value) {
    commit(selEls.filter((el) => el.locked !== value).map((el) => ({ op: 'update', id: el.id, patch: { locked: value } })));
  }

  function removeSelected() {
    const els = selEls;
    if (!els.length || els.some((el) => el.locked)) return;
    const kept = els.map(clone);
    selected = [];
    commit(els.map((el) => ({ op: 'delete', id: el.id })));
    say('Deleted.', kept);
  }

  function undo() {
    const kept = toast?.undo;
    if (!kept) return;
    clearTimeout(toast.timer);
    toast = null;
    commit(kept.filter((el) => !elements[el.id]).map((el) => ({ op: 'add', element: el })));
  }

  function setSize(size) {
    const el = selEls[0];
    if (el?.type === 'text') commit([{ op: 'update', id: el.id, patch: { size } }]);
  }

  let nudgeTimer = 0;
  const nudged = new Set();
  function nudge(dx, dy) {
    for (const el of selEls) {
      if (el.locked) continue;
      el.x += dx;
      el.y += dy;
      nudged.add(el.id);
    }
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(() => {
      const ops = [...nudged]
        .map((id) => elements[id])
        .filter(Boolean)
        .map((el) => ({ op: 'update', id: el.id, patch: { x: el.x, y: el.y } }));
      nudged.clear();
      commit(ops);
    }, 250);
  }

  // ---------------------------------------------------------------- pointer --
  let cursorTimer = 0;
  let cursorLast = 0;
  let cursorNext = null;
  function sendCursor(p) {
    if (!transport || !fine) return;
    cursorNext = p;
    const wait = 200 - (performance.now() - cursorLast);
    if (wait <= 0) flushCursor();
    else if (!cursorTimer) cursorTimer = setTimeout(flushCursor, wait);
  }
  function flushCursor() {
    cursorTimer = 0;
    cursorLast = performance.now();
    if (cursorNext) transport?.cursor(Math.round(cursorNext.x), Math.round(cursorNext.y));
  }

  let lastTransient = 0;
  function sendTransient(patches) {
    const t = performance.now();
    if (t - lastTransient < 100) return;
    lastTransient = t;
    post(patches.slice(0, LIMITS.opsPerRequest).map(([id, patch]) => ({ op: 'update', id, patch, transient: true })));
  }

  function onpointerdown(e) {
    suppressClick = false;
    const p = toBoard(e.clientX, e.clientY);
    lastPointer = p;
    if (e.target.closest('[data-editing]')) return;
    if (menu) menu = null;
    // A pointerdown elsewhere ends an edit; blur first, before anything else
    // can hold on to the focus.
    if (editingId) document.activeElement?.blur?.();

    if (e.pointerType === 'touch') {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        gesture = {
          kind: 'pinch',
          d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          mx0: (a.x + b.x) / 2,
          my0: (a.y + b.y) / 2,
          view0: { ...view }
        };
        return;
      }
    }

    const capture = () => boardEl.setPointerCapture?.(e.pointerId);

    // In view mode a left drag pans, but only once it moves, so a tile's link
    // still takes a click.
    if (!editable && e.button === 0) {
      gesture = { kind: 'shift', id: null, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, pointerId: e.pointerId };
      return;
    }
    // Right or middle button, or space: pan.
    if (e.button === 1 || e.button === 2 || (e.button === 0 && spaceDown)) {
      e.preventDefault();
      gesture = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      panning = true;
      capture();
      return;
    }
    if (e.button !== 0) return;

    const node = e.target.closest('[data-id]');
    const id = node?.dataset.id;
    const el = id ? elements[id] : null;

    // Shift: a drag pans, a click without moving adds to or takes from the
    // selection. Which one is decided on the first move.
    if (e.shiftKey) {
      gesture = { kind: 'shift', id: el ? id : null, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, pointerId: e.pointerId };
      return;
    }

    if (el && e.target.closest('[data-handle]') && !el.locked) {
      gesture = { kind: 'resize', id, px: p.x, py: p.y, w: el.w, h: el.h, keep: el.type === 'image' || el.type === 'video' };
      capture();
      return;
    }

    // The pointer is not captured until the element actually moves. Captured
    // straight away, the click and dblclick that follow would land on the
    // board instead of the element, so a link would not open and a
    // double-click would not edit.
    if (el) {
      if (!selected.includes(id)) selected = [id];
      if (!el.locked) {
        const items = selEls.filter((s) => !s.locked).map((s) => ({ id: s.id, x: s.x, y: s.y }));
        gesture = { kind: 'drag', px: p.x, py: p.y, items, moved: false, pointerId: e.pointerId };
      }
      return;
    }

    selected = [];
    gesture = { kind: 'marquee', x0: p.x, y0: p.y, sx: e.clientX, sy: e.clientY, pointerId: e.pointerId };
  }

  function onpointermove(e) {
    if (!boardEl) return;
    const p = toBoard(e.clientX, e.clientY);
    lastPointer = p;
    if (editable && e.pointerType !== 'touch') sendCursor(p);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture;
    if (!g) return;

    if (g.kind === 'pinch') {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const r = boardEl.getBoundingClientRect();
      const k = clamp((g.view0.k * d) / g.d0, ...ZOOM);
      const bx = (g.mx0 - r.left - g.view0.x) / g.view0.k;
      const by = (g.my0 - r.top - g.view0.y) / g.view0.k;
      const mx = (a.x + b.x) / 2 - r.left;
      const my = (a.y + b.y) / 2 - r.top;
      view = { x: mx - bx * k, y: my - by * k, k };
    } else if (g.kind === 'shift') {
      if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 3) return;
      gesture = { kind: 'pan', sx: g.sx, sy: g.sy, vx: g.vx, vy: g.vy };
      panning = true;
      boardEl.setPointerCapture?.(g.pointerId);
      view.x = g.vx + (e.clientX - g.sx);
      view.y = g.vy + (e.clientY - g.sy);
    } else if (g.kind === 'pan') {
      view.x = g.vx + (e.clientX - g.sx);
      view.y = g.vy + (e.clientY - g.sy);
    } else if (g.kind === 'drag') {
      const dx = p.x - g.px;
      const dy = p.y - g.py;
      if (!g.moved && Math.hypot(dx, dy) * view.k < 3) return;
      if (!g.moved) boardEl.setPointerCapture?.(g.pointerId);
      g.moved = true;
      moving = true;
      const patches = [];
      for (const it of g.items) {
        const el = elements[it.id];
        if (!el) continue;
        el.x = Math.round(it.x + dx);
        el.y = Math.round(it.y + dy);
        patches.push([el.id, { x: el.x, y: el.y }]);
      }
      sendTransient(patches);
    } else if (g.kind === 'resize') {
      const el = elements[g.id];
      if (!el) return;
      let w = Math.max(LIMITS.minSize, g.w + (p.x - g.px));
      let h = Math.max(LIMITS.minSize, g.h + (p.y - g.py));
      if (g.keep) {
        const ratio = g.w / g.h;
        h = w / ratio;
        if (h < LIMITS.minSize) {
          h = LIMITS.minSize;
          w = h * ratio;
        }
      }
      el.w = Math.round(w);
      el.h = Math.round(h);
      g.moved = true;
      moving = true;
      sendTransient([[el.id, { w: el.w, h: el.h }]]);
    } else if (g.kind === 'marquee') {
      if (!marquee) {
        if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 3) return;
        boardEl.setPointerCapture?.(g.pointerId);
      }
      marquee = { x0: g.x0, y0: g.y0, x1: p.x, y1: p.y };
    }
  }

  function onpointerup(e) {
    pointers.delete(e.pointerId);
    const g = gesture;
    if (!g) return;
    if (g.kind === 'pinch') {
      if (pointers.size < 2) {
        gesture = null;
        saveView();
      }
      return;
    }
    gesture = null;
    panning = false;
    moving = false;
    if (g.kind === 'shift') {
      if (g.id) selected = selected.includes(g.id) ? selected.filter((s) => s !== g.id) : [...selected, g.id];
    } else if (g.kind === 'pan') {
      saveView();
    } else if (g.kind === 'drag' && g.moved) {
      suppressClick = true;
      commit(
        g.items
          .map((it) => elements[it.id])
          .filter(Boolean)
          .map((el) => ({ op: 'update', id: el.id, patch: { x: el.x, y: el.y } }))
      );
    } else if (g.kind === 'resize' && g.moved) {
      const el = elements[g.id];
      if (el) commit([{ op: 'update', id: el.id, patch: { w: el.w, h: el.h } }]);
    } else if (g.kind === 'marquee' && marquee) {
      const x0 = Math.min(marquee.x0, marquee.x1);
      const x1 = Math.max(marquee.x0, marquee.x1);
      const y0 = Math.min(marquee.y0, marquee.y1);
      const y1 = Math.max(marquee.y0, marquee.y1);
      if ((x1 - x0) * view.k > 3 || (y1 - y0) * view.k > 3) {
        const hit = list.filter((el) => el.x < x1 && el.x + el.w > x0 && el.y < y1 && el.y + el.h > y0).map((el) => el.id);
        selected = hit;
      }
      marquee = null;
    }
  }

  function onpointerleave(e) {
    if (e.pointerType === 'touch' || !transport || !fine) return;
    clearTimeout(cursorTimer);
    cursorTimer = 0;
    cursorNext = null;
    transport.cursor(null, null);
  }

  // A drag that ends over a tile's link is not a click on it.
  function onclickcapture(e) {
    if (!suppressClick) return;
    suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  }

  function ondblclick(e) {
    if (!editable) return;
    const under = document.elementFromPoint(e.clientX, e.clientY) ?? e.target;
    if (under.closest('[data-editing]')) return;
    const node = under.closest('[data-id]');
    const p = toBoard(e.clientX, e.clientY);
    if (node) {
      const el = elements[node.dataset.id];
      if (!el) return;
      if (el.type === 'image') openOriginal(el);
      else if ((el.type === 'text' || el.type === 'note') && !el.locked) {
        selected = [el.id];
        editingId = el.id;
      }
      return;
    }
    menu = { sx: p.sx, sy: p.sy, bx: p.x, by: p.y };
  }

  function onwheel(e) {
    e.preventDefault();
    const r = boardEl.getBoundingClientRect();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1;
    // Scrolling zooms, about the pointer. A trackpad sends small deltas and a
    // mouse wheel large ones; the cap keeps one wheel notch to about a quarter.
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    const dy = clamp(e.deltaY * unit, -50, 50);
    const k = clamp(view.k * Math.exp(-dy * 0.005), ...ZOOM);
    view = { x: sx - ((sx - view.x) * k) / view.k, y: sy - ((sy - view.y) * k) / view.k, k };
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(saveView, 300);
  }
  let wheelTimer = 0;

  function ondragover(e) {
    if (!editable || !e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function ondrop(e) {
    if (!editable) return;
    e.preventDefault();
    const p = toBoard(e.clientX, e.clientY);
    [...(e.dataTransfer?.files ?? [])].forEach((f, i) => upload(f, p.x + 40 * i, p.y + 40 * i));
  }

  // --------------------------------------------------------------- keyboard --
  const typing = (t) => t?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName ?? '');

  function onkeydown(e) {
    if (!editable || typing(e.target)) return;
    if (e.code === 'Space') {
      if (e.target?.tagName === 'BUTTON' || e.target?.tagName === 'A') return;
      e.preventDefault();
      spaceDown = true;
      return;
    }
    if (e.key === 'Escape') {
      menu = null;
      selected = [];
      return;
    }
    if (!selected.length) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeSelected();
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    const arrows = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (arrows[e.key]) {
      e.preventDefault();
      nudge(...arrows[e.key]);
    }
  }

  function onkeyup(e) {
    if (e.code === 'Space') spaceDown = false;
  }

  function onpaste(e) {
    if (!editable || typing(e.target)) return;
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length) {
      e.preventDefault();
      files.forEach((f, i) => upload(f, lastPointer.x + 40 * i, lastPointer.y + 40 * i));
      return;
    }
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (text.trim()) {
      e.preventDefault();
      addTyped('text', lastPointer.x, lastPointer.y, text);
    }
  }

  // ---------------------------------------------------------------- cursors --
  let cursorRaf = 0;
  let cursorDrawn = 0;
  let hi = '#00ff00';
  let hiFg = '#000000';
  let labelPx = 10;

  function startCursors() {
    if (!cursorRaf && canvasEl) {
      cursorDrawn = performance.now();
      cursorRaf = requestAnimationFrame(drawCursors);
    }
  }

  function drawCursors(t) {
    cursorRaf = 0;
    if (!canvasEl || !boardEl) return;
    const r = boardEl.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(r.width * dpr);
    const H = Math.round(r.height * dpr);
    if (canvasEl.width !== W || canvasEl.height !== H) {
      canvasEl.width = W;
      canvasEl.height = H;
    }
    const ctx = canvasEl.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);

    // Ease toward the last position heard, so five updates a second read as
    // movement rather than jumps.
    const alpha = 1 - Math.exp(-(t - cursorDrawn) / 40);
    cursorDrawn = t;
    const stale = Date.now() - 10_000;
    ctx.font = `${labelPx}px 'Roboto Mono', monospace`;
    ctx.textBaseline = 'middle';
    for (const [key, c] of cursors) {
      if (c.at < stale) {
        cursors.delete(key);
        continue;
      }
      c.x += (c.tx - c.x) * alpha;
      c.y += (c.ty - c.y) * alpha;
      const sx = c.x * view.k + view.x;
      const sy = c.y * view.k + view.y;

      // The arrow from MouseAgents.svelte, nose-first along +x, turned to point
      // up and left like a pointer with its tip on the position.
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-Math.PI * 0.75);
      ctx.translate(-ARROW * 0.6, 0);
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.moveTo(ARROW * 0.6, 0);
      ctx.lineTo(-ARROW * 0.4, ARROW * 0.34);
      ctx.lineTo(-ARROW * 0.18, 0);
      ctx.lineTo(-ARROW * 0.4, -ARROW * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      const label = c.name ?? '';
      const w = ctx.measureText(label).width + 10;
      const h = labelPx + 6;
      const lx = sx + 10;
      const ly = sy + 12;
      ctx.fillStyle = hi;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(lx, ly, w, h, h / 2);
      else ctx.rect(lx, ly, w, h);
      ctx.fill();
      ctx.fillStyle = hiFg;
      ctx.fillText(label, lx + 5, ly + h / 2);
    }
    if (cursors.size) cursorRaf = requestAnimationFrame(drawCursors);
  }

  // ------------------------------------------------------------------ mount --
  onMount(() => {
    fine = window.matchMedia('(pointer: fine)').matches;
    try {
      const probe = document.createElement('div');
      probe.contentEditable = 'plaintext-only';
      plaintextOnly = probe.contentEditable === 'plaintext-only';
    } catch {
      plaintextOnly = false;
    }
    const css = getComputedStyle(document.documentElement);
    hi = css.getPropertyValue('--hi').trim() || hi;
    hiFg = css.getPropertyValue('--hi-fg').trim() || hiFg;
    labelPx = 0.62 * (parseFloat(css.fontSize) || 16);

    boardEl.addEventListener('wheel', onwheel, { passive: false });
    const onblur = () => (spaceDown = false);
    window.addEventListener('blur', onblur);

    let alive = true;
    if (!editable) {
      if (!restoreView()) fit();
    } else {
      try {
        showHint = localStorage.getItem(HINT_KEY) !== 'seen';
      } catch {
        showHint = true;
      }
      fetchBoard(slug, $token)
        .then((board) => {
          if (!alive) return;
          replace(board);
          if (!restoreView()) fit();
          transport = connect({
            slug,
            token: $token,
            cid,
            onevent,
            onstatus: (s) => {
              status = s;
              if (s === 'denied') onerror(401);
            }
          });
        })
        .catch((err) => alive && onerror(err.status ?? 0));
    }
    const r = boardEl.getBoundingClientRect();
    lastPointer = { x: (r.width / 2 - view.x) / view.k, y: (r.height / 2 - view.y) / view.k };

    return () => {
      alive = false;
      boardEl?.removeEventListener('wheel', onwheel);
      window.removeEventListener('blur', onblur);
      if (transport && fine) transport.cursor(null, null);
      transport?.close();
      transport = null;
      cancelAnimationFrame(cursorRaf);
      clearTimeout(cursorTimer);
      clearTimeout(nudgeTimer);
      clearTimeout(toast?.timer);
      clearTimeout(hintTimer);
    };
  });

  const placeholder = (el) => (el.type === 'note' ? 'Write a note' : 'Type here');
</script>

<svelte:window {onkeydown} {onkeyup} {onpaste} />

<div class="wrap">
  <div
    class="board"
    class:edit={editable}
    class:grab={spaceDown || !editable}
    class:panning
    bind:this={boardEl}
    style="background-size: {GRID * view.k}px {GRID * view.k}px; background-position: {view.x}px {view.y}px"
    role="application"
    aria-label="Whiteboard"
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={onpointerup}
    {onpointerleave}
    {ondblclick}
    {ondragover}
    {ondrop}
    {onclickcapture}
    oncontextmenu={(e) => e.preventDefault()}
  >
    <div class="stage" style="transform: translate({view.x}px, {view.y}px) scale({view.k}); --k: {view.k}">
      {#each list as el (el.id)}
        <div
          class="el {el.type}"
          class:selected={editable && selected.includes(el.id)}
          class:locked={el.locked}
          class:large={el.size === 'large'}
          data-id={el.id}
          style="left: {el.x}px; top: {el.y}px; width: {el.w}px; {el.type === 'text' ? 'min-height' : 'height'}: {el.h}px; z-index: {el.z}"
        >
          {#if el.type === 'image'}
            {#if src(urlOf(el))}<img src={src(urlOf(el))} alt="" draggable="false" />{/if}
          {:else if el.type === 'video'}
            {#if src(urlOf(el))}
              <video src={src(urlOf(el))} autoplay loop muted playsinline></video>
            {/if}
          {:else if el.type === 'text' || el.type === 'note'}
            {#if editingId === el.id}
              <div
                class="body editing"
                data-editing
                data-placeholder={placeholder(el)}
                use:editable_={el}
                onblur={(e) => finishEdit(e.currentTarget)}
                onkeydown={editKeydown}
                onpaste={editPaste}
              ></div>
            {:else if el.text}
              <div class="body">{@html inlineMarkdown(el.text)}</div>
            {:else}
              <div class="body empty">{placeholder(el)}</div>
            {/if}
            {#if el.type === 'note'}
              <div class="foot">{el.name}</div>
            {/if}
          {:else if el.type === 'tile'}
            <div class="project-card-image">
              {#if el.cover && src(el.cover)}
                <img src={src(el.cover)} alt="" draggable="false" onerror={(e) => (e.currentTarget.style.visibility = 'hidden')} />
              {/if}
            </div>
            <h3 class="project-card-title">{el.title}</h3>
            <p class="project-card-author">{el.student}</p>
            {#if el.gallery_text}<p class="gallery-text">{el.gallery_text}</p>{/if}
            {#if el.href}
              <a class="tile-link" href={el.href} target="_blank" rel="noopener" draggable="false">Open in Student Work</a>
            {/if}
          {/if}
          {#if editable && el.locked}<span class="pill">locked</span>{/if}
          {#if editable && !el.locked && el.type !== 'tile' && selected.includes(el.id)}
            <span class="handle" data-handle></span>
          {/if}
        </div>
      {/each}

      {#each Object.entries(pending) as [id, b] (id)}
        <div class="el uploading" style="left: {b.x}px; top: {b.y}px; width: {b.w}px; height: {b.h}px">
          <span>Uploading…</span>
        </div>
      {/each}

      {#if marquee}
        <div
          class="marquee"
          style="left: {Math.min(marquee.x0, marquee.x1)}px; top: {Math.min(marquee.y0, marquee.y1)}px; width: {Math.abs(marquee.x1 - marquee.x0)}px; height: {Math.abs(marquee.y1 - marquee.y0)}px"
        ></div>
      {/if}
    </div>

    {#if editable && fine}
      <canvas class="cursors" bind:this={canvasEl} aria-hidden="true"></canvas>
    {/if}
  </div>

  {#if !editable}
    <p class="banner">Frozen at the end of the semester.</p>
  {:else if status === 'reconnecting'}
    <p class="banner">Reconnecting…</p>
  {:else if showHint}
    <p class="banner hint">Double-click to add something. Drop an image anywhere. Scroll to zoom. Right-click or shift and drag to move around.</p>
  {/if}

  {#if editable && bbox && !editingId && !moving}
    <div
      class="toolbar"
      style="left: {Math.max(8, bbox.x0 * view.k + view.x)}px; top: {Math.max(8, bbox.y0 * view.k + view.y - 40)}px"
    >
      <span class="count">{selEls.length} selected</span>
      {#if anyLocked}
        <button type="button" onclick={() => setLocked(false)}>unlock</button>
      {:else}
        <button type="button" onclick={() => setLocked(true)}>lock</button>
        <button type="button" onclick={removeSelected}>delete</button>
        {#if selEls.length === 1 && selEls[0].type === 'text'}
          {#if selEls[0].size === 'large'}
            <button type="button" onclick={() => setSize('normal')}>normal</button>
          {:else}
            <button type="button" onclick={() => setSize('large')}>large</button>
          {/if}
        {/if}
      {/if}
    </div>
  {/if}

  {#if menu}
    <div class="menu" style="left: {menu.sx}px; top: {menu.sy}px" role="menu">
      <button type="button" role="menuitem" onclick={() => pick('image')}>Image</button>
      <button type="button" role="menuitem" onclick={() => pick('text')}>Text</button>
      <button type="button" role="menuitem" onclick={() => pick('note')}>Note</button>
    </div>
  {/if}

  {#if toast}
    <div class="toast" role="status">
      <span>{toast.text}</span>
      {#if toast.undo}<button type="button" onclick={undo}>undo</button>{/if}
    </div>
  {/if}

  {#if editable}
    <input
      class="files"
      type="file"
      multiple
      accept={UPLOAD_EXT.map((x) => '.' + x).join(',')}
      bind:this={fileInput}
      onchange={chooseFiles}
    />
  {/if}
</div>

<style>
  .wrap { position: relative; width: 100%; height: 100%; overflow: hidden; }
  .board {
    position: absolute; inset: 0; overflow: hidden;
    background-color: var(--bg);
    background-image: radial-gradient(var(--rule) 1px, transparent 1px);
    touch-action: none; user-select: none; -webkit-user-select: none;
    outline: none;
  }
  .board.grab { cursor: grab; }
  .board.panning { cursor: grabbing; }
  .stage { position: absolute; left: 0; top: 0; transform-origin: 0 0; }

  .el { position: absolute; box-sizing: border-box; }
  .board.edit .el:hover { outline: calc(1px / var(--k)) solid var(--rule); }
  .board.edit .el.selected { outline: calc(2px / var(--k)) solid var(--hi); }

  .el img, .el video { display: block; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }

  .body { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.5; outline: none; min-height: 1.5em; }
  .body :global(a) { color: inherit; }
  .text .body { color: var(--fg); font-size: 0.9rem; }
  .text.large .body { font-size: 1.6rem; }
  .body.empty, .body.editing:empty::before { opacity: 0.55; }
  .body.editing:empty::before { content: attr(data-placeholder); }
  .body.editing { user-select: text; -webkit-user-select: text; cursor: text; }

  .note {
    display: flex; flex-direction: column;
    background: var(--hi); color: var(--hi-fg); font-size: 0.8rem; padding: 0.75rem;
    border: 1px solid color-mix(in srgb, var(--hi-fg) 25%, transparent);
  }
  .note .body { flex: 1; overflow: auto; }
  .note .foot { font-size: 0.62rem; margin-top: 0.4rem; }

  .tile .project-card-image { margin-bottom: 0.6rem; }
  .tile .project-card-image img { object-fit: cover; }
  .tile .project-card-title { display: block; margin: 0 0 0.2rem; }
  .tile .project-card-author { margin: 0 0 0.5rem; }
  .tile .gallery-text { font-size: 0.8rem; line-height: 1.5; margin: 0 0 0.5rem; }
  .tile-link { font-size: 0.8rem; color: var(--fg); }
  .tile-link:hover { background: var(--hi); color: var(--hi-fg); }

  .pill {
    display: none; position: absolute; right: 0; top: 0; transform: translateY(-100%);
    transform-origin: 100% 100%;
    font-size: calc(0.62rem / var(--k)); padding: 0 calc(0.4rem / var(--k));
    background: var(--hi); color: var(--hi-fg); border-radius: calc(20px / var(--k)); white-space: nowrap;
  }
  .el.locked:hover .pill { display: block; }
  .handle {
    position: absolute; right: calc(-6px / var(--k)); bottom: calc(-6px / var(--k));
    width: calc(12px / var(--k)); height: calc(12px / var(--k));
    background: var(--hi); cursor: nwse-resize;
  }
  .uploading {
    background: var(--code-bg); display: flex; align-items: center; justify-content: center;
    font-size: calc(0.8rem / var(--k)); color: var(--fg-dim);
  }
  .marquee {
    position: absolute; pointer-events: none;
    border: calc(1px / var(--k)) solid var(--hi);
    background: color-mix(in srgb, var(--hi) 10%, transparent);
    z-index: 2147483000;
  }
  .cursors { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }

  .banner {
    position: absolute; top: 0.75rem; left: 50%; transform: translateX(-50%);
    margin: 0; padding: 0.3rem 0.8rem; font-size: 0.72rem; white-space: nowrap;
    background: var(--hi); color: var(--hi-fg); border-radius: 40px; pointer-events: none;
  }

  .banner.hint { background: var(--code-bg); color: var(--fg); white-space: normal; text-align: center; width: max-content; max-width: calc(100% - 2rem); }

  .toolbar, .menu, .toast {
    position: absolute; z-index: 10;
    background: var(--bg); color: var(--fg); border: 1px solid var(--rule);
    font-size: 0.72rem;
  }
  .toolbar { display: flex; align-items: center; gap: 0.25rem; padding: 0.2rem 0.4rem; white-space: nowrap; }
  .count { color: var(--fg-dim); margin-right: 0.3rem; }
  .menu { display: flex; flex-direction: column; padding: 0.2rem 0; min-width: 7rem; }
  .toast {
    left: 50%; bottom: 1.25rem; transform: translateX(-50%);
    display: flex; align-items: center; gap: 0.75rem; padding: 0.45rem 0.9rem;
  }
  .toolbar button, .menu button, .toast button {
    font: inherit; background: none; border: 0; color: var(--fg); cursor: pointer;
    padding: 0.25rem 0.5rem; text-align: left;
  }
  .toolbar button, .toast button { text-decoration: underline; }
  .toolbar button:hover, .menu button:hover, .toast button:hover { background: var(--hi); color: var(--hi-fg); }
  .files { display: none; }
</style>
