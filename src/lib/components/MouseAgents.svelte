<script>
  // A small simulation that runs on top of every reading page: N cursor arrows
  // that steer toward the real pointer and bounce off the course content.
  // It is a nod to the course, not an argument, so it stays cheap and it stays
  // out of the way - no pointer events, off on touch and narrow screens, off
  // under prefers-reduced-motion, off inside a sandbox where the map owns the
  // pointer, and off entirely behind a text switch.
  //
  // The cost rules it is written to:
  //   - one canvas, one requestAnimationFrame loop, a fixed 30 fps step;
  //   - nothing allocates inside the loop (every array is typed and preallocated);
  //   - obstacles are axis-aligned boxes bucketed into a 200px grid, collected
  //     on load, on resize and on scroll end, never per frame.
  import { page } from '$app/state';
  import { MODE } from '$lib/data.js';

  const MAX_AGENTS = 60;
  const AGENTS_PER_PERSON = 3;
  const FALLBACK_AGENTS = 3; // archive mode, or the count fetch failing
  const STEP = 1 / 30; // seconds; the loop skips frames rather than running faster
  const MAX_SPEED = 180; // px/s
  const MAX_TURN = 4 * STEP; // rad per step
  const ARRIVE_RADIUS = 80; // px; they gather rather than pile on
  const SEPARATION = 22; // px
  const HEADING_GAIN = 0.1; // eases back to pointing at the pointer in about a second
  const IDLE_MS = 20_000;
  const BEACON_MS = 30_000;
  const CELL = 200; // obstacle grid
  const ARROW = 12; // px
  const STORAGE_KEY = 'smt.agents';

  const OBSTACLE_SELECTOR =
    'p, h1, h2, h3, h4, li, table, img, pre, blockquote, .project-card, .content-list-item';

  let canvas = $state(null);
  let on = $state(true);

  // A sandbox owns the pointer, so the agents never run there. `/sandboxes/`
  // itself is a reading page; `/sandboxes/<slug>/` is not.
  const inSandbox = $derived(/^\/sandboxes\/[^/]+\/?$/.test(page.url.pathname));

  function readSwitch() {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch {
      return true;
    }
  }

  function writeSwitch(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off');
    } catch {
      // Private windows and blocked site data: the switch just does not persist.
    }
  }

  function sessionId() {
    try {
      let id = sessionStorage.getItem('smt.presence');
      if (!id) {
        id = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        sessionStorage.setItem('smt.presence', id);
      }
      return id;
    } catch {
      return Math.random().toString(36).slice(2, 14);
    }
  }

  // ---------------------------------------------------------------- state --
  // Preallocated at MAX_AGENTS; `count` says how many are live.
  const xs = new Float32Array(MAX_AGENTS);
  const ys = new Float32Array(MAX_AGENTS);
  const vxs = new Float32Array(MAX_AGENTS);
  const vys = new Float32Array(MAX_AGENTS);
  const hs = new Float32Array(MAX_AGENTS);
  let count = 0;

  // Obstacles in PAGE coordinates, four floats each, plus a CSR bucket index.
  let obs = new Float32Array(0);
  let obsCount = 0;
  let gridStart = new Int32Array(0);
  let gridItems = new Int32Array(0);
  let gridCursor = new Int32Array(0);
  let gridW = 0;
  let gridH = 0;

  let pointerX = 0;
  let pointerY = 0;
  let pointerIn = false;
  let lastMove = 0;
  let raf = 0;
  let acc = 0;
  let last = 0;
  let dpr = 1;
  let arrowColor = '#00ff00';

  // Cheap self-measurement, read by scripts/agent-frame-time.js.
  let frameMsTotal = 0;
  let frameMsCount = 0;

  // ------------------------------------------------------------ obstacles --
  function collectObstacles() {
    const main = document.querySelector('main');
    if (!main) return;
    const nodes = main.querySelectorAll(OBSTACLE_SELECTOR);
    if (obs.length < nodes.length * 4) obs = new Float32Array(nodes.length * 4);
    const sx = window.scrollX;
    const sy = window.scrollY;
    let n = 0;
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      obs[n * 4] = r.left + sx;
      obs[n * 4 + 1] = r.top + sy;
      obs[n * 4 + 2] = r.right + sx;
      obs[n * 4 + 3] = r.bottom + sy;
      n++;
    }
    obsCount = n;
    buildGrid();
  }

  // One pass to count per cell, one to fill: a CSR index, so the per-frame
  // lookup is two integer reads and a walk of a flat array. An obstacle is
  // registered in every cell it overlaps, so the lookup only ever has to look
  // at the agent's own cell.
  function buildGrid() {
    const doc = document.documentElement;
    gridW = Math.max(1, Math.ceil(Math.max(doc.scrollWidth, window.innerWidth) / CELL));
    gridH = Math.max(1, Math.ceil(Math.max(doc.scrollHeight, window.innerHeight) / CELL));
    const cells = gridW * gridH;
    if (gridStart.length < cells + 1) gridStart = new Int32Array(cells + 1);
    if (gridCursor.length < cells) gridCursor = new Int32Array(cells);
    gridStart.fill(0, 0, cells + 1);

    // Counts land at c+1, so the prefix sum turns them into start offsets in
    // place and gridStart[cells] ends up as the total.
    let total = 0;
    for (let i = 0; i < obsCount; i++) {
      const o = i * 4;
      const cx0 = clampCell(obs[o] / CELL, gridW);
      const cy0 = clampCell(obs[o + 1] / CELL, gridH);
      const cx1 = clampCell(obs[o + 2] / CELL, gridW);
      const cy1 = clampCell(obs[o + 3] / CELL, gridH);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          gridStart[cy * gridW + cx + 1]++;
          total++;
        }
      }
    }
    for (let c = 1; c <= cells; c++) gridStart[c] += gridStart[c - 1];
    if (gridItems.length < total) gridItems = new Int32Array(total);
    gridCursor.set(gridStart.subarray(0, cells));

    for (let i = 0; i < obsCount; i++) {
      const o = i * 4;
      const cx0 = clampCell(obs[o] / CELL, gridW);
      const cy0 = clampCell(obs[o + 1] / CELL, gridH);
      const cx1 = clampCell(obs[o + 2] / CELL, gridW);
      const cy1 = clampCell(obs[o + 3] / CELL, gridH);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          gridItems[gridCursor[cy * gridW + cx]++] = i;
        }
      }
    }
  }

  function clampCell(v, n) {
    const c = Math.floor(v);
    return c < 0 ? 0 : c > n - 1 ? n - 1 : c;
  }

  // ---------------------------------------------------------------- agents --
  function setCount(n) {
    const next = Math.max(1, Math.min(MAX_AGENTS, n));
    for (let i = count; i < next; i++) {
      xs[i] = Math.random() * window.innerWidth;
      ys[i] = Math.random() * window.innerHeight;
      vxs[i] = 0;
      vys[i] = 0;
      hs[i] = Math.random() * Math.PI * 2;
    }
    count = next;
  }

  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function step(seeking) {
    const sx = window.scrollX;
    const sy = window.scrollY;
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (let i = 0; i < count; i++) {
      let ax = 0;
      let ay = 0;

      if (seeking) {
        const dx = pointerX - xs[i];
        const dy = pointerY - ys[i];
        const d = Math.hypot(dx, dy) || 1;
        // Arrival: full speed outside the radius, tapering to nothing inside it.
        const want = d < ARRIVE_RADIUS ? MAX_SPEED * (d / ARRIVE_RADIUS) : MAX_SPEED;
        ax += ((dx / d) * want - vxs[i]) * 2.5;
        ay += ((dy / d) * want - vys[i]) * 2.5;
      } else {
        ax -= vxs[i] * 2.0;
        ay -= vys[i] * 2.0;
      }

      // Separation. O(N^2) at N = 60 is 3,600 pairs, which is nothing.
      for (let j = 0; j < count; j++) {
        if (j === i) continue;
        const dx = xs[i] - xs[j];
        const dy = ys[i] - ys[j];
        const d2 = dx * dx + dy * dy;
        if (d2 > SEPARATION * SEPARATION || d2 === 0) continue;
        const d = Math.sqrt(d2);
        ax += (dx / d) * (SEPARATION - d) * 12;
        ay += (dy / d) * (SEPARATION - d) * 12;
      }

      vxs[i] += ax * STEP;
      vys[i] += ay * STEP;
      const sp = Math.hypot(vxs[i], vys[i]);
      if (sp > MAX_SPEED) {
        vxs[i] = (vxs[i] / sp) * MAX_SPEED;
        vys[i] = (vys[i] / sp) * MAX_SPEED;
      }
      xs[i] += vxs[i] * STEP;
      ys[i] += vys[i] * STEP;

      // The window edges bounce too, so nothing wanders off screen.
      if (xs[i] < 0) { xs[i] = 0; vxs[i] = -vxs[i]; }
      if (xs[i] > w) { xs[i] = w; vxs[i] = -vxs[i]; }
      if (ys[i] < 0) { ys[i] = 0; vys[i] = -vys[i]; }
      if (ys[i] > h) { ys[i] = h; vys[i] = -vys[i]; }

      // Content. One cell lookup, then one rectangle test per obstacle in it.
      const px = xs[i] + sx;
      const py = ys[i] + sy;
      const cx = Math.floor(px / CELL);
      const cy = Math.floor(py / CELL);
      let bounced = false;
      if (cx >= 0 && cy >= 0 && cx < gridW && cy < gridH) {
        const c = cy * gridW + cx;
        for (let k = gridStart[c]; k < gridStart[c + 1]; k++) {
          const o = gridItems[k] * 4;
          const x0 = obs[o];
          const y0 = obs[o + 1];
          const x1 = obs[o + 2];
          const y1 = obs[o + 3];
          if (px < x0 || px > x1 || py < y0 || py > y1) continue;
          // Inside: push out on the shallowest axis and reflect on it.
          const left = px - x0;
          const right = x1 - px;
          const top = py - y0;
          const bottom = y1 - py;
          const m = Math.min(left, right, top, bottom);
          if (m === left) { xs[i] = x0 - sx - 1; vxs[i] = -Math.abs(vxs[i]); }
          else if (m === right) { xs[i] = x1 - sx + 1; vxs[i] = Math.abs(vxs[i]); }
          else if (m === top) { ys[i] = y0 - sy - 1; vys[i] = -Math.abs(vys[i]); }
          else { ys[i] = y1 - sy + 1; vys[i] = Math.abs(vys[i]); }
          bounced = true;
          break;
        }
      }

      if (bounced) {
        // The heading takes the bounce...
        hs[i] = Math.atan2(vys[i], vxs[i]);
      } else {
        // ...and then eases back to pointing at the pointer over about a second.
        const target = Math.atan2(pointerY - ys[i], pointerX - xs[i]);
        let turn = wrapAngle(target - hs[i]) * HEADING_GAIN;
        if (turn > MAX_TURN) turn = MAX_TURN;
        else if (turn < -MAX_TURN) turn = -MAX_TURN;
        hs[i] = wrapAngle(hs[i] + turn);
      }
    }
  }

  function draw(ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.fillStyle = arrowColor;
    for (let i = 0; i < count; i++) {
      ctx.save();
      ctx.translate(xs[i], ys[i]);
      ctx.rotate(hs[i]);
      // A cursor arrow, drawn nose-first along +x so the rotation is the heading.
      ctx.beginPath();
      ctx.moveTo(ARROW * 0.6, 0);
      ctx.lineTo(-ARROW * 0.4, ARROW * 0.34);
      ctx.lineTo(-ARROW * 0.18, 0);
      ctx.lineTo(-ARROW * 0.4, -ARROW * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }

  // ------------------------------------------------------------------ loop --
  $effect(() => {
    if (!canvas || inSandbox || !on) return;

    const fine = window.matchMedia('(pointer: fine) and (min-width: 900px)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || calm.matches) return;

    const ctx = canvas.getContext('2d');
    arrowColor =
      getComputedStyle(document.documentElement).getPropertyValue('--hi').trim() || '#00ff00';

    resize();
    collectObstacles();
    setCount(FALLBACK_AGENTS);
    pointerX = window.innerWidth / 2;
    pointerY = window.innerHeight / 2;

    let scrollTimer = 0;
    const onScroll = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(collectObstacles, 150);
    };
    const onResize = () => {
      resize();
      collectObstacles();
    };
    const onMove = (e) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
      pointerIn = true;
      lastMove = performance.now();
      start();
    };
    const onLeave = () => {
      pointerIn = false;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    function frame(now) {
      raf = requestAnimationFrame(frame);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25; // a backgrounded tab returning
      acc += dt;
      if (acc < STEP) return; // 30 fps: skip the frames in between

      const t0 = performance.now();
      const idle = now - lastMove > IDLE_MS;
      const seeking = pointerIn && !idle;
      let steps = 0;
      while (acc >= STEP && steps < 3) {
        step(seeking);
        acc -= STEP;
        steps++;
      }
      draw(ctx);
      frameMsTotal += performance.now() - t0;
      frameMsCount++;

      // Not seeking and effectively stopped: park the loop until the pointer
      // moves again. This is what "drift to a stop" means.
      if (!seeking) {
        let moving = false;
        for (let i = 0; i < count; i++) {
          if (Math.abs(vxs[i]) + Math.abs(vys[i]) > 2) { moving = true; break; }
        }
        if (!moving) stop();
      }
    }

    function start() {
      if (raf || document.hidden) return;
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVisibility);

    // How many. Three per person on the site, capped at sixty; three if there
    // is no server to ask, which is every archive build.
    let beacon = 0;
    if (MODE !== 'archive') {
      const id = sessionId();
      const ping = async () => {
        try {
          const res = await fetch('/api/presence', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id })
          });
          const { count: people } = await res.json();
          setCount(AGENTS_PER_PERSON * Math.max(1, people | 0));
        } catch {
          setCount(FALLBACK_AGENTS);
        }
      };
      ping();
      beacon = setInterval(ping, BEACON_MS);
    }

    // Exposed for scripts/agent-frame-time.js, which is how the number in the
    // build notes was measured.
    window.__agentFrameMs = () => ({
      agents: count,
      obstacles: obsCount,
      frames: frameMsCount,
      mean: frameMsCount ? frameMsTotal / frameMsCount : 0
    });

    start();
    return () => {
      stop();
      clearInterval(beacon);
      clearTimeout(scrollTimer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      delete window.__agentFrameMs;
    };
  });

  $effect(() => {
    on = readSwitch();
  });

  function toggle() {
    on = !on;
    writeSwitch(on);
  }
</script>

{#if !inSandbox}
  {#if on}
    <canvas bind:this={canvas} class="agents" aria-hidden="true"></canvas>
  {/if}
  <button class="switch" type="button" onclick={toggle}>agents {on ? 'off' : 'on'}</button>
{/if}

<style>
  .agents {
    position: fixed;
    inset: 0;
    z-index: 800; /* above the content, below the nav pill (1000) */
    pointer-events: none;
  }
  .switch {
    position: fixed;
    left: 0.75rem;
    bottom: 0.75rem;
    z-index: 900;
    font: inherit;
    font-size: 0.62rem;
    background: none;
    border: 0;
    padding: 0.2rem 0.3rem;
    color: var(--fg-dim);
    cursor: pointer;
  }
  .switch:hover {
    background: var(--hi);
    color: var(--hi-fg);
  }
</style>
