<script>
  // Sandbox 04 - Anthromes.
  //
  // The published anthromes classification is a cascade of about a dozen hard
  // thresholds applied to six continuous input grids. Here the cascade runs
  // in the browser, every threshold is a slider, and the map is the result of
  // the reader's own cascade rather than the published one. Two reference
  // layers ride along: the same method at native resolution (the resolution
  // effect) and HYDE 3.5's published series (the version effect), and the
  // disagreement between them is the point, not an error.
  //
  // The contract, as bathtub sets it out:
  //   props in : params, assets, mode ('edit' | 'view'), dataBase
  //   props in : onmetrics(obj), onready(bool), ontransport(adapter)
  //   never    : this component does not touch window.__metrics or
  //              data-cover-ready. It reports; the frame publishes.
  //
  // Plain canvas, no basemap - the data is the map. Drawn equirectangular
  // because the grid is equirectangular; that badly exaggerates the high
  // latitudes, where most of what the cascade calls wild lives, so every
  // area statistic is computed with the real per-cell land area instead.
  // The picture is distorted; the numbers are not. Both facts are on the
  // card and in the legend.
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { CLASS_NAMES, USED_CODES, DENS_LUT, classifyYear, decodeSparse, sparseOffsets }
    from './cascade.js';
  import MetricsWorker from './metrics.worker.js?worker';

  let { params, assets = {}, mode = 'edit', dataBase, onmetrics, onready } = $props();

  const view = $derived(mode === 'view');

  let stageEl = $state(null);
  let displayCanvas = $state(null);
  let error = $state(null);
  let loading = $state('reading ten thousand years…');
  let manifest = $state(null);
  let hover = $state(null);
  let ledger = $state(null);
  let ledgerStale = $state(true);

  const W = 1200, H = 600;
  let D = null;          // all decoded planes
  let buf = null;        // offscreen 1200x600
  let bufCtx = null;
  let img = null;        // ImageData
  let worker = null;
  let workerReady = false;
  let ledgerGen = 0;
  let ledgerTimer = 0;
  let announced = false;
  let yearCodes = null;  // current classification, per land cell
  let denseRice = null, denseIrr = null, denseUrb = null;

  // The palette, by class family: settlements dark red, villages plum,
  // croplands yellow, rangelands orange-brown, woodlands green, drylands
  // tan, wild muted, ice near-white. A colour choice, not a datum.
  const PALETTE = {
    11: [122, 32, 28], 12: [176, 74, 60],
    21: [147, 58, 120], 22: [170, 84, 140], 23: [193, 112, 160], 24: [160, 96, 128],
    31: [188, 150, 40], 32: [208, 174, 66], 33: [222, 196, 104], 34: [234, 217, 150],
    41: [176, 110, 46], 42: [200, 140, 82], 43: [218, 172, 122],
    51: [78, 122, 68], 52: [110, 146, 94], 53: [144, 172, 124],
    54: [202, 186, 152],
    61: [56, 88, 60], 62: [188, 188, 174], 63: [234, 240, 244],
    70: [244, 244, 242]
  };
  const OCEAN = [216, 222, 226];

  const FAMILIES = [
    ['settlements', [11, 12]],
    ['villages', [21, 22, 23, 24]],
    ['croplands', [31, 32, 33, 34]],
    ['rangelands', [41, 42, 43]],
    ['semi-natural', [51, 52, 53, 54]],
    ['wild', [61, 62, 63]]
  ];

  const yearIndex = $derived(manifest ? manifest.years.indexOf(params.year) : -1);

  function thresholds() {
    return {
      urban_fraction_threshold: params.urban_fraction_threshold ?? 0.2,
      urban_density: params.urban_density ?? 2500,
      dense_settlement_density: params.dense_settlement_density ?? 100,
      residential_density: params.residential_density ?? 10,
      populated_density: params.populated_density ?? 1,
      wild_density: 0.0001,
      crops_threshold: params.crops_threshold ?? 0.2,
      grazing_threshold: params.grazing_threshold ?? 0.2,
      rice_threshold: params.rice_threshold ?? 0.2,
      irrigation_threshold: params.irrigation_threshold ?? 0.2,
      used_threshold: params.used_threshold ?? 0.2,
      tree_biomes: params.tree_biomes ?? 8
    };
  }

  async function boot() {
    try {
      const bin = (f) => fetch(`${dataBase}/${f}`).then((r) => {
        if (!r.ok) throw new Error(`${f}: ${r.status}. Run data/scripts/anthromes.py.`);
        return r.arrayBuffer();
      });
      const [m, maskB, popdB, cropB, grazB, riceB, irrB, urbB, m32B, h35B, statB] =
        await Promise.all([
          fetch(`${dataBase}/manifest.json`).then((r) => r.json()),
          bin('mask.bin'), bin('popd.bin'), bin('cropland.bin'), bin('grazing.bin'),
          bin('rice.bin'), bin('irrigation.bin'), bin('urban.bin'),
          bin('method32.bin'), bin('hyde35.bin'), bin('statics.bin')
        ]);
      manifest = m;
      const nLand = m.grid.nLand;
      const nY = m.years.length;
      const mask = new Uint8Array(maskB);
      // land cell -> pixel index, and per-cell true land area in km2
      const landIdx = new Uint32Array(nLand);
      let k = 0;
      for (let i = 0; i < W * H; i++) if (mask[i]) landIdx[k++] = i;
      if (k !== nLand) throw new Error(`mask has ${k} land cells, manifest says ${nLand}`);
      const statics = new Uint8Array(statB);
      const landKm2 = new Float32Array(nLand);
      const R = 6371.0088;
      const res = (0.30 * Math.PI) / 180;
      for (let i = 0; i < nLand; i++) {
        const row = Math.floor(landIdx[i] / W);
        const latN = ((m.grid.originY - 0.30 * row) * Math.PI) / 180;
        const band = R * R * res * (Math.sin(latN) - Math.sin(latN - res));
        landKm2[i] = band * (statics[2 * nLand + i] / 255);
      }
      D = {
        nLand, nY, landIdx, landKm2,
        popd: new Uint8Array(popdB),
        crop: new Uint8Array(cropB),
        graz: new Uint8Array(grazB),
        rice: riceB, irr: irrB, urb: urbB,
        riceOff: sparseOffsets(riceB, nY),
        irrOff: sparseOffsets(irrB, nY),
        urbOff: sparseOffsets(urbB, nY),
        potveg: new Uint8Array(statB, 0, nLand),
        potvill: new Uint8Array(statB, nLand, nLand),
        fracLand: new Uint8Array(statB, 2 * nLand, nLand),
        method32: new Uint8Array(m32B),
        hyde35: new Uint8Array(h35B),
        hyde35Years: m.hyde35_years ?? null
      };
      yearCodes = new Uint8Array(nLand);
      denseRice = new Uint8Array(nLand);
      denseIrr = new Uint8Array(nLand);
      denseUrb = new Uint8Array(nLand);
      buf = document.createElement('canvas');
      buf.width = W; buf.height = H;
      bufCtx = buf.getContext('2d');
      img = bufCtx.createImageData(W, H);
      // the ocean, once
      const px = img.data;
      for (let i = 0; i < W * H; i++) {
        const o = i * 4;
        px[o] = OCEAN[0]; px[o + 1] = OCEAN[1]; px[o + 2] = OCEAN[2]; px[o + 3] = 255;
      }

      if (!view) {
        worker = new MetricsWorker();
        worker.onmessage = (e) => {
          if (e.data.type === 'ready') { workerReady = true; requestLedger(); return; }
          if (e.data.type !== 'ledger' || e.data.gen !== ledgerGen) return;
          ledger = e.data;
          ledgerStale = false;
          render();
        };
        worker.postMessage({
          type: 'init', nLand, years: m.years,
          popd: popdB.slice(0), crop: cropB.slice(0), graz: grazB.slice(0),
          rice: riceB.slice(0), irr: irrB.slice(0), urb: urbB.slice(0),
          statics: statB.slice(0), landKm2: landKm2.buffer.slice(0),
          method32: m32B.slice(0)
        });
      }
      loading = null;
      render();
    } catch (err) {
      error = String(err?.message ?? err);
      onready?.(true); // never hang the cover pipeline on a data failure
    }
  }

  function requestLedger() {
    if (!worker || !workerReady) return;
    ledgerStale = true;
    clearTimeout(ledgerTimer);
    ledgerTimer = setTimeout(() => {
      ledgerGen += 1;
      worker.postMessage({ type: 'ledger', gen: ledgerGen, params: thresholds() });
    }, 250);
  }

  function render() {
    if (!D || yearIndex < 0 || !displayCanvas) return;
    const { nLand, landIdx } = D;
    const y = yearIndex;
    const popd = D.popd.subarray(y * nLand, (y + 1) * nLand);
    const crop = D.crop.subarray(y * nLand, (y + 1) * nLand);
    const graz = D.graz.subarray(y * nLand, (y + 1) * nLand);
    decodeSparse(D.rice, D.riceOff, y, denseRice);
    decodeSparse(D.irr, D.irrOff, y, denseIrr);
    decodeSparse(D.urb, D.urbOff, y, denseUrb);
    classifyYear(yearCodes, popd, crop, graz, denseRice, denseIrr, denseUrb,
                 D.potveg, D.potvill, thresholds(), D.fracLand);

    const px = img.data;
    const mode_ = params.colour_by ?? 'anthrome';
    const m32 = D.method32.subarray(y * nLand, (y + 1) * nLand);
    let usedArea = 0, wildArea = 0, totalArea = 0, agreeArea = 0;
    for (let i = 0; i < nLand; i++) {
      const o = landIdx[i] * 4;
      const c = yearCodes[i];
      let r, g, b;
      if (mode_ === 'used') {
        const t = Math.min(1, (crop[i] + graz[i] + denseUrb[i]) / 255);
        r = 245 - 160 * t; g = 240 - 195 * t; b = 232 - 200 * t;
      } else if (mode_ === 'density') {
        const t = popd[i] / 255;
        r = 245 - 190 * t; g = 243 - 165 * t; b = 235 - 90 * t;
      } else if (mode_ === 'disagreement') {
        if (c === m32[i]) { r = 236; g = 234; b = 228; }
        else { r = 170; g = 45; b = 32; }
      } else {
        const p = PALETTE[c] ?? [255, 0, 255];
        r = p[0]; g = p[1]; b = p[2];
      }
      px[o] = r; px[o + 1] = g; px[o + 2] = b;
      const a = D.landKm2[i];
      totalArea += a;
      if (USED_CODES.has(c)) usedArea += a;
      else if (c >= 61 && c <= 63) wildArea += a;
      if (c === m32[i]) agreeArea += a;
    }
    bufCtx.putImageData(img, 0, 0);
    blit();

    const fmtPct = (v) => `${(100 * v).toFixed(1)}%`;
    onmetrics?.({
      'the crossover, when used land first exceeds wild':
        ledger && !ledgerStale
          ? (ledger.crossoverYear ?? 'never, under these thresholds')
          : (ledger ? `${ledger.crossoverYear ?? 'never'} (recomputing…)` : '…'),
      [`used land, ${params.year}`]: fmtPct(usedArea / totalArea),
      [`wild land, ${params.year}`]: fmtPct(wildArea / totalArea),
      'agreement with the published method at native resolution':
        fmtPct(agreeArea / totalArea),
      'land cells classified': nLand.toLocaleString()
    });
    if (!announced) { announced = true; onready?.(true); }
  }

  function blit() {
    if (!displayCanvas || !buf || !stageEl) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = stageEl.clientWidth, ch = stageEl.clientHeight;
    if (displayCanvas.width !== Math.round(cw * dpr)) {
      displayCanvas.width = Math.round(cw * dpr);
      displayCanvas.height = Math.round(ch * dpr);
    }
    const ctx = displayCanvas.getContext('2d');
    const scale = Math.min(cw / W, ch / H);
    const dw = W * scale, dh = H * scale;
    const ox = (cw - dw) / 2, oy = (ch - dh) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#eceef0';
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, ox, oy, dw, dh);
    displayCanvas.__fit = { scale, ox, oy };
  }

  // The tractid.png picking trick from Bathtub, one dimension simpler: the
  // grid is regular, so the pixel inverts to a cell index arithmetically.
  function onMove(e) {
    if (!D || !displayCanvas?.__fit) return;
    const { scale, ox, oy } = displayCanvas.__fit;
    const rect = displayCanvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left - ox) / scale);
    const yy = Math.floor((e.clientY - rect.top - oy) / scale);
    if (x < 0 || x >= W || yy < 0 || yy >= H) { hover = null; return; }
    const pix = yy * W + x;
    // land cell? binary search landIdx
    let lo = 0, hi = D.nLand - 1, found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (D.landIdx[mid] === pix) { found = mid; break; }
      if (D.landIdx[mid] < pix) lo = mid + 1; else hi = mid - 1;
    }
    if (found < 0) { hover = null; return; }
    const i = found;
    const y = yearIndex;
    const nL = D.nLand;
    const q = D.popd[y * nL + i];
    const h35 = hyde35At(i);
    hover = {
      x: e.clientX - rect.left, y: e.clientY - rect.top,
      ours: CLASS_NAMES[yearCodes[i]],
      m32: CLASS_NAMES[D.method32[y * nL + i]] ?? '—',
      h35: h35 == null ? 'no 3.5 step for this year' : (CLASS_NAMES[h35] ?? '—'),
      dens: q === 0 ? '0' : DENS_LUT[q].toPrecision(2),
      crop: Math.round((D.crop[y * nL + i] / 255) * 100),
      graz: Math.round((D.graz[y * nL + i] / 255) * 100),
      urb: Math.round((denseUrb[i] / 255) * 100),
      potveg: manifest.potential_vegetation?.[String(D.potveg[i])] ?? `class ${D.potveg[i]}`,
      firstUsed: ledger && !ledgerStale && ledger.firstUsedYear[i] >= 0
        ? manifest.years[ledger.firstUsedYear[i]] : null
    };
  }

  function hyde35At(i) {
    // 3.5's year list is not ours - it has 1995 and 2018-2025, we have the
    // annual 2000s. Match by label; no match, no claim.
    const ys = D.hyde35Years;
    if (!ys) return null;
    const j = ys.indexOf(params.year);
    if (j < 0) return null;
    return D.hyde35[j * D.nLand + i];
  }

  $effect(() => {
    if (browser && displayCanvas && !D && !error) boot();
  });

  // The year and the drawing mode are the light path; the thresholds also
  // wake the worker for the all-years ledger, debounced.
  $effect(() => {
    void [params.year, params.colour_by];
    if (D) render();
  });
  $effect(() => {
    void [params.used_threshold, params.crops_threshold, params.grazing_threshold,
          params.rice_threshold, params.irrigation_threshold,
          params.urban_fraction_threshold, params.urban_density,
          params.dense_settlement_density, params.residential_density,
          params.populated_density, params.tree_biomes];
    if (D) {
      render();
      requestLedger();
    }
  });

  $effect(() => {
    if (view || !stageEl) return;
    const ro = new ResizeObserver(() => blit());
    ro.observe(stageEl);
    return () => ro.disconnect();
  });

  onDestroy(() => {
    clearTimeout(ledgerTimer);
    worker?.terminate();
  });
</script>

<div class="wrap" class:view>
  <div class="stage" bind:this={stageEl}>
    <canvas
      bind:this={displayCanvas}
      onpointermove={onMove}
      onpointerleave={() => (hover = null)}
    ></canvas>

    {#if hover}
      <div class="tip" style="left:{Math.min(hover.x + 14, stageEl.clientWidth - 240)}px; top:{Math.min(hover.y + 14, stageEl.clientHeight - 150)}px">
        <b>{hover.ours}</b>
        <span>method at native 5′: {hover.m32}</span>
        <span>HYDE 3.5 published: {hover.h35}</span>
        <i>{hover.dens}/km² · crops {hover.crop}% · grazing {hover.graz}%
          {#if hover.urb > 0}&nbsp;· urban {hover.urb}%{/if}</i>
        <i>potential vegetation: {hover.potveg}</i>
        {#if hover.firstUsed}
          <i>first used, under your thresholds: {hover.firstUsed}</i>
        {/if}
      </div>
    {/if}

    {#if error}
      <p class="err">Couldn't load the data for this one: {error}</p>
    {:else if loading}
      <p class="loading">{loading}</p>
    {/if}
  </div>

  {#if !view && manifest}
    <div class="legend">
      {#if (params.colour_by ?? 'anthrome') === 'anthrome'}
        {#each FAMILIES as [name, codes] (name)}
          <div class="fam">
            <span class="fam-name">{name}</span>
            {#each codes as c (c)}
              <span class="sw" title={CLASS_NAMES[c]}
                style="background: rgb({PALETTE[c][0]},{PALETTE[c][1]},{PALETTE[c][2]})"></span>
            {/each}
          </div>
        {/each}
      {:else if params.colour_by === 'disagreement'}
        <span class="note"><i class="sw one" style="background:#aa2d20"></i>
          classified differently by the same cascade at native resolution -
          at the default thresholds this is purely what aggregation does to a
          threshold rule</span>
      {/if}
      <span class="note">Your cascade, over {manifest.grid.nLand.toLocaleString()}
        cells of 33km. The drawing is equirectangular and exaggerates the high
        latitudes; every number is computed with real cell areas instead.</span>
      {#if params.year === '2017AD'}
        <span class="note">The timeline ends here: 2018–2025 have no input
          grids in any HYDE release we could obtain.</span>
      {/if}
      {#if ledgerStale && ledger}
        <span class="note stale">recomputing the ledger…</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .wrap { position: absolute; inset: 0; display: flex; flex-direction: column;
          background: #eceef0; }
  .stage { position: relative; flex: 1; min-height: 0; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .loading, .err {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    font-size: 0.75rem; color: #888; background: rgba(255,255,255,0.9);
    padding: 0.4rem 0.7rem;
  }
  .err { color: #a00; max-width: 70%; text-align: center; }
  .tip {
    position: absolute; width: 230px; pointer-events: none;
    background: rgba(255,255,255,0.95); border: 1px solid #000;
    padding: 0.35rem 0.5rem; font-size: 0.62rem; line-height: 1.45;
    display: flex; flex-direction: column; gap: 0.05rem;
  }
  .tip b { font-size: 0.7rem; }
  .tip span { color: #555; }
  .tip i { color: #999; font-style: normal; }
  .legend {
    display: flex; flex-wrap: wrap; gap: 0.4rem 1.1rem; align-items: center;
    padding: 0.4rem 0.7rem; border-top: 1px solid #000; background: #fbfbf9;
    font-size: 0.62rem; color: #555;
  }
  .fam { display: flex; align-items: center; gap: 2px; }
  .fam-name { margin-right: 0.25rem; color: #888; text-transform: lowercase; }
  .sw { width: 11px; height: 11px; display: inline-block; }
  .sw.one { margin-right: 0.3rem; vertical-align: -2px; }
  .note { color: #888; max-width: 34rem; }
  .note.stale { color: #b56; }
</style>
