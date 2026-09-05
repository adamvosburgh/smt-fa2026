// The all-years ledger, off the main thread.
//
// The crossover year - the first time step at which used land exceeds wild -
// needs all 75 years classified under the reader's thresholds, which is 13.7
// million cell-years. That never blocks the animation: this worker gets the
// planes once, reclassifies the whole timeline on each parameter change
// (debounced by the component), and posts back the per-year ledger. The
// component greys the stale value while a new one is in flight.
//
// Areas are computed with the REAL per-cell land area - the drawing is
// equirectangular and badly exaggerates high latitudes, where most of what
// the cascade calls wild lives. The picture is distorted; these numbers are
// not.

import { classifyYear, decodeSparse, sparseOffsets, USED_CODES } from './cascade.js';

let D = null; // static data, posted once

self.onmessage = (e) => {
  const d = e.data;
  if (d.type === 'init') {
    const nLand = d.nLand;
    D = {
      nLand,
      years: d.years,
      popd: new Uint8Array(d.popd),
      crop: new Uint8Array(d.crop),
      graz: new Uint8Array(d.graz),
      rice: d.rice,
      irr: d.irr,
      urb: d.urb,
      riceOff: sparseOffsets(d.rice, d.years.length),
      irrOff: sparseOffsets(d.irr, d.years.length),
      urbOff: sparseOffsets(d.urb, d.years.length),
      potveg: new Uint8Array(d.statics, 0, nLand),
      potvill: new Uint8Array(d.statics, nLand, nLand),
      fracLand: new Uint8Array(d.statics, 2 * nLand, nLand),
      landKm2: new Float32Array(d.landKm2),
      method32: new Uint8Array(d.method32)
    };
    self.postMessage({ type: 'ready' });
    return;
  }
  if (d.type !== 'ledger' || !D) return;

  const { nLand, years } = D;
  const nY = years.length;
  const out = new Uint8Array(nLand);
  const riceD = new Uint8Array(nLand);
  const irrD = new Uint8Array(nLand);
  const urbD = new Uint8Array(nLand);
  const usedShare = new Float32Array(nY);
  const wildShare = new Float32Array(nY);
  const agree32 = new Float32Array(nY);
  const firstUsedYear = new Int16Array(nLand).fill(-1);
  let crossoverIdx = -1;

  let totalLand = 0;
  for (let i = 0; i < nLand; i++) totalLand += D.landKm2[i];

  for (let y = 0; y < nY; y++) {
    decodeSparse(D.rice, D.riceOff, y, riceD);
    decodeSparse(D.irr, D.irrOff, y, irrD);
    decodeSparse(D.urb, D.urbOff, y, urbD);
    classifyYear(out,
      D.popd.subarray(y * nLand, (y + 1) * nLand),
      D.crop.subarray(y * nLand, (y + 1) * nLand),
      D.graz.subarray(y * nLand, (y + 1) * nLand),
      riceD, irrD, urbD, D.potveg, D.potvill, d.params, D.fracLand);
    let used = 0;
    let wild = 0;
    let sameArea = 0;
    const m32 = D.method32.subarray(y * nLand, (y + 1) * nLand);
    for (let i = 0; i < nLand; i++) {
      const a = D.landKm2[i];
      const c = out[i];
      if (USED_CODES.has(c)) {
        used += a;
        if (firstUsedYear[i] < 0) firstUsedYear[i] = y;
      } else if (c >= 61 && c <= 63) {
        wild += a;
      }
      if (c === m32[i]) sameArea += a;
    }
    usedShare[y] = used / totalLand;
    wildShare[y] = wild / totalLand;
    agree32[y] = sameArea / totalLand;
    // THE CROSSOVER: the first step at which used land exceeds wild land.
    if (crossoverIdx < 0 && used > wild) crossoverIdx = y;
  }

  self.postMessage({
    type: 'ledger',
    gen: d.gen,
    usedShare,
    wildShare,
    agree32,
    crossoverIdx,
    crossoverYear: crossoverIdx >= 0 ? years[crossoverIdx] : null,
    firstUsedYear
  }, [usedShare.buffer, wildShare.buffer, agree32.buffer, firstUsedYear.buffer]);
};
