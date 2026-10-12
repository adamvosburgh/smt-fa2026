<script>
  // Street Tree Stormwater - the worked example for Tutorial 4.
  //
  // The rule and the run are in model.js. This file loads the data, draws the
  // year shown, and reports the totals. Three things recompute at different
  // rates, and keeping them apart is what lets the clock play smoothly:
  //
  //   growth   once, on load          (no slider moves it)
  //   the run  deaths, plantings, draw (model.run, a few ms)
  //   the draw everything else         (rain and interception only scale)
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { createMap, attachRedraw } from '../_shared/maplibre.js';
  import { YEAR0, YEARS, NEVER, grow, chance, run, galPerM2 } from './model.js';

  let { params, mode = 'edit', dataBase, onmetrics, onready } = $props();

  let container = $state(null);
  let error = $state(null);
  let loading = $state('loading the trees…');
  let basemapFailed = $state(false);
  let tileFailures = $state(0);
  let hover = $state(null);
  // The totals for every year, for the line in the key. Reactive so the key
  // redraws when the run or the rain changes.
  let series = $state(null);

  let map, overlay, layers, detachRedraw;
  let manifest, trees, sites, blocks, g, ch, result;
  let chDraw = null;
  let runKey = '';
  let ready = false;

  // One sequential ramp, light to dark, for both views. Fixed breaks in
  // gallons rather than breaks fitted to the data, so that a wetter year or a
  // higher interception visibly darkens the map instead of being normalized
  // away.
  const RAMP = [
    [199, 233, 180],
    [127, 205, 187],
    [65, 182, 196],
    [29, 145, 192],
    [34, 94, 168],
    [12, 44, 132]
  ];
  const TREE_BREAKS = [1000, 2500, 4000, 6000, 9000];
  const BLOCK_BREAKS = [20000, 50000, 100000, 150000, 250000];
  const GONE = [120, 120, 120];
  const SITE = [90, 90, 90];

  const step = (v, breaks) => {
    let i = 0;
    while (i < breaks.length && v >= breaks[i]) i++;
    return i;
  };

  const t = $derived(Math.min(YEARS - 1, Math.max(0, (params.year ?? YEAR0) - YEAR0)));
  const k = $derived(galPerM2(params.rain_in ?? 41, (params.interception_pct ?? 15) / 100));
  const byBlock = $derived(params.view === 'blocks');

  async function boot() {
    try {
      const deckLayers = await import('@deck.gl/layers');
      layers = deckLayers;
      const get = async (f) => (await fetch(`${dataBase}/${f}`)).json();
      [manifest, trees, sites, blocks] = await Promise.all([
        get('manifest.json'),
        get('trees.json'),
        get('sites.json'),
        get('blocks.json')
      ]);
      const [w, s, e, n] = manifest.bounds;
      ({ map, overlay } = await createMap({
        container,
        bounds: [[w, s], [e, n]],
        interactive: mode === 'edit',
        padding: 20,
        onBasemapFail: () => { basemapFailed = true; },
        onTileFail: (c) => { tileFailures = c; }
      }));

      loading = 'growing the trees…';
      g = grow(trees, manifest);
      loading = null;
      render();
      detachRedraw = attachRedraw(map, container, render);
    } catch (err) {
      error = String(err?.message ?? err);
      onready?.(true); // never hang the cover pipeline on a data failure
    }
  }

  // The run only reruns when one of its own inputs moves.
  function ensureRun() {
    const nSites = sites.lon.length;
    if (chDraw !== params.draw) {
      ch = chance(params.draw ?? 1, g.n, nSites);
      chDraw = params.draw;
      runKey = '';
    }
    const key = `${params.death_young_pct}|${params.death_old_pct}|${params.plantings}`;
    if (key === runKey) return;
    runKey = key;
    result = run(g, nSites, ch, {
      deathYoung: (params.death_young_pct ?? 2.8) / 100,
      deathOld: (params.death_old_pct ?? 0.57) / 100,
      plantings: params.plantings ?? 0
    });
  }

  // Census tree i is standing in year t if it has not died before it.
  const standing = (i, yr) => result.lastYear[i] >= yr;
  const planted = (s, yr) => result.siteFirst[s] <= yr && result.siteLast[s] >= yr;
  const plantedArea = (s, yr) => g.planted.area[yr - result.siteFirst[s]];

  function render() {
    if (!overlay || !g) return;
    ensureRun();
    const yr = t;
    const nSites = sites.lon.length;
    const { ScatterplotLayer, GeoJsonLayer } = layers;
    const out = [];

    // Totals for every year, for the metrics and the line in the key.
    const totals = Array.from({ length: YEARS }, (_, y) => (result.censusArea[y] + result.plantedArea[y]) * k);
    series = totals;

    if (byBlock) {
      const gal = new Float64Array(blocks.features.length);
      const count = new Uint32Array(blocks.features.length);
      for (let i = 0; i < g.n; i++) {
        if (!standing(i, yr)) continue;
        gal[trees.block[i]] += g.area[i * YEARS + yr] * k;
        count[trees.block[i]] += 1;
      }
      for (let s = 0; s < nSites; s++) {
        if (!planted(s, yr)) continue;
        gal[sites.block[s]] += plantedArea(s, yr) * k;
        count[sites.block[s]] += 1;
      }
      out.push(new GeoJsonLayer({
        id: 'blocks',
        data: blocks,
        stroked: true,
        filled: true,
        pickable: mode === 'edit',
        getLineColor: [255, 255, 255, 200],
        lineWidthMinPixels: 0.75,
        getFillColor: (f) => {
          const v = gal[f.properties.i];
          return v > 0 ? [...RAMP[step(v, BLOCK_BREAKS)], 215] : [0, 0, 0, 0];
        },
        onHover: ({ object, x, y }) => {
          hover = object
            ? { x, y, kind: 'block', id: object.properties.id,
                trees: count[object.properties.i], gal: gal[object.properties.i] }
            : null;
        },
        updateTriggers: { getFillColor: [gal] }
      }));
    } else {
      if (params.show_sites !== false) {
        // Sites not yet planted, as open circles.
        const open = [];
        for (let s = 0; s < nSites; s++) if (result.siteFirst[s] > yr) open.push(s);
        out.push(new ScatterplotLayer({
          id: 'sites',
          data: open,
          pickable: mode === 'edit',
          stroked: true,
          filled: false,
          radiusUnits: 'pixels',
          getRadius: 3,
          lineWidthUnits: 'pixels',
          getLineWidth: 1,
          getPosition: (s) => [sites.lon[s], sites.lat[s]],
          getLineColor: [...SITE, 200],
          onHover: ({ object, x, y }) => {
            hover = object != null ? { x, y, kind: 'site', s: object } : null;
          }
        }));
        // Trees that have died during the run, as gray dots.
        const gone = [];
        for (let i = 0; i < g.n; i++) if (!standing(i, yr)) gone.push(i);
        const goneSites = [];
        for (let s = 0; s < nSites; s++) {
          if (result.siteFirst[s] <= yr && result.siteLast[s] < yr) goneSites.push(s);
        }
        out.push(new ScatterplotLayer({
          id: 'gone',
          data: [...gone.map((i) => ({ i })), ...goneSites.map((s) => ({ s }))],
          pickable: mode === 'edit',
          radiusUnits: 'pixels',
          getRadius: 2,
          getPosition: (d) => (d.i != null ? [trees.lon[d.i], trees.lat[d.i]] : [sites.lon[d.s], sites.lat[d.s]]),
          getFillColor: [...GONE, 170],
          onHover: ({ object, x, y }) => {
            hover = object ? { x, y, kind: 'gone', ...object } : null;
          }
        }));
      }

      // The trees standing this year, each a circle the size of its crown.
      const live = [];
      for (let i = 0; i < g.n; i++) if (standing(i, yr)) live.push({ i });
      for (let s = 0; s < nSites; s++) if (planted(s, yr)) live.push({ s });
      const area = (d) => (d.i != null ? g.area[d.i * YEARS + yr] : plantedArea(d.s, yr));
      out.push(new ScatterplotLayer({
        id: 'trees',
        data: live,
        pickable: mode === 'edit',
        stroked: false,
        radiusUnits: 'meters',
        radiusMinPixels: 1.5,
        getRadius: (d) => Math.sqrt(area(d) / Math.PI),
        getPosition: (d) => (d.i != null ? [trees.lon[d.i], trees.lat[d.i]] : [sites.lon[d.s], sites.lat[d.s]]),
        getFillColor: (d) => [...RAMP[step(area(d) * k, TREE_BREAKS)], 225],
        onHover: ({ object, x, y }) => {
          hover = object ? { x, y, kind: 'tree', ...object } : null;
        },
        updateTriggers: { getRadius: [yr, runKey, chDraw], getFillColor: [yr, k, runKey, chDraw] }
      }));
    }

    overlay.setProps({ layers: out });

    const total = totals[yr];
    const census = result.censusCount[yr];
    const added = result.plantedCount[yr];
    let left = 0;
    for (let s = 0; s < nSites; s++) if (result.siteFirst[s] > yr) left++;
    const change = totals[0] > 0 ? (total / totals[0] - 1) * 100 : 0;
    onmetrics?.({
      year: String(YEAR0 + yr),
      'trees standing': (census + added).toLocaleString(),
      'of those, planted during the run': added.toLocaleString(),
      'stormwater caught this year': `${gallons(total)} gal`,
      'change since 2015': `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`,
      'census trees lost since 2015': (g.n - census).toLocaleString(),
      'planting sites left': `${left} of ${nSites}`
    });

    if (!ready) {
      ready = true;
      setTimeout(() => onready?.(true), 400);
    }
  }

  function gallons(v) {
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)} million`;
    return Math.round(v).toLocaleString();
  }

  $effect(() => {
    if (browser && container && !map) boot();
  });

  $effect(() => {
    void [params.year, params.view, params.show_sites, params.rain_in, params.interception_pct,
          params.death_young_pct, params.death_old_pct, params.plantings, params.draw];
    if (overlay && g) render();
  });

  onDestroy(() => {
    try { detachRedraw?.(); } catch { /* never attached */ }
    try { map?.remove(); } catch { /* already gone */ }
  });

  // ------------------------------------------------------------------ //
  // The hover tip.                                                      //
  // ------------------------------------------------------------------ //
  const tip = $derived.by(() => {
    if (!hover || !g || !result) return null;
    const yr = t;
    const year = YEAR0 + yr;
    if (hover.kind === 'block') {
      return { head: `Block ${hover.id}`,
               lines: [`${hover.trees.toLocaleString()} trees standing in ${year}`,
                       `${gallons(hover.gal)} gal caught in ${year}`] };
    }
    if (hover.kind === 'site') {
      const s = hover.s;
      const status = sites.status[s] === 'Stump' ? 'a stump' : 'a dead tree';
      const first = result.siteFirst[s];
      return { head: sites.address[s],
               lines: [`planting site: ${status} in the 2015 census`,
                       first !== NEVER ? `planted at the end of ${YEAR0 + first - 1}` : 'not planted in this run'] };
    }
    if (hover.kind === 'gone') {
      if (hover.i != null) {
        return { head: trees.address[hover.i],
                 lines: [`${trees.common[hover.i]}`, `died at the end of ${YEAR0 + result.lastYear[hover.i]}`] };
      }
      return { head: sites.address[hover.s],
               lines: ['honeylocust, planted in the run',
                       `died at the end of ${YEAR0 + result.siteLast[hover.s]}`] };
    }
    const sp = manifest.species;
    let head, kind, dbh, area;
    if (hover.i != null) {
      const i = hover.i;
      head = trees.address[i];
      const modelled = sp[trees.sp[i]].common;
      kind = trees.common[i] === modelled ? modelled : `${trees.common[i]}, modelled as ${modelled}`;
      dbh = g.dbh[i * YEARS + yr];
      area = g.area[i * YEARS + yr];
    } else {
      const s = hover.s;
      head = sites.address[s];
      kind = `honeylocust, planted at the end of ${YEAR0 + result.siteFirst[s] - 1}`;
      dbh = g.planted.dbh[yr - result.siteFirst[s]];
      area = g.planted.area[yr - result.siteFirst[s]];
    }
    const crown = 2 * Math.sqrt(area / Math.PI);
    return { head,
             lines: [kind,
                     `trunk ${(dbh / 2.54).toFixed(1)} in · crown ${crown.toFixed(1)} m across`,
                     `${Math.round(area * k).toLocaleString()} gal caught in ${year}`] };
  });

  // ------------------------------------------------------------------ //
  // The line in the key: the total for every year, and where the clock is. //
  // ------------------------------------------------------------------ //
  const SW = 200, SH = 54;
  const line = $derived.by(() => {
    if (!series) return null;
    const max = Math.max(...series) * 1.05 || 1;
    const x = (i) => (i / (YEARS - 1)) * SW;
    const y = (v) => SH - (v / max) * SH;
    const d = series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    return { d, max, cx: x(t), cy: y(series[t]) };
  });

  const rgb = (c) => `rgb(${c.join(',')})`;
  const fmtBreak = (v) => (v >= 1000 ? `${v / 1000}k` : String(v));
</script>

<div class="wrap">
  <div class="map" bind:this={container}></div>

  {#if error}
    <p class="err">Couldn't load the data for this one: {error}</p>
  {:else if loading}
    <p class="loading">{loading}</p>
  {/if}

  {#if tip}
    <div class="tip" style="left:{Math.min(hover.x + 14, (container?.clientWidth ?? 400) - 240)}px; top:{Math.min(hover.y + 14, (container?.clientHeight ?? 300) - 90)}px">
      <b>{tip.head}</b>
      {#each tip.lines as l, i (i)}<span>{l}</span>{/each}
    </div>
  {/if}

  {#if line}
    <div class="key">
      <span class="what">
        {byBlock ? 'gallons caught per block, per year' : 'gallons caught per tree, per year'}
      </span>
      <div class="ramp">
        {#each RAMP as c, i (i)}<i style="background:{rgb(c)}"></i>{/each}
      </div>
      <div class="ends">
        <span>0</span>
        {#each byBlock ? BLOCK_BREAKS : TREE_BREAKS as b (b)}<span>{fmtBreak(b)}</span>{/each}
        <span></span>
      </div>
      {#if !byBlock}
        <span class="note">Each circle is drawn at the size of the tree's crown.</span>
        {#if params.show_sites !== false}
          <span><i class="sw open"></i>planting site, not yet planted</span>
          <span><i class="sw gone"></i>tree that died during the run</span>
        {/if}
      {/if}

      <span class="what spaced">all trees, gallons a year</span>
      <svg viewBox="0 0 {SW} {SH}" width={SW} height={SH} aria-hidden="true">
        <line x1="0" x2={SW} y1={SH} y2={SH} stroke="#ccc" />
        <path d={line.d} fill="none" stroke={rgb(RAMP[4])} stroke-width="1.5" />
        <line x1={line.cx} x2={line.cx} y1="0" y2={SH} stroke="#000" stroke-width="0.5" />
        <circle cx={line.cx} cy={line.cy} r="2.5" fill="#000" />
      </svg>
      <div class="ends">
        <span>2015</span>
        <span>{gallons(series[t])} in {YEAR0 + t}</span>
        <span>2045</span>
      </div>

      {#if basemapFailed}
        <span class="warn">no basemap - the model still works</span>
      {:else if tileFailures > 3}
        <span class="warn">{tileFailures} basemap tiles blocked - the model still works</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .wrap { position: absolute; inset: 0; }
  .map { position: absolute; inset: 0; }
  /* Above the deck.gl canvas, which rides in MapLibre's control container at
     z-index 2 - an overlay without its own z-index paints under the model. */
  .loading, .err {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    font-size: 0.75rem; color: #888; background: rgba(255,255,255,0.9);
    padding: 0.4rem 0.7rem; z-index: 5;
  }
  .err { color: #a00; max-width: 70%; text-align: center; }
  /* Bottom left: the top corners and the bottom center belong to the floating
     panels, so the legend takes the one corner nothing else claims. */
  .key {
    position: absolute; left: 0.6rem; bottom: 0.6rem; z-index: 5;
    display: flex; flex-direction: column; gap: 0.2rem;
    background: rgba(255,255,255,0.88); padding: 0.45rem 0.55rem;
    font-size: 0.62rem; line-height: 1.4; color: #444; pointer-events: none;
    width: calc(200px + 1.1rem);
  }
  .key > span { display: flex; align-items: flex-start; gap: 0.35rem; }
  .what { color: #222; }
  .what.spaced { margin-top: 0.45rem; }
  .ramp { display: flex; height: 9px; border: 1px solid rgba(0,0,0,0.25); }
  .ramp i { flex: 1; }
  .ends {
    display: flex; justify-content: space-between; gap: 0.25rem;
    color: #888; font-size: 0.56rem; font-variant-numeric: tabular-nums;
  }
  svg { display: block; overflow: visible; }
  .sw { width: 9px; height: 9px; display: inline-block; flex: none; margin-top: 0.2em; border-radius: 50%; }
  .sw.open { border: 1px solid rgb(90,90,90); }
  .sw.gone { background: rgb(120,120,120); transform: scale(0.6); }
  .note { color: #999; }
  .warn { color: #a00; font-weight: 700; }
  .tip {
    position: absolute; width: 230px; pointer-events: none; z-index: 6;
    background: rgba(255,255,255,0.95); border: 1px solid #000;
    padding: 0.35rem 0.5rem; font-size: 0.62rem; line-height: 1.45;
    display: flex; flex-direction: column; gap: 0.05rem;
  }
  .tip b { font-size: 0.7rem; }
  .tip span { color: #555; }
</style>
