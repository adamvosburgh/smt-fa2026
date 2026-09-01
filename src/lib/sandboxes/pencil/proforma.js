// The pro-forma, over typed arrays.
//
// One function, called on every parameter change, producing BOTH the colour
// array and the metrics in the same pass. That is deliberate and it is the same
// rule bathtub follows: the picture and the numbers must come from the same
// data by the same formula, so they cannot quietly disagree.
//
// Every step below is a line of the HPD Plus One ADU term sheet, except where
// it is marked as ours. The manifest carries the citations.

export const FLAG = {
  two_family: 1 << 0,
  eligible_backyard: 1 << 1,
  in_10yr_rainfall_frra: 1 << 2,
  in_coastal_frra: 1 << 3,
  in_high_risk_flood_zone: 1 << 4,
  in_historic_district: 1 << 5,
  excluded_district: 1 << 6,
  city_owned: 1 << 7
};

// Column offsets into lots.bin. Must match manifest.columns.
const LON = 0, LAT = 1, LOT_FRONT = 2, REQ_DEPTH = 3, LOT_AREA = 4,
      RENT_FMR = 5, TRACT_INCOME = 6, TRACT_IDX = 7, BLDG_TYPE = 8,
      REAR_X = 9, REAR_Y = 10, REAR_DEPTH = 11, REAR_WIDTH = 12;
export const STRIDE = 13;
// Exported so the component does not have to hardcode an offset. It did, and
// the offsets moved when the sizing became a browser-side computation.
export const COL = { LON, LAT, LOT_FRONT, REQ_DEPTH, LOT_AREA, RENT_FMR,
                     TRACT_INCOME, TRACT_IDX, BLDG_TYPE, REAR_X, REAR_Y,
                     REAR_DEPTH, REAR_WIDTH };

// lots.bin column 8. Attached buildings cannot have a backyard ADU under
// ZR 23-341(b)(4) at all, so their area comes out zero; the category is here so
// the map can say WHY a lot is out rather than only that it is.
export const TYPE = { attached: 0, semi_detached: 1, detached: 2, unknown: 3 };

// Feet per degree of latitude, matching the pipeline's own constant. Used only
// to turn an offset of a few tens of feet into an offset in degrees.
export const FT_PER_DEG_LAT = 364000;

/**
 * Where the unit stands, and how big its footprint is.
 *
 * The pipeline ships the OPEN GROUND BEHIND THE HOUSE as a box - a centre, a
 * depth running away from the building, and a width across the lot. This
 * finishes the sum, and it has to be finished here rather than baked in
 * because `side_setback_ft` and the size of the unit are both controls.
 *
 * Returns null when the unit cannot be placed: no building footprint on record,
 * a lot centroid outside its own polygon (an L-shaped or flag lot), a house
 * that already reaches the rear lot line, or a back garden too shallow or too
 * narrow for a unit this shape. That last case is common and it is left
 * visible rather than fudged - the rule the programme applies is about the AREA
 * of the required rear yard, and an area is not a plan.
 */
export function siteUnit(lots, base, aduSf, setbackFt, ratio) {
  const bx = lots[base + REAR_X], by = lots[base + REAR_Y];
  const boxDepth = lots[base + REAR_DEPTH], boxWidth = lots[base + REAR_WIDTH];
  if (!(boxDepth > 0) || !(aduSf > 0)) return null;

  // NOT A SQUARE. Every design in HPD's library is a rectangle, and the unit is
  // drawn at their median proportion, standing with its long side along the
  // rear fence - which is how a backyard cottage actually goes in, and which
  // matters because depth is the scarce dimension in a rear yard.
  const deep = Math.sqrt(aduSf * ratio);         // along the lot, feet
  const wide = aduSf / deep;                     // across the lot, feet

  // Five feet off the rear lot line, and five off each side. The front of the
  // unit may meet the back of the house - the rule sets no separation between
  // them, and this model does not invent one.
  if (deep > boxDepth - setbackFt) return null;
  if (wide > boxWidth - 2 * setbackFt) return null;

  const span = Math.hypot(bx, by);
  if (!(span > 0)) return null;
  const ux = bx / span, uy = by / span;          // away from the house
  const px = -uy, py = ux;                       // across the lot

  // Pushed to the back of the open ground, less the setback.
  const shift = boxDepth / 2 - setbackFt - deep / 2;
  const lat = lots[base + LAT];
  const perDegLon = FT_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  const cx = lots[base + LON] + (bx + ux * shift) / perDegLon;
  const cy = lat + (by + uy * shift) / FT_PER_DEG_LAT;

  // Turned to face the house, so a row of them along a block lines up the way
  // the houses do rather than all pointing north.
  const hd = deep / 2, hw = wide / 2;
  const ring = [];
  for (const [a, b] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
    const ox = ux * a * hd + px * b * hw;
    const oy = uy * a * hd + py * b * hw;
    ring.push([cx + ox / perDegLon, cy + oy / FT_PER_DEG_LAT]);
  }
  ring.push(ring[0]);
  return ring;
}

/**
 * The unit's floor area, from ZR 23-341(b)(4) and ZR 23-342.
 *
 * THIS IS HERE RATHER THAN IN THE PIPELINE because two of its inputs are
 * controls. `rear_yard_denominator` is the ZR's one-third; `side_setback_ft` is
 * its five feet. Both are the numbers the rule turns on, and the whole point of
 * the sandbox is to re-run the borough against a rule the city did not write.
 *
 * Returns 0 where no unit is possible: an attached building, which
 * ZR 23-341(b)(4) does not cover at all; a lot too narrow to hold the narrowest
 * published design between two setbacks; or a result under the habitability
 * floor, which HPD's guidebook puts at 250-300 square feet.
 *
 * NOTE WHAT THIS IS NOT. It is an AREA, computed from the rule, and it says
 * nothing about whether a building of that area will fit behind the house.
 * siteUnit answers that, and it often answers no.
 */
function aduArea(lots, base, p, sizing) {
  if (lots[base + BLDG_TYPE] === TYPE.attached) return 0;
  const front = lots[base + LOT_FRONT];
  const depth = lots[base + REQ_DEPTH];
  if (front <= 0 || depth <= 0) return 0;
  if (front - 2 * p.side_setback_ft < sizing.narrowest_detached_plan_ft) return 0;
  // The ZR's fraction, as a denominator. See the schema for why this is a
  // whole number and not a decimal share: the 300sf habitability floor is a
  // cliff, and a third and 33% put nearly six thousand lots on opposite
  // sides of it.
  const a = Math.min((front * depth) / p.rear_yard_denominator, sizing.max_sf);
  return a < sizing.min_sf ? 0 : a;
}

/** Monthly debt service on F over n months at annual rate r. */
function payment(F, annualRate, months) {
  if (F <= 0) return 0;
  const r = annualRate / 12;
  // The rate slider reaches zero because the programme does - "5%. Rate may be
  // reduced." - and the amortisation formula divides by zero there.
  if (r === 0) return F / months;
  return (F * r) / (1 - Math.pow(1 + r, -months));
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function median(sorted) {
  if (!sorted.length) return 0;
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

/**
 * Run the pro-forma on every lot.
 *
 * Returns typed arrays the layer reads directly, plus the panel's numbers.
 * Nothing is allocated per lot and nothing is recomputed twice.
 */
export function compute(lots, flags, manifest, p) {
  const n = flags.length;
  const margin = new Float32Array(n);
  const aduSf = new Float32Array(n);
  const roe = new Float32Array(n);
  const state = new Uint8Array(n);   // 0 ineligible, 1 fails, 2 over loan cap, 3 pencils
  const releaseYear = new Int16Array(n).fill(-1);

  const loanMax = manifest.programme.loan_max;
  const propertyTax = manifest.assumptions.property_tax.value;   // 0 - see the card
  const rentAmi = manifest.rent_ami_monthly;

  // Soft cost is a FORMULA now, not a flat sum, and it is HPD's own - recovered
  // from their budgeting tool by moving one slider at a time:
  //   soft cost = $50,000 + 0.48 x hard cost
  // The tool's four exposed inputs account for 0.20 + 0.08 of hard cost plus
  // $50,000. The remaining 20% of hard cost is a term the tool never shows the
  // user, equal in size to the largest one it does. Probably GC overhead and
  // profit; unlabelled anywhere in the interface. That is the finding, and it is
  // why this uses the measured output rather than adding up the published parts.
  const softFlat = manifest.hpd_budget.soft_cost_flat;
  const softShare = manifest.hpd_budget.soft_cost_share_of_hard;

  // Operating cost, also HPD's defaults rather than a rule of thumb: upkeep and
  // management as shares of rent, insurance as a flat monthly sum. The old
  // single opex_share of 0.25 was "a conventional small-landlord rule of thumb"
  // and said so.
  const op = manifest.hpd_budget.operating;
  const opexShare = op.upkeep_share + op.management_share;
  const insurance = op.insurance_monthly;
  const sizing = manifest.adu_sizing;
  const ratio = manifest.plan_library?.depth_to_width_ratio ?? 0.7;

  const useAll = p.eligibility === 'all';
  const cushion = p.cushion;

  let eligible = 0, pencils = 0, overCap = 0;
  const passingRoe = [];
  const passingIdx = [];

  for (let i = 0; i < n; i++) {
    const f = flags[i];
    const base = i * STRIDE;
    const A = aduArea(lots, base, p, sizing);
    aduSf[i] = A;

    // Eligibility. `all` prices an ADU on every one-to-two-family lot in Queens
    // regardless of legality, so the difference between the two settings is
    // exactly what the zoning rule costs.
    const legal = (f & FLAG.eligible_backyard) !== 0;
    const inSet = A > 0 && (useAll ? (f & FLAG.city_owned) === 0 : legal);
    if (!inSet) { state[i] = 0; continue; }

    // THERE IS NO OWNER-OCCUPANCY CONTROL, deliberately.
    //
    // The programme requires the owner to live at the property "no less than
    // 270 days per year", and this model cannot represent that at all: there is
    // no dataset of who lives in which house. An earlier version had the switch
    // and it screened out city-owned lots, which the eligibility test above
    // already excludes - so it was a control that changed nothing, which is a
    // bug, and a worse one than a missing control because it implies the model
    // knows something it does not. The requirement is named in the model card
    // under what this cannot see.

    eligible += 1;

    const hard = A * p.cost_per_sf;
    const C = hard + softFlat + softShare * hard;
    const S = Math.min(p.grant_max, C);
    const E = p.equity_share * C;
    const need = Math.max(0, C - S - E);

    // A lot whose remaining cost exceeds the loan cap does not pencil, and the
    // reason is reported separately from failing the cushion - they are
    // different failures and a student should be able to tell them apart.
    if (need > loanMax) { state[i] = 2; overCap += 1; continue; }

    const D = payment(need, p.interest_rate, p.term_months);

    let R;
    if (p.rent_basis === 'ami_cap') R = rentAmi;
    else if (p.rent_basis === 'fmr') R = lots[base + RENT_FMR];
    else R = p.rent_flat;

    const Reff = R * (1 - p.vacancy);
    const O = opexShare * Reff + insurance;
    const M = Reff - O - propertyTax - D;
    margin[i] = M;

    // Guard the divide: equity can legitimately be zero, and the programme's
    // own default is that the homeowner puts in nothing.
    roe[i] = E > 0 ? (12 * M) / E : (M > 0 ? Infinity : 0);

    if (M >= cushion) {
      state[i] = 3;
      pencils += 1;
      passingRoe.push(roe[i]);
      passingIdx.push(i);
    } else {
      state[i] = 1;
    }
  }

  // ---- time -------------------------------------------------------------
  // Rank the passing lots by return on equity and release the top
  // permits_per_year each year. The claim this makes is explicit: the binding
  // constraint is permitting throughput, not demand. Nothing here represents a
  // homeowner deciding anything, and the ranking is a stand-in for a decision.
  passingIdx.sort((a, b) => {
    const ra = roe[a], rb = roe[b];
    if (ra === rb) return a - b;          // stable, so the map does not shimmer
    return rb - ra;
  });
  const startYear = manifest.start_year ?? 2027;
  const perYear = Math.max(1, p.permits_per_year);
  for (let rank = 0; rank < passingIdx.length; rank++) {
    releaseYear[passingIdx[rank]] = startYear + Math.floor(rank / perYear);
  }

  // ---- metrics, from the same pass --------------------------------------
  let builtByYear = 0, builtThisYear = 0;
  const incomesOfBuilt = [];
  const perTract = new Map();
  for (let rank = 0; rank < passingIdx.length; rank++) {
    const i = passingIdx[rank];
    const y = releaseYear[i];
    if (y > p.year) break;               // sorted by rank, so this is safe
    builtByYear += 1;
    if (y === p.year) builtThisYear += 1;
    incomesOfBuilt.push(lots[i * STRIDE + TRACT_INCOME]);
    const t = lots[i * STRIDE + TRACT_IDX];
    perTract.set(t, (perTract.get(t) ?? 0) + 1);
  }

  // CAN THE UNIT ACTUALLY GO ANYWHERE? The programme's rule is about the AREA
  // of the required rear yard, and an area is not a plan. A lot can clear the
  // one-third test and still have no room behind the house for a rectangle the
  // shape of a real published design. That gap is counted here rather than left
  // to be noticed as an absence on the map.
  let placeable = 0;
  for (let rank = 0; rank < passingIdx.length; rank++) {
    const i = passingIdx[rank];
    const y = releaseYear[i];
    if (y > p.year) break;
    if (siteUnit(lots, i * STRIDE, aduSf[i], p.side_setback_ft, ratio)) placeable += 1;
  }

  const marginsOfPassing = passingIdx.map((i) => margin[i]).sort((a, b) => a - b);
  const sizesOfPassing = passingIdx.map((i) => aduSf[i]).sort((a, b) => a - b);
  incomesOfBuilt.sort((a, b) => a - b);

  // The concentration measure, defined here and stated in the card: tracts are
  // ranked by how many units they receive, and this is the share of all units
  // falling in the top DECILE of those tracts.
  const counts = [...perTract.values()].sort((a, b) => b - a);
  const topDecileTracts = Math.max(1, Math.ceil(counts.length / 10));
  const inTop = counts.slice(0, topDecileTracts).reduce((a, b) => a + b, 0);
  const concentration = builtByYear > 0 ? inTop / builtByYear : 0;

  return {
    margin, roe, state, releaseYear, aduSf,
    metrics: {
      eligible, pencils, overCap,
      shareOfEligible: eligible > 0 ? pencils / eligible : 0,
      builtByYear, builtThisYear,
      medianMargin: median(marginsOfPassing),
      medianAduSf: median(sizesOfPassing),
      placeable,
      medianTractIncome: median(incomesOfBuilt),
      concentration,
      tractsReceiving: counts.length
    }
  };
}

/**
 * The colour ramps, as pure functions of a normalised position.
 *
 * EXPORTED SO THE LEGEND CAN DRAW THE ACTUAL GRADIENT. They used to be written
 * inline in the loop below, and the legend described them in a sentence -
 * "darker is a higher return" - which is not a key. A key a reader can hold
 * against the map has to be made of the same numbers the map is, so both come
 * from here now. Called once per lot; the call costs nothing next to the
 * upload.
 *
 * `v` and `t` run 0 to 1. Callers clamp.
 */
export const RAMP = {
  roe: (v) => [245 - 215 * v, 240 - 160 * v, 230 - 90 * v],
  marginAbove: (v) => [200 - 170 * v, 225 - 145 * v, 235 - 95 * v],
  marginBelow: (v) => [235 - 26 * v, 215 - 146 * v, 210 - 149 * v],
  releaseYear: (t) => [30 + 200 * t, 90 - 30 * t, 140 - 60 * t]
};

/** The span each ramp covers, in the units of the thing it colours. */
export const RAMP_SPAN = { margin: 1200, roe: 0.4, releaseYear: 24 };

/**
 * Colour every lot, from the results of the same pass.
 *
 * Returns a Uint8Array of RGBA, which deck.gl reads without copying.
 */
export function colours(result, lots, p, manifest) {
  const n = result.state.length;
  const rgba = new Uint8Array(n * 4);
  const { state, margin, roe, releaseYear } = result;
  const startYear = manifest.start_year ?? 2027;

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const s = state[i];
    let r = 214, g = 214, b = 210, a = 40;   // ineligible: pale, nearly invisible

    if (s !== 0) {
      if (p.tint === 'eligibility') {
        [r, g, b, a] = s === 3 ? [30, 80, 140, 200] : [209, 69, 61, 120];
      } else if (p.tint === 'release_year') {
        if (releaseYear[i] < 0 || releaseYear[i] > p.year) {
          [r, g, b, a] = [225, 225, 220, 60];
        } else {
          const t = clamp01((releaseYear[i] - startYear) / RAMP_SPAN.releaseYear);
          const c = RAMP.releaseYear(t);
          [r, g, b, a] = [Math.round(c[0]), Math.round(c[1]), Math.round(c[2]), 210];
        }
      } else if (p.tint === 'roe') {
        const c = RAMP.roe(clamp01(roe[i] / RAMP_SPAN.roe));
        [r, g, b, a] = [Math.round(c[0]), Math.round(c[1]), Math.round(c[2]), 190];
      } else {
        // margin, the default. Diverging around the cushion.
        const m = margin[i];
        if (m >= p.cushion) {
          const c = RAMP.marginAbove(clamp01((m - p.cushion) / RAMP_SPAN.margin));
          [r, g, b, a] = [Math.round(c[0]), Math.round(c[1]), Math.round(c[2]), 200];
        } else {
          const c = RAMP.marginBelow(clamp01((p.cushion - m) / RAMP_SPAN.margin));
          [r, g, b, a] = [Math.round(c[0]), Math.round(c[1]), Math.round(c[2]), 170];
        }
      }
    }
    rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = a;
  }
  return rgba;
}
