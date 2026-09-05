// The Anthromes 2.1 decision cascade, in the browser, thresholds movable.
//
// A JS port of the classify() in data/scripts/anthromes.py, which is itself a
// numpy port of the reference implementation in the Anthromes 12K replication
// archive (doi:10.7910/DVN/IB4VCI) - the code the published maps were
// computed with. The pipeline's gate proved the numpy port agrees with the
// reference cell-for-cell on its own test data; this file mirrors the numpy
// port branch for branch, in the same order, because the cascade is
// first-match and the order is load-bearing.
//
// Three rules are in the reference code but not in the paper's figures,
// marked [python only]; one quirk is preserved deliberately (missing biome
// counts as woody). See the pipeline for the full account.

export const CLASS_NAMES = {
  11: 'Urban', 12: 'Mixed settlements', 21: 'Rice villages',
  22: 'Irrigated villages', 23: 'Rainfed villages', 24: 'Pastoral villages',
  31: 'Residential irrigated croplands', 32: 'Residential rainfed croplands',
  33: 'Populated croplands', 34: 'Remote croplands',
  41: 'Residential rangelands', 42: 'Populated rangelands',
  43: 'Remote rangelands', 51: 'Residential woodlands',
  52: 'Populated woodlands', 53: 'Remote woodlands',
  54: 'Inhabited drylands', 61: 'Wild woodlands', 62: 'Wild drylands',
  63: 'Ice, uninhabited', 70: 'No land area'
};

// Class codes 11-43 count as "used" for the used-versus-wild ledger; 51-63
// are the semi-natural and wild families. That grouping is the paper's own.
export const USED_CODES = new Set([11, 12, 21, 22, 23, 24, 31, 32, 33, 34, 41, 42, 43]);

// Population density dequantisation - must mirror quant_density() in the
// pipeline: 0 is exactly zero, 1..255 span 1e-5..1e6 per km2 geometrically.
const D_MIN = 1e-5;
const D_K = 254 / Math.log(1e6 / 1e-5);
export const DENS_LUT = new Float32Array(256);
for (let q = 1; q < 256; q++) DENS_LUT[q] = D_MIN * Math.exp((q - 1) / D_K);

/**
 * Classify one year over the land cells. All inputs are per-land-cell typed
 * arrays for that year: popdQ (quantised density), crop/graz/rice/irr/urb
 * (Uint8 fractions, 0-255 = 0-1), potveg and potvill from statics. Writes
 * class codes into `out` and returns it.
 */
export function classifyYear(out, popdQ, crop, graz, rice, irr, urb, potveg, potvill, p, fracLand = null) {
  const n = out.length;
  const fUrb = p.urban_fraction_threshold * 255;
  const fCrop = p.crops_threshold * 255;
  const fGraz = p.grazing_threshold * 255;
  const fRice = p.rice_threshold * 255;
  const fIrr = p.irrigation_threshold * 255;
  const fUsed = p.used_threshold * 255;
  for (let i = 0; i < n; i++) {
    // Cells on the mask with no HYDE 3.2 land area at all (coastal slivers
    // the 3.5 mask keeps) are "no land area", not a classification.
    if (fracLand && fracLand[i] === 0) { out[i] = 70; continue; }
    const popd = DENS_LUT[popdQ[i]];
    const cu = crop[i], gz = graz[i], ub = urb[i];
    const used = cu + gz + ub;
    const biome = potveg[i];
    // The reference tests biome > 8 for treelessness and defaults a missing
    // biome to -1, so no-biome cells count as woody. Preserved.
    const woody = !(biome > p.tree_biomes);
    let c;
    if (ub >= fUrb || popd >= p.urban_density) c = 11;
    else if (popd < p.wild_density) {
      // [python only] the wild cutoff is 0.0001, not zero
      if (used >= fUsed) {
        if (cu >= fCrop) c = 34;             // [python only]
        else if (gz >= fGraz) c = 43;        // [python only]
        else c = cu >= gz ? 34 : 43;
      } else if (biome === 15) c = used > 0 ? 62 : 63; // [python only] the 62
      else c = woody ? 61 : 62;
    } else if (popd < p.populated_density) {
      if (cu >= fCrop) c = 34;
      else if (gz >= fGraz) c = 43;
      else if (used >= fUsed) c = cu >= gz ? 34 : 43;
      else c = woody ? 53 : 54;
    } else if (popd < p.residential_density) {
      if (cu >= fCrop) c = 33;
      else if (gz >= fGraz) c = 42;
      else c = woody ? 52 : 54;
    } else if (popd < p.dense_settlement_density) {
      if (irr[i] >= fIrr && cu >= fCrop) c = 31;
      else if (cu >= fCrop) c = 32;
      else if (gz >= fGraz) c = 41;
      else c = woody ? 51 : 54;
    } else if (!potvill[i]) c = 12;
    else if (rice[i] >= fRice) c = 21;
    else if (irr[i] >= fIrr) c = 22;
    else if (cu >= fCrop) c = 23;
    else if (gz >= fGraz) c = 24;
    else c = 12;
    out[i] = c;
  }
  return out;
}

/** Decode one year of a sparse plane (rice/irrigation/urban) into `dense`.
 *  Indices are read through a DataView: a year's block is 4 + 5n bytes, so
 *  the next block's start is NOT 4-byte aligned whenever n % 4 != 0, and a
 *  Uint32Array view would throw. */
export function decodeSparse(buf, offsets, year, dense) {
  dense.fill(0);
  const dv = new DataView(buf);
  let off = offsets[year];
  const count = dv.getUint32(off, true);
  off += 4;
  const vals = new Uint8Array(buf, off + count * 4, count);
  for (let i = 0; i < count; i++) dense[dv.getUint32(off + i * 4, true)] = vals[i];
  return dense;
}

/** Offsets of each year's block inside a sparse plane buffer. */
export function sparseOffsets(buf, years) {
  const dv = new DataView(buf);
  const offsets = new Uint32Array(years);
  let off = 0;
  for (let y = 0; y < years; y++) {
    offsets[y] = off;
    const count = dv.getUint32(off, true);
    off += 4 + count * 4 + count;
  }
  return offsets;
}
